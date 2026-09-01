import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TimeSeriesDB } from './storage/TimeSeriesDB.js';
import { SystemSnapshot } from './types/index.js';

const now = Date.now();
const sample: SystemSnapshot = {
  timestamp: now,
  battery: { timestamp: now, percent: 50, isCharging: false, isPlugged: false, timeRemaining: null, cycleCount: null, temperature: null, health: null },
  hostEvidence: {
    timestampUtc: new Date(now).toISOString(), timestampIst: '2026-01-01 00:00:00', memoryPressure: 'normal', memoryPressurePercent: 5,
    swapUsage: { totalBytes: 16e9, usedBytes: 100, freeBytes: 16e9 - 100, usedPercent: 0 },
    vmStat: { pageSizeBytes: 4096, pagesFree: 1, pagesActive: 1, pagesInactive: 1, pagesWired: 1, pagesCompressed: 1, pagesPurged: 1, pageins: 1, pageouts: 1, swapins: 1, swapouts: 1, compressorBytes: 4096 },
    availableMemoryMB: 100, processCount: 100, relevantProcessCount: 1, uniquePidCount: 100, pidChurnPercent: null, sampleGapSeconds: null,
  },
  processes: [{ pid: 42, ppid: 7, user: 'sage', name: 'Codex', executable: 'Codex', processGroup: 'codex', safeIdentifier: 'codex:Codex', cpuPercent: 1, cpuUserPercent: 0, cpuSystemPercent: 0, memoryPercent: 1, rssMB: 100, vmsMB: 0, nice: 0, state: 'sleeping', elapsed: '00:01:00', cmdline: 'Codex' }],
  cpuTotal: 1, cpuUser: 1, cpuSystem: 0, cpuIdle: 99, memoryTotal: 80, memoryUsedMB: 800, memoryFreeMB: 200, swapUsedMB: 0, swapTotalMB: 16000, loadAvg: 1,
  diskReadIO: null, diskWriteIO: null, diskTotalIO: null, diskReadRate: null, diskWriteRate: null, netRxBytes: null, netTxBytes: null, networkInterfaces: [], fsUsedPercent: null, diskVolumes: [], cpuTemp: null,
  systemInfo: { platform: 'test', distro: 'test', release: '1', arch: 'arm64', hostname: 'test', uptime: 1, bootTime: 1, cpuModel: 'test', cpuCores: 8, cpuThreads: 8 },
};

const dir = mkdtempSync(join(tmpdir(), 'procmon-evidence-'));
try {
  const dbPath = join(dir, 'monitor.db');
  const db = new TimeSeriesDB(dbPath);
  db.insertSnapshot(sample, true);
  const bundle = db.createIncidentBundle('test pressure');
  assert.ok(bundle);
  assert.equal(db.getSnapshotHistory(999).length, 1);
  db.close();
  const reopened = new TimeSeriesDB(dbPath);
  assert.equal(reopened.getSnapshotHistory(60).length, 1);
  const stored = reopened.db.prepare('SELECT cmdline, executable, safe_identifier FROM process_samples').get() as any;
  assert.equal(stored.cmdline, 'Codex');
  assert.equal(stored.safe_identifier, 'codex:Codex');
  reopened.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('WATCHDOG_STORAGE_TESTS_OK');
