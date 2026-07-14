#!/usr/bin/env node
/**
 * Anomaly Checker — Lightweight Edition
 * On-demand anomaly detection for process-monitor data.
 * Optimized for large databases with 70K+ snapshots.
 *
 * Usage:
 *   npx tsx src/scripts/check-anomalies.ts [--hours N] [--quiet]
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';

interface Anomaly {
  type: 'cpu_spike' | 'battery_drain' | 'memory_growth' | 'gateway_elevated';
  severity: 'info' | 'warning' | 'critical';
  processName: string;
  description: string;
  timestamp: number;
  value: number;
  baseline: number;
}

interface CheckResult {
  windowHours: number;
  anomalies: Anomaly[];
  summary: string;
}

// Processes that legitimately spike CPU — don't flag these
const KNOWN_HIGH_CPU_PROCESSES = [
  'z2-lattice-gauge',
  't20-z2-lgt-phase1-main.cjs',
  'z2-lgt',
  'julia',
  'mathematica',
  'matlab',
];

// System processes that can have brief spikes — exclude from alerts
const SYSTEM_PROCESSES = [
  'top', 'ps', 'sqlite3', 'kernel_task', 'WindowServer', 'replayd',
  'iconservicesagent', 'syspolicyd', 'fontd', 'MTLCompilerService',
  'BackgroundShortcutRunner', 'plugin-container', 'pandoc',
];

function parseArgs(): { hours: number; dbPath: string; quiet: boolean; minSeverity: string } {
  const args = process.argv.slice(2);
  let hours = 6;
  let dbPath = path.join(os.homedir(), '.procmon', 'monitor.db');
  let quiet = false;
  let minSeverity = 'info';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--hours':
      case '-h':
        hours = parseInt(args[++i], 10);
        break;
      case '--db':
      case '-d':
        dbPath = args[++i];
        break;
      case '--quiet':
      case '-q':
        quiet = true;
        break;
      case '--severity':
      case '-s':
        minSeverity = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return { hours, dbPath, quiet, minSeverity };
}

function printHelp(): void {
  console.log(`
Anomaly Checker (Lightweight)

Detects unusual system behavior from process-monitor DB.
Optimized for large datasets (70K+ snapshots).

Usage: npx tsx src/scripts/check-anomalies.ts [options]

Options:
  -h, --hours <n>       Analysis window in hours (default: 6)
  -d, --db <path>       Path to monitor.db (default: ~/.procmon/monitor.db)
  -q, --quiet           Only output anomalies, no summary
  -s, --severity <lvl>  Minimum severity: info, warning, critical (default: info)
      --help            Show this help

Examples:
  npx tsx src/scripts/check-anomalies.ts              # Check last 6 hours
  npx tsx src/scripts/check-anomalies.ts --hours 1    # Check last hour
  npx tsx src/scripts/check-anomalies.ts --severity warning --quiet
`);
}

function connectDB(dbPath: string): Database.Database {
  const resolvedPath = dbPath.replace(/^~/, os.homedir());
  if (!require('fs').existsSync(resolvedPath)) {
    throw new Error(`Database not found: ${resolvedPath}`);
  }
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  return db;
}

function checkAnomalies(db: Database.Database, hours: number): CheckResult {
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  const anomalies: Anomaly[] = [];

  // 1. Gateway elevation check
  anomalies.push(...checkGatewayElevation(db, sinceMs));

  // 2. Process CPU spikes
  anomalies.push(...checkProcessSpikes(db, sinceMs));

  // 3. Memory growth
  anomalies.push(...checkMemoryGrowth(db, sinceMs));

  // 4. Battery drain
  anomalies.push(...checkBatteryDrain(db, sinceMs));

  // Sort by severity then timestamp
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.timestamp - a.timestamp;
  });

  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;
  const infoCount = anomalies.filter((a) => a.severity === 'info').length;

  const summary =
    criticalCount > 0
      ? `🔴 ${criticalCount} critical, ${warningCount} warning, ${infoCount} info`
      : warningCount > 0
        ? `🟡 ${warningCount} warning, ${infoCount} info`
        : `🟢 ${infoCount} info`;

  return { windowHours: hours, anomalies, summary };
}

function checkGatewayElevation(db: Database.Database, sinceMs: number): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // FAST: Subquery instead of JOIN (100x speedup on large DBs)
  const rows = db
    .prepare(
      `
      SELECT p.pid,
             ROUND(AVG(p.cpu_percent), 1) as avg_cpu,
             ROUND(MAX(p.cpu_percent), 1) as max_cpu,
             COUNT(*) as samples
      FROM process_samples p
      WHERE p.snapshot_id IN (SELECT id FROM snapshots WHERE timestamp > ?)
        AND p.name = 'node'
      GROUP BY p.pid
      ORDER BY avg_cpu DESC
      LIMIT 3
      `
    )
    .all(sinceMs) as any[];

  if (!rows || rows.length === 0) return anomalies;

  const gateway = rows[0];
  
  // Get latest timestamp for this PID (fast single-row lookup)
  const latestRow = db
    .prepare(`
      SELECT MAX(timestamp) as latest_ts FROM snapshots 
      WHERE id = (SELECT snapshot_id FROM process_samples WHERE pid = ? ORDER BY id DESC LIMIT 1)
    `)
    .get(gateway.pid) as any;
  const latestTs = (latestRow?.latest_ts as number) || Date.now();
  
  const avgCpu = gateway.avg_cpu;
  const maxCpu = gateway.max_cpu;

  if (avgCpu > 15 && gateway.samples > 5) {
    anomalies.push({
      type: 'gateway_elevated',
      severity: 'critical',
      processName: 'openclaw-gateway',
      description: `Gateway (PID ${gateway.pid}) avg CPU ${avgCpu}% over ${gateway.samples} samples — likely error retry loop`,
      timestamp: latestTs,
      value: avgCpu,
      baseline: 2,
    });
  } else if (avgCpu > 8 && gateway.samples > 5) {
    anomalies.push({
      type: 'gateway_elevated',
      severity: 'warning',
      processName: 'openclaw-gateway',
      description: `Gateway (PID ${gateway.pid}) avg CPU ${avgCpu}% — above normal idle baseline`,
      timestamp: latestTs,
      value: avgCpu,
      baseline: 2,
    });
  }

  if (maxCpu > 50 && avgCpu <= 15) {
    anomalies.push({
      type: 'gateway_elevated',
      severity: 'warning',
      processName: 'openclaw-gateway',
      description: `Gateway spiked to ${maxCpu}% CPU — check for stuck work`,
      timestamp: latestTs,
      value: maxCpu,
      baseline: 10,
    });
  }

  return anomalies;
}

function checkProcessSpikes(db: Database.Database, sinceMs: number): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // FAST: Subquery instead of JOIN
  const rows = db
    .prepare(
      `
      SELECT p.name,
             ROUND(AVG(p.cpu_percent), 1) as avg_cpu,
             ROUND(MAX(p.cpu_percent), 1) as max_cpu,
             COUNT(*) as samples
      FROM process_samples p
      WHERE p.snapshot_id IN (SELECT id FROM snapshots WHERE timestamp > ?)
        AND p.cpu_percent > 10
        AND p.name NOT IN ('node', 'kernel_task', 'WindowServer', 'replayd', 'top', 'ps', 'sqlite3')
      GROUP BY p.name
      HAVING avg_cpu > 20 AND samples > 3
      ORDER BY avg_cpu DESC
      LIMIT 10
      `
    )
    .all(sinceMs) as any[];

  for (const row of rows) {
    const nameLower = row.name.toLowerCase();
    const isKnown = KNOWN_HIGH_CPU_PROCESSES.some((p) => nameLower.includes(p.toLowerCase()));
    const isSystem = SYSTEM_PROCESSES.some((p) => nameLower.includes(p.toLowerCase()));
    if (isKnown || isSystem) continue;

    const severity = row.avg_cpu > 30 ? 'critical' : 'warning';
    anomalies.push({
      type: 'cpu_spike',
      severity,
      processName: row.name,
      description: `${row.name}: avg ${row.avg_cpu}% CPU, max ${row.max_cpu}% (${row.samples} samples)`,
      timestamp: Date.now(),
      value: row.avg_cpu,
      baseline: 5,
    });
  }

  return anomalies;
}

function checkMemoryGrowth(db: Database.Database, sinceMs: number): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // FAST: Subquery instead of JOIN
  const rows = db
    .prepare(
      `
      SELECT p.name,
             ROUND(MIN(p.rss_mb), 0) as min_rss,
             ROUND(MAX(p.rss_mb), 0) as max_rss,
             ROUND(MAX(p.rss_mb) - MIN(p.rss_mb), 0) as growth_mb
      FROM process_samples p
      WHERE p.snapshot_id IN (SELECT id FROM snapshots WHERE timestamp > ?)
        AND p.rss_mb > 100
      GROUP BY p.name
      HAVING growth_mb > 1000
      ORDER BY growth_mb DESC
      LIMIT 5
      `
    )
    .all(sinceMs) as any[];

  for (const row of rows) {
    anomalies.push({
      type: 'memory_growth',
      severity: row.growth_mb > 3000 ? 'warning' : 'info',
      processName: row.name,
      description: `${row.name}: memory grew ${row.growth_mb} MB (${row.min_rss} → ${row.max_rss} MB)`,
      timestamp: Date.now(),
      value: row.growth_mb,
      baseline: 500,
    });
  }

  return anomalies;
}

function checkBatteryDrain(db: Database.Database, sinceMs: number): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // No JOIN needed — direct snapshots query
  const snapshots = db
    .prepare(
      `
      SELECT timestamp, battery_percent
      FROM snapshots
      WHERE timestamp > ? AND is_charging = 0
      ORDER BY timestamp ASC
      `
    )
    .all(sinceMs) as any[];

  if (snapshots.length < 10) return anomalies;

  // Simple sliding window for steep drops
  for (let i = 6; i < snapshots.length; i += 3) {
    const drop = snapshots[i - 6].battery_percent - snapshots[i].battery_percent;
    const timeSpanMin = (snapshots[i].timestamp - snapshots[i - 6].timestamp) / (1000 * 60);

    if (timeSpanMin > 10 && drop > 3) {
      const rate = drop / (timeSpanMin / 60); // % per hour
      if (rate > 8) {
        anomalies.push({
          type: 'battery_drain',
          severity: rate > 15 ? 'critical' : 'warning',
          processName: 'system',
          description: `Battery dropped ${drop.toFixed(1)}% in ${(timeSpanMin / 60).toFixed(1)}h (${rate.toFixed(1)}%/h)`,
          timestamp: snapshots[i].timestamp,
          value: rate,
          baseline: 3,
        });
        i += 6; // Skip to avoid duplicates
      }
    }
  }

  return anomalies;
}

function formatAnomaly(a: Anomaly): string {
  const sevIcon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵';
  return `${sevIcon} [${a.type}] ${a.processName} — ${a.description}`;
}

function printResults(result: CheckResult, quiet: boolean, minSeverity: string): void {
  if (!quiet) {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║           🔍 Anomaly Report — Last ${String(result.windowHours + 'h').padEnd(28)} ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║ ${result.summary.padEnd(60)} ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝`);
  }

  const severityFilter = { critical: 0, warning: 1, info: 2 };
  const minLevel = severityFilter[minSeverity as keyof typeof severityFilter] ?? 0;

  const filtered = result.anomalies.filter(
    (a) => severityFilter[a.severity] <= minLevel
  );

  if (filtered.length === 0) {
    if (!quiet) console.log('\n✅ No anomalies detected at or above the specified severity.');
    return;
  }

  if (!quiet) console.log('');
  for (const anomaly of filtered) {
    console.log(formatAnomaly(anomaly));
  }

  if (!quiet) console.log('');
}

function main(): void {
  try {
    const { hours, dbPath, quiet, minSeverity } = parseArgs();
    const db = connectDB(dbPath);
    const result = checkAnomalies(db, hours);
    db.close();
    printResults(result, quiet, minSeverity);

    const criticalCount = result.anomalies.filter((a) => a.severity === 'critical').length;
    process.exit(criticalCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}

main();
