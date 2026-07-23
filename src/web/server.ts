import { TimeSeriesDB } from '../storage/TimeSeriesDB.js';
import { SystemCollector } from '../core/SystemCollector.js';
import { DeviceRegistry } from '../core/DeviceRegistry.js';
import { getIdentity, getDid, getName } from '../core/DeviceIdentity.js';
import { loadConfig, saveConfig } from '../config/ConfigManager.js';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect Tailscale IP (100.x.x.x)
function getTailscaleIP(): string | null {
  try {
    const ifaces = execSync('ifconfig 2>/dev/null || ip addr 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    const match = ifaces.match(/inet (100\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getLanIP(): string | null {
  try {
    const ifaces = execSync('ifconfig 2>/dev/null || ip addr 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    // Prefer 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    const match = ifaces.match(/inet (192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getBestHostIP(reqHost?: string): string {
  const tailscale = getTailscaleIP();
  if (tailscale) return tailscale;
  const lan = getLanIP();
  if (lan) return lan;
  if (reqHost) return reqHost.split(':')[0];
  return 'localhost';
}

function getAllHosts(reqHost?: string): { tailscale: string | null; lan: string | null; local: string } {
  return {
    tailscale: getTailscaleIP(),
    lan: getLanIP(),
    local: reqHost ? reqHost.split(':')[0] : 'localhost',
  };
}

// Resolve DB path to canonical location (same as monitor)
const dbPath = join(process.env.HOME || '', '.procmon', 'monitor.db');
const db = new TimeSeriesDB(dbPath);
const collector = new SystemCollector();
const deviceRegistry = new DeviceRegistry();

type PsProcessInfo = {
  pid: number;
  ppid: number | null;
  user: string;
  state: string;
  cpuPercent: number;
  memoryPercent: number;
  rssKB: number;
  elapsed: string;
  cpuTime: string;
  comm: string;
  command: string;
  cpuSeconds: number;
};

function json(res: any, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseCpuTime(value: string): number {
  const daySplit = value.trim().split('-');
  let days = 0;
  let time = value.trim();
  if (daySplit.length === 2) {
    days = parseInt(daySplit[0], 10) || 0;
    time = daySplit[1];
  }
  const parts = time.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return days * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return days * 86400 + parts[0] * 60 + parts[1];
  return days * 86400 + (parts[0] || 0);
}

function parsePsOutput(output: string): PsProcessInfo[] {
  return output.split('\n').slice(1).map(line => {
    const parts = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+?)\s{2,}(.*)$/);
    if (!parts) return null;
    const comm = parts[10] || '';
    const command = parts[11] || comm;
    return {
      pid: Number(parts[1]),
      ppid: Number(parts[2]),
      user: parts[3],
      state: parts[4],
      cpuPercent: Number(parts[5]),
      memoryPercent: Number(parts[6]),
      rssKB: Number(parts[7]),
      elapsed: parts[8],
      cpuTime: parts[9],
      comm,
      command,
      cpuSeconds: parseCpuTime(parts[9]),
    };
  }).filter(Boolean) as PsProcessInfo[];
}

function collectPsProcesses(): PsProcessInfo[] {
  const output = execSync('ps -axo pid=,ppid=,user=,state=,pcpu=,pmem=,rss=,etime=,time=,comm=,command=', {
    encoding: 'utf8',
    timeout: 8000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return parsePsOutput(`PID PPID USER STATE PCPU PMEM RSS ELAPSED TIME COMM COMMAND\n${output}`);
}

function getProcessByPid(pid: number): PsProcessInfo | null {
  return collectPsProcesses().find(p => p.pid === pid) || null;
}

function getParentChain(processes: PsProcessInfo[], pid: number): PsProcessInfo[] {
  const byPid = new Map(processes.map(p => [p.pid, p]));
  const chain: PsProcessInfo[] = [];
  let current = byPid.get(pid);
  const seen = new Set<number>();
  while (current?.ppid && !seen.has(current.ppid)) {
    seen.add(current.pid);
    const parent = byPid.get(current.ppid);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

function inferProcessKind(p: PsProcessInfo | null): string {
  const text = `${p?.comm || ''} ${p?.command || ''}`.toLowerCase();
  if (!p) return 'unknown';
  if (p.pid === 1 || text.includes('/sbin/launchd')) return 'system';
  if (text.includes('.app/contents/')) return 'app';
  if (text.includes('/library/launch') || text.includes('/usr/libexec/') || text.includes('/usr/sbin/')) return 'daemon';
  if (text.includes('/bin/zsh') || text.includes('/bin/bash') || text.includes('/bin/sh')) return 'shell';
  if (text.includes('helper')) return 'helper';
  return 'process';
}

function findLaunchdHint(p: PsProcessInfo | null): string | null {
  if (!p || process.platform !== 'darwin') return null;
  const text = `${p.command} ${p.comm}`;
  const matches = [
    text.match(/\/Library\/Launch(?:Agents|Daemons)\/([^/\s]+\.plist)/),
    text.match(/\/Users\/[^/\s]+\/Library\/LaunchAgents\/([^/\s]+\.plist)/),
  ].filter(Boolean) as RegExpMatchArray[];
  if (matches[0]) return matches[0][1].replace(/\.plist$/, '');
  return null;
}

function inspectOpenFiles(pid: number): { ports: any[]; files: any[]; error?: string } {
  try {
    const output = execSync(`lsof -nP -p ${pid}`, {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const ports: any[] = [];
    const files: any[] = [];
    for (const line of output.split('\n').slice(1)) {
      if (!line.trim()) continue;
      const cols = line.trim().split(/\s+/);
      const type = cols[4] || '';
      const name = cols.slice(8).join(' ');
      if (!name) continue;
      if (type === 'IPv4' || type === 'IPv6') {
        ports.push({ fd: cols[3], protocol: type, name });
      } else if (files.length < 12 && !name.startsWith('/dev/') && !name.includes(' dyld shared cache ')) {
        files.push({ fd: cols[3], type, name });
      }
    }
    return { ports: ports.slice(0, 20), files };
  } catch (err) {
    return { ports: [], files: [], error: (err as Error).message };
  }
}

async function buildCpuIntervalProfile(ms: number): Promise<any[]> {
  const durationMs = Math.min(Math.max(ms, 1000), 10000);
  const before = collectPsProcesses();
  await new Promise(resolve => setTimeout(resolve, durationMs));
  const after = collectPsProcesses();
  const beforeByPid = new Map(before.map(p => [p.pid, p]));
  return after.map(p => {
    const prev = beforeByPid.get(p.pid);
    const cpuSeconds = prev ? Math.max(0, p.cpuSeconds - prev.cpuSeconds) : 0;
    return {
      pid: p.pid,
      name: p.comm.split('/').pop() || p.comm,
      user: p.user,
      command: p.command,
      cpuSeconds,
      avgCpuPercent: (cpuSeconds / (durationMs / 1000)) * 100,
      currentCpuPercent: p.cpuPercent,
      memoryPercent: p.memoryPercent,
      rssMB: p.rssKB / 1024,
      kind: inferProcessKind(p),
    };
  }).filter(p => p.cpuSeconds > 0 || p.currentCpuPercent > 1)
    .sort((a, b) => b.cpuSeconds - a.cpuSeconds || b.currentCpuPercent - a.currentCpuPercent)
    .slice(0, 25);
}

// MIME types
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  if (pathname === '/api/snapshot') {
    try {
      // Always use live collection for current snapshot
      const snapshot = await collector.getSystemSnapshot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/history') {
    try {
      const minutes = parseInt(url.searchParams.get('minutes') || '60');
      const history = db.getSnapshotHistory(minutes);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(history));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/report') {
    try {
      const date = url.searchParams.get('date') || 'today';
      const { ReportGenerator } = await import('../core/ReportGenerator.js');
      const generator = new ReportGenerator(db);
      const report = generator.generateReport(date);
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(report);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/drain-events') {
    try {
      const events = db.getDrainEvents();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(events));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/process-history') {
    try {
      const name = url.searchParams.get('name') || '';
      const minutes = parseInt(url.searchParams.get('minutes') || '30');
      const cutoff = Date.now() - minutes * 60000;
      const history = db.getProcessHistory(name, cutoff);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(history));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/network-interfaces') {
    try {
      const snapshot = collector.getLatestSnapshot?.();
      if (snapshot && snapshot.networkInterfaces) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ interfaces: snapshot.networkInterfaces }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ interfaces: [] }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/network-connections') {
    try {
      const state = url.searchParams.get('state') || 'all';
      const si = await import('systeminformation');
      const connections = await si.networkConnections();
      let filtered = connections;
      if (state !== 'all') {
        filtered = connections.filter((c: any) => c.state.toLowerCase() === state.toLowerCase());
      }
      // Enrich with process names from latest snapshot
      const snapshot = collector.getLatestSnapshot?.();
      const processMap = new Map();
      if (snapshot) {
        for (const p of snapshot.processes) {
          processMap.set(p.pid, p.name);
        }
      }
      const enriched = filtered.slice(0, 200).map((c: any) => ({
        protocol: c.protocol || 'unknown',
        localAddress: c.localAddress || '-',
        localPort: c.localPort || '-',
        peerAddress: c.peerAddress || '-',
        peerPort: c.peerPort || '-',
        state: c.state || 'unknown',
        pid: c.pid || null,
        processName: c.pid ? (processMap.get(c.pid) || 'unknown') : null,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ connections: enriched, total: connections.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/disk-volumes') {
    try {
      const snapshot = collector.getLatestSnapshot?.();
      if (snapshot && snapshot.diskVolumes) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ volumes: snapshot.diskVolumes }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ volumes: [] }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/process-stats') {
    try {
      const name = url.searchParams.get('name') || '';
      const minutes = parseInt(url.searchParams.get('minutes') || '60');
      const cutoff = Date.now() - minutes * 60000;
      const stats = db.getProcessStats(name, cutoff);
      const history = db.getProcessHistory(name, cutoff);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name,
        minutes,
        stats,
        sampleCount: history.length,
        pids: [...new Set(history.map(h => h.pid))],
        firstSeen: history[0]?.timestamp || null,
        lastSeen: history[history.length - 1]?.timestamp || null,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/process-forensics') {
    try {
      const pid = parseInt(url.searchParams.get('pid') || '', 10);
      const name = url.searchParams.get('name') || '';
      if (!Number.isFinite(pid) && !name.trim()) {
        json(res, 400, { error: 'pid or name is required' });
        return;
      }
      const processes = collectPsProcesses();
      const live = Number.isFinite(pid)
        ? processes.find(p => p.pid === pid)
        : processes.find(p => (p.comm.split('/').pop() || p.comm) === name || p.command.includes(name));
      const historyName = name || (live?.comm.split('/').pop() || live?.comm || '');
      const history = historyName ? db.getProcessHistory(historyName, Date.now() - 30 * 60000) : [];
      const open = live ? inspectOpenFiles(live.pid) : { ports: [], files: [] };
      const parentChain = live ? getParentChain(processes, live.pid).slice(0, 8) : [];
      const latestCpu = history.length ? history[history.length - 1].cpu_percent : live?.cpuPercent || 0;
      const avgCpu = history.length
        ? history.reduce((sum, h) => sum + (h.cpu_percent || 0), 0) / history.length
        : live?.cpuPercent || 0;
      const findings = [
        !live ? { severity: 'warning', label: 'Not currently running', detail: 'Historical samples exist, but no matching live process was found.' } : null,
        live && latestCpu > 50 ? { severity: 'warning', label: 'High live CPU', detail: `Latest CPU sample is ${latestCpu.toFixed(1)}%.` } : null,
        live && avgCpu > 25 ? { severity: 'warning', label: 'Sustained CPU load', detail: `Average CPU over recent samples is ${avgCpu.toFixed(1)}%.` } : null,
        live && !findLaunchdHint(live) && inferProcessKind(live) === 'daemon' ? { severity: 'info', label: 'Daemon without label', detail: 'No launchd label was inferred from the current command line.' } : null,
        open.error ? { severity: 'info', label: 'Open files limited', detail: open.error } : null,
      ].filter(Boolean);

      json(res, 200, {
        query: { pid: Number.isFinite(pid) ? pid : null, name },
        identity: live ? {
          pid: live.pid,
          ppid: live.ppid,
          user: live.user,
          state: live.state,
          cpuPercent: live.cpuPercent,
          memoryPercent: live.memoryPercent,
          rssMB: live.rssKB / 1024,
          elapsed: live.elapsed,
          cpuTime: live.cpuTime,
          executable: live.comm,
          command: live.command,
          kind: inferProcessKind(live),
          launchdLabel: findLaunchdHint(live),
        } : null,
        parentChain: parentChain.map(p => ({
          pid: p.pid,
          name: p.comm.split('/').pop() || p.comm,
          command: p.command,
          kind: inferProcessKind(p),
        })),
        openFiles: open.files,
        ports: open.ports,
        recent: {
          samples: history.length,
          avgCpu,
          peakCpu: history.length ? Math.max(...history.map(h => h.cpu_percent || 0)) : live?.cpuPercent || 0,
          latestCpu,
        },
        findings,
      });
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
    return;
  }

  if (pathname === '/api/process-cpu-profile') {
    try {
      const seconds = parseFloat(url.searchParams.get('seconds') || '5');
      const profile = await buildCpuIntervalProfile(seconds * 1000);
      json(res, 200, { seconds: Math.min(Math.max(seconds, 1), 10), processes: profile });
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
    return;
  }

  if (pathname === '/api/top-processes') {
    try {
      const metric = (url.searchParams.get('metric') || 'cpu') as 'cpu' | 'mem';
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const minutes = parseInt(url.searchParams.get('minutes') || '5');
      const cutoff = Date.now() - minutes * 60000;
      const top = db.getTopProcesses(metric, limit, cutoff);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ metric, limit, minutes, processes: top }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/profiles') {
    try {
      if (req.method === 'GET') {
        const profiles = db.getProfiles?.() || [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profiles));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const profile = JSON.parse(body);
            db.saveProfile?.(profile);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      } else if (req.method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (id) db.deleteProfile?.(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/db-stats') {
    try {
      const stats = db.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        totalSnapshots: stats.totalSnapshots,
        totalEvents: stats.totalEvents,
        oldestSnapshot: stats.oldestSnapshot,
        dbSizeBytes: stats.dbSizeBytes,
        dbSizeMB: (stats.dbSizeBytes / (1024 * 1024)).toFixed(2),
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/cleanup' && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { retentionDays = 30, maxSizeMB = 400 } = JSON.parse(body || '{}');
          const days = typeof retentionDays === 'number' ? retentionDays : parseInt(retentionDays) || 30;
          const sizeMB = typeof maxSizeMB === 'number' ? maxSizeMB : parseInt(maxSizeMB) || 400;
          const beforeBytes = db.getStats().dbSizeBytes;
          db.cleanupOldSamples(days, sizeMB);
          const afterStats = db.getStats();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            retentionDays: days,
            maxSizeMB: sizeMB,
            freedMB: ((beforeBytes - afterStats.dbSizeBytes) / (1024 * 1024)).toFixed(2),
            remainingSnapshots: afterStats.totalSnapshots,
            remainingMB: (afterStats.dbSizeBytes / (1024 * 1024)).toFixed(2),
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    try {
      const config = loadConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const updates = JSON.parse(body);
          saveConfig(updates);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Config saved. Restart monitor to apply changes.' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // ─── Analysis Endpoints ───
  if (pathname === '/api/analysis/battery-trend') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          date(timestamp/1000, 'unixepoch') as date,
          ROUND(AVG(battery_percent), 1) as avgBattery,
          MIN(battery_percent) as minBattery,
          MAX(battery_percent) as maxBattery,
          COUNT(*) as samples
        FROM snapshots
        WHERE timestamp > (strftime('%s', 'now') - 2592000) * 1000
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: any) => ({
        date: r.date,
        avgDrainRate: null,
        avgBattery: r.avgBattery,
        minBattery: r.minBattery,
        maxBattery: r.maxBattery,
        samples: r.samples
      }))));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/top-battery-impact') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          process_name as name,
          total_impact_score as totalImpact,
          samples_during_drain as events,
          ROUND(avg_cpu_during_drain, 2) as avgImpact
        FROM battery_impact
        ORDER BY total_impact_score DESC
        LIMIT 20
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/spike-patterns') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          process_name as name,
          SUM(CASE WHEN metric_type = 'cpu' THEN 1 ELSE 0 END) as cpuSpikes,
          SUM(CASE WHEN metric_type = 'memory' THEN 1 ELSE 0 END) as memSpikes,
          COUNT(*) as totalSpikes,
          ROUND(AVG(value), 1) as avgCpu
        FROM process_spikes
        GROUP BY process_name
        ORDER BY totalSpikes DESC
        LIMIT 20
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: any) => ({
        name: r.name,
        cpuSpikes: r.cpuSpikes,
        memSpikes: r.memSpikes,
        totalSpikes: r.totalSpikes,
        avgCpu: r.avgCpu
      }))));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/drain-correlation') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          ps.name,
          COUNT(DISTINCT de.id) as drainEvents,
          ROUND(SUM(ps.cpu_percent), 1) as totalCpu,
          ROUND(AVG(ps.cpu_percent), 1) as avgCpu,
          ROUND(COUNT(DISTINCT de.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM drain_events), 0), 1) as frequency
        FROM process_samples ps
        JOIN snapshots s ON ps.snapshot_id = s.id
        JOIN drain_events de ON s.timestamp BETWEEN de.start_time AND de.end_time
        GROUP BY ps.name
        ORDER BY drainEvents DESC, totalCpu DESC
        LIMIT 20
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/idle-active') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          CAST(strftime('%H', timestamp/1000, 'unixepoch') AS INTEGER) as hour,
          ROUND(AVG(cpu_total), 1) as avgCpu,
          ROUND(AVG(battery_percent), 1) as avgBattery,
          COUNT(*) as samples,
          CASE 
            WHEN AVG(cpu_total) > 30 THEN 'high'
            WHEN AVG(cpu_total) > 10 THEN 'medium'
            ELSE 'low'
          END as activityLevel
        FROM snapshots
        WHERE timestamp > (strftime('%s', 'now') - 604800) * 1000
        GROUP BY hour
        ORDER BY hour
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: any) => ({
        hour: r.hour,
        avgCpu: r.avgCpu,
        avgBattery: r.avgBattery,
        samples: r.samples,
        activityLevel: r.activityLevel
      }))));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/process-stats') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          ps.name,
          ROUND(AVG(ps.cpu_percent), 1) as avgCpu,
          ROUND(MAX(ps.cpu_percent), 1) as peakCpu,
          CASE 
            WHEN COUNT(*) > 1 THEN 
              ROUND(SQRT((SUM(ps.cpu_percent * ps.cpu_percent) - SUM(ps.cpu_percent)*SUM(ps.cpu_percent)/COUNT(*)) / (COUNT(*) - 1)), 2)
            ELSE 0 
          END as stdCpu,
          COUNT(*) as samples
        FROM process_samples ps
        JOIN snapshots s ON ps.snapshot_id = s.id
        WHERE s.timestamp > (strftime('%s', 'now') - 604800) * 1000
        GROUP BY ps.name
        HAVING COUNT(*) > 5
        ORDER BY avgCpu DESC
        LIMIT 20
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: any) => ({
        name: r.name,
        avgCpu: r.avgCpu,
        peakCpu: r.peakCpu,
        stdCpu: r.stdCpu,
        samples: r.samples
      }))));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/disk-trend') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          date(timestamp/1000, 'unixepoch') as date,
          ROUND(AVG(fs_used_percent), 1) as avgDisk,
          MIN(fs_used_percent) as minDisk,
          MAX(fs_used_percent) as maxDisk,
          COUNT(*) as samples
        FROM snapshots
        WHERE timestamp > (strftime('%s', 'now') - 2592000) * 1000
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: any) => ({
        date: r.date,
        avgDisk: r.avgDisk,
        minDisk: r.minDisk,
        maxDisk: r.maxDisk,
        samples: r.samples
      }))));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/network-trend') {
    try {
      const rows = db.db.prepare(`
        SELECT 
          date(timestamp/1000, 'unixepoch') as date,
          ROUND(MAX(net_rx_bytes)/1024/1024, 1) as rxMB,
          ROUND(MAX(net_tx_bytes)/1024/1024, 1) as txMB,
          COUNT(*) as samples
        FROM snapshots
        WHERE timestamp > (strftime('%s', 'now') - 2592000) * 1000
          AND net_rx_bytes IS NOT NULL
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: any) => ({
        date: r.date,
        rxMB: r.rxMB,
        txMB: r.txMB,
        samples: r.samples
      }))));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/analysis/troublesome-processes') {
    try {
      const rows = db.db.prepare(`
        SELECT
          ps.name,
          COUNT(*) as samples,
          ROUND(AVG(ps.cpu_percent), 1) as avgCpu,
          ROUND(MAX(ps.cpu_percent), 1) as peakCpu,
          ROUND(AVG(ps.memory_percent), 2) as avgMemory,
          COUNT(DISTINCT ps.pid) as pidCount,
          MAX(s.timestamp) as lastSeen
        FROM process_samples ps
        JOIN snapshots s ON ps.snapshot_id = s.id
        WHERE s.timestamp > (strftime('%s', 'now') - 604800) * 1000
        GROUP BY ps.name
        HAVING peakCpu > 40 OR avgCpu > 15 OR pidCount > 5
        ORDER BY avgCpu DESC, peakCpu DESC
        LIMIT 30
      `).all();
      json(res, 200, rows.map((r: any) => ({
        name: r.name,
        samples: r.samples,
        avgCpu: r.avgCpu,
        peakCpu: r.peakCpu,
        avgMemory: r.avgMemory,
        pidCount: r.pidCount,
        lastSeen: r.lastSeen,
        flags: [
          r.avgCpu > 25 ? 'sustained-cpu' : null,
          r.peakCpu > 80 ? 'high-peak' : null,
          r.pidCount > 5 ? 'many-pids' : null,
          ['node', 'plugin-container'].includes(String(r.name).toLowerCase()) ? 'ambiguous-name' : null,
        ].filter(Boolean),
      })));
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
    return;
  }

  if (pathname === '/api/export/csv') {
    try {
      const fromISO = url.searchParams.get('from') || '';
      const toISO = url.searchParams.get('to') || '';
      const fromMs = fromISO ? new Date(fromISO).getTime() : 0;
      const toMs = toISO ? new Date(toISO).getTime() : Date.now();
      if (isNaN(fromMs) || isNaN(toMs)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid from/to date' }));
        return;
      }
      const rows = db.db.prepare(`
        SELECT
          s.id AS snapshot_id,
          s.timestamp,
          s.battery_percent,
          s.cpu_total,
          s.memory_used_mb,
          ps.name AS process_name,
          ps.pid AS process_pid,
          ps.cpu_percent AS process_cpu,
          ps.memory_percent AS process_mem
        FROM snapshots s
        LEFT JOIN process_samples ps ON ps.snapshot_id = s.id
        WHERE s.timestamp >= ? AND s.timestamp <= ?
        ORDER BY s.timestamp DESC, ps.cpu_percent DESC
      `).all(fromMs, toMs);
      const csvHeader = 'snapshot_id,timestamp,battery_percent,cpu_total,memory_used_mb,process_name,process_pid,process_cpu,process_mem';
      const csvRows = rows.map((r: any) => [
        r.snapshot_id,
        new Date(r.timestamp).toISOString(),
        r.battery_percent ?? '',
        r.cpu_total ?? '',
        r.memory_used_mb ?? '',
        r.process_name ?? '',
        r.process_pid ?? '',
        r.process_cpu ?? '',
        r.process_mem ?? ''
      ].map(v => {
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(','));
      const csv = [csvHeader, ...csvRows].join('\n');
      const filename = `procmon-export-${new Date(fromMs).toISOString().slice(0,10)}_to_${new Date(toMs).toISOString().slice(0,10)}.csv`;
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(csv);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/export/json') {
    try {
      const fromISO = url.searchParams.get('from') || '';
      const toISO = url.searchParams.get('to') || '';
      const fromMs = fromISO ? new Date(fromISO).getTime() : 0;
      const toMs = toISO ? new Date(toISO).getTime() : Date.now();
      if (isNaN(fromMs) || isNaN(toMs)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid from/to date' }));
        return;
      }
      const rows = db.db.prepare(`
        SELECT
          s.id AS snapshot_id,
          s.timestamp,
          s.battery_percent,
          s.cpu_total,
          s.memory_used_mb,
          ps.name AS process_name,
          ps.pid AS process_pid,
          ps.cpu_percent AS process_cpu,
          ps.memory_percent AS process_mem
        FROM snapshots s
        LEFT JOIN process_samples ps ON ps.snapshot_id = s.id
        WHERE s.timestamp >= ? AND s.timestamp <= ?
        ORDER BY s.timestamp DESC, ps.cpu_percent DESC
      `).all(fromMs, toMs);
      const result = {
        exportedAt: new Date().toISOString(),
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        count: rows.length,
        data: rows,
      };
      const filename = `procmon-export-${new Date(fromMs).toISOString().slice(0,10)}_to_${new Date(toMs).toISOString().slice(0,10)}.json`;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/db-size') {
    try {
      const stats = db.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sizeMB: (stats.dbSizeBytes / (1024 * 1024)).toFixed(2) }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/server-info') {
    try {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ uptime, uptimeStr }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // ─── Device Identity ───
  if (pathname === '/api/identity') {
    try {
      const identity = getIdentity();
      const hosts = getAllHosts(req.headers.host);
      const baseEndpoints: Record<string, string> = {
        metrics: '/api/metrics',
        register: '/api/devices/register',
      };
      const endpoints: Record<string, Record<string, string>> = { local: {} };
      
      // Build endpoint sets for each available network
      for (const [key, path] of Object.entries(baseEndpoints)) {
        endpoints.local[key] = `http://localhost:${PORT}${path}`;
        if (hosts.lan) {
          if (!endpoints.lan) endpoints.lan = {};
          endpoints.lan[key] = `http://${hosts.lan}:${PORT}${path}`;
        }
        if (hosts.tailscale) {
          if (!endpoints.tailscale) endpoints.tailscale = {};
          endpoints.tailscale[key] = `http://${hosts.tailscale}:${PORT}${path}`;
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        did: identity.did,
        name: identity.name,
        version: identity.version,
        platform: identity.platform,
        hosts,
        endpoints,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/metrics') {
    try {
      const since = url.searchParams.get('since') || '';
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const identity = getIdentity();
      const sinceMs = since ? new Date(since).getTime() : 0;

      const snapshots = db.db.prepare(`
        SELECT * FROM snapshots
        WHERE timestamp >= ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(sinceMs, limit);

      const battery = db.db.prepare(`
        SELECT timestamp, battery_percent, is_charging
        FROM snapshots
        WHERE timestamp >= ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(sinceMs, limit);

      const processes = db.db.prepare(`
        SELECT ps.name, ps.pid, ps.cpu_percent, ps.memory_percent, ps.rss_mb, s.timestamp
        FROM process_samples ps
        JOIN snapshots s ON ps.snapshot_id = s.id
        WHERE s.timestamp >= ?
        ORDER BY s.timestamp DESC, ps.cpu_percent DESC
        LIMIT ?
      `).all(sinceMs, limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        device: { did: identity.did, name: identity.name },
        snapshots,
        battery,
        processes,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/qr') {
    try {
      const identity = getIdentity();
      const hosts = getAllHosts(req.headers.host);
      const payload = JSON.stringify({
        did: identity.did,
        name: identity.name,
        version: identity.version,
        platform: identity.platform,
        hosts,
        endpoints: {
          local: {
            metrics: `http://localhost:${PORT}/api/metrics`,
            register: `http://localhost:${PORT}/api/devices/register`,
          },
          ...(hosts.lan ? {
            lan: {
              metrics: `http://${hosts.lan}:${PORT}/api/metrics`,
              register: `http://${hosts.lan}:${PORT}/api/devices/register`,
            }
          } : {}),
          ...(hosts.tailscale ? {
            tailscale: {
              metrics: `http://${hosts.tailscale}:${PORT}/api/metrics`,
              register: `http://${hosts.tailscale}:${PORT}/api/devices/register`,
            }
          } : {}),
        },
      });
      const svg = await QRCode.toString(payload, { type: 'svg', margin: 2, width: 256 });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/restart' && req.method === 'POST') {
    try {
      // Spawn monitor restart in background
      const { exec } = require('child_process');
      exec(`pkill -f "tsx.*src/main.ts" && sleep 2 && cd "${process.cwd()}" && nohup npx tsx src/main.ts > logs/monitor.log 2> logs/monitor-error.log &`, {
        env: { ...process.env, HOME: process.env.HOME || '/tmp' }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Monitor restart initiated. It will be back online in ~5 seconds.' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // ─── Device Registry Endpoints ───
  if (pathname === '/api/devices/register' && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const remoteIp = req.socket.remoteAddress?.replace(/^::ffff:/, '') || payload.ip || 'unknown';
          const metricsPort = payload.port || PORT;
          const device = deviceRegistry.register({
            id: payload.id || payload.did || `device_${Date.now()}`,
            name: payload.name || 'Unknown Device',
            hostname: payload.hostname || 'unknown',
            platform: payload.platform || process.platform,
            arch: payload.arch || process.arch,
            ip: remoteIp,
            version: payload.version,
            endpoint: payload.endpoint || {
              metrics: `http://${remoteIp}:${metricsPort}/api/metrics`,
            },
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, device }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/devices/heartbeat' && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          const device = deviceRegistry.heartbeat(id);
          if (device) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, device }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Device not found' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/devices' && req.method === 'GET') {
    try {
      const devices = deviceRegistry.list().map(d => ({
        ...d,
        isOnline: Date.now() - d.lastSeen < 5 * 60 * 1000, // 5 min threshold
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ devices }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (pathname === '/api/devices' && req.method === 'DELETE') {
    try {
      const id = url.searchParams.get('id');
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing id' }));
        return;
      }
      const removed = deviceRegistry.remove(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: removed }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // ─── Process Tree Endpoint ───
  if (pathname === '/api/process-tree') {
    try {
      const { execSync } = require('child_process');
      const output = execSync('ps -eo pid,ppid,comm,pcpu,pmem,rss', { encoding: 'utf8', timeout: 5000 });
      const lines = output.trim().split('\n');
      const headers = lines[0].trim().split(/\s+/);
      const processes: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Parse: PID PPID COMM %CPU %MEM RSS — COMM may contain spaces but is right-aligned
        // Strategy: extract leading numbers, then the rest
        const match = line.match(/^(\d+)\s+(\d+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)\s+(\d+)$/);
        if (!match) continue;
        processes.push({
          pid: parseInt(match[1], 10),
          ppid: parseInt(match[2], 10),
          name: match[3].trim(),
          cpuPercent: parseFloat(match[4]),
          memoryPercent: parseFloat(match[5]),
          rssKB: parseInt(match[6], 10),
          children: [] as any[],
        });
      }

      // Build tree
      const pidMap = new Map<number, any>();
      for (const p of processes) pidMap.set(p.pid, p);

      const roots: any[] = [];
      for (const p of processes) {
        if (p.ppid === 0 || !pidMap.has(p.ppid)) {
          roots.push(p);
        } else {
          const parent = pidMap.get(p.ppid);
          if (parent) parent.children.push(p);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ processes: roots, total: processes.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // ─── Sleep/Wake Events Endpoint ───
  if (pathname === '/api/sleep-wake-events') {
    try {
      const since = url.searchParams.get('since') || '24h';
      let cutoff: number;
      if (/^\d+$/.test(since)) {
        cutoff = parseInt(since, 10);
      } else {
        const sinceMs = since === '7d' ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
        cutoff = Date.now() - sinceMs;
      }
      const stmt = db.db.prepare(`
        SELECT * FROM sleep_wake_events
        WHERE timestamp > ?
        ORDER BY timestamp ASC
      `);
      const rows = stmt.all(cutoff);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = join(__dirname, '../../web/public', filePath);

  if (existsSync(fullPath)) {
    const ext = fullPath.slice(fullPath.lastIndexOf('.'));
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const content = readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = parseInt(process.env.PORT || '3456', 10);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`[Dashboard] Server running on http://${HOST}:${PORT}`);
  console.log(`[Dashboard] API endpoints:`);
  console.log(`  GET http://<your-ip>:${PORT}/api/snapshot`);
  console.log(`  GET http://<your-ip>:${PORT}/api/history?minutes=60`);
  console.log(`  GET http://<your-ip>:${PORT}/api/drain-events`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Dashboard] Shutting down...');
  db.close();
  server.close(() => process.exit(0));
});
