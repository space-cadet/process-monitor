#!/usr/bin/env node
/**
 * Gateway Health Checker
 * Analyzes OpenClaw gateway CPU patterns from process-monitor DB.
 * Detects sustained high CPU, error retry loops, and baseline deviations.
 *
 * Usage:
 *   npx tsx src/scripts/check-gateway-health.ts [--hours N] [--alert-threshold N]
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';

interface GatewayHealthResult {
  windowHours: number;
  totalSamples: number;
  avgCpu: number;
  maxCpu: number;
  p95Cpu: number;
  sustainedElevatedMinutes: number;
  baselineStatus: 'healthy' | 'elevated' | 'critical';
  findings: string[];
  recommendations: string[];
}

function parseArgs(): { hours: number; alertThreshold: number; dbPath: string } {
  const args = process.argv.slice(2);
  let hours = 24;
  let alertThreshold = 5; // Alert if sustained >5%
  let dbPath = path.join(os.homedir(), '.procmon', 'monitor.db');

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--hours':
      case '-h':
        hours = parseInt(args[++i], 10);
        break;
      case '--alert-threshold':
      case '-t':
        alertThreshold = parseFloat(args[++i]);
        break;
      case '--db':
      case '-d':
        dbPath = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return { hours, alertThreshold, dbPath };
}

function printHelp(): void {
  console.log(`
Gateway Health Checker

Analyzes OpenClaw gateway CPU usage from process-monitor DB.

Usage: npx tsx src/scripts/check-gateway-health.ts [options]

Options:
  -h, --hours <n>          Analysis window in hours (default: 24)
  -t, --alert-threshold <n>  Sustained CPU% threshold for alerts (default: 5)
  -d, --db <path>          Path to monitor.db (default: ~/.procmon/monitor.db)
      --help               Show this help

Examples:
  npx tsx src/scripts/check-gateway-health.ts
  npx tsx src/scripts/check-gateway-health.ts --hours 6 --alert-threshold 10
`);
}

function connectDB(dbPath: string): Database.Database {
  const resolvedPath = dbPath.replace(/^~/, os.homedir());
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Database not found: ${resolvedPath}`);
  }
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  return db;
}

function analyzeGatewayHealth(
  db: Database.Database,
  hours: number,
  alertThreshold: number
): GatewayHealthResult {
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;

  // Get all node process samples in the window
  const nodeSamples = db
    .prepare(
      `
      SELECT p.name, p.pid, p.cpu_percent, p.memory_percent, p.rss_mb, p.cmdline, s.timestamp
      FROM process_samples p
      JOIN snapshots s ON p.snapshot_id = s.id
      WHERE s.timestamp > ? AND p.name = 'node'
      ORDER BY s.timestamp ASC
      `
    )
    .all(sinceMs) as any[];

  // Auto-detect gateway PID: the node process with highest avg CPU and most samples
  const pidStats: Record<number, { samples: number; avgCpu: number; maxCpu: number }> = {};
  for (const s of nodeSamples) {
    if (!pidStats[s.pid]) {
      pidStats[s.pid] = { samples: 0, avgCpu: 0, maxCpu: 0 };
    }
    pidStats[s.pid].samples++;
    pidStats[s.pid].avgCpu += s.cpu_percent;
    pidStats[s.pid].maxCpu = Math.max(pidStats[s.pid].maxCpu, s.cpu_percent);
  }

  let gatewayPid: number | null = null;
  let bestScore = 0;
  for (const [pid, stats] of Object.entries(pidStats)) {
    const avg = stats.avgCpu / stats.samples;
    // Score: prefer high-CPU, high-sample-count node processes
    const score = avg * Math.log(stats.samples + 1);
    if (score > bestScore) {
      bestScore = score;
      gatewayPid = Number(pid);
    }
  }

  // Also try to cross-reference with live system
  try {
    const livePid = execSync(
      "ps -eo pid,args | grep 'gateway --port 18789' | grep -v grep | awk '{print $1}'",
      { encoding: 'utf-8' }
    ).trim();
    if (livePid) {
      const livePidNum = parseInt(livePid, 10);
      // If the live PID exists in our data, use it
      if (pidStats[livePidNum]) {
        gatewayPid = livePidNum;
      }
    }
  } catch {
    // Ignore live detection errors
  }

  const gatewaySamples = gatewayPid
    ? nodeSamples.filter((s) => s.pid === gatewayPid)
    : [];

  if (gatewaySamples.length === 0) {
    return {
      windowHours: hours,
      totalSamples: 0,
      avgCpu: 0,
      maxCpu: 0,
      p95Cpu: 0,
      sustainedElevatedMinutes: 0,
      baselineStatus: 'healthy',
      findings: ['No gateway process samples found in the analysis window.'],
      recommendations: [
        'Ensure process-monitor is running and collecting data.',
        'Verify the gateway is running on the expected port (18789).',
      ],
    };
  }

  const cpuValues = gatewaySamples.map((s) => s.cpu_percent);
  const sortedCpu = [...cpuValues].sort((a, b) => a - b);
  const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
  const maxCpu = Math.max(...cpuValues);
  const p95Idx = Math.floor(sortedCpu.length * 0.95);
  const p95Cpu = sortedCpu[Math.min(p95Idx, sortedCpu.length - 1)];

  // Detect sustained elevated CPU (consecutive samples above threshold)
  const sampleIntervalSeconds = estimateSampleInterval(gatewaySamples);
  let sustainedMinutes = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  for (const cpu of cpuValues) {
    if (cpu > alertThreshold) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  sustainedMinutes = (maxStreak * sampleIntervalSeconds) / 60;

  // Determine status
  let baselineStatus: 'healthy' | 'elevated' | 'critical' = 'healthy';
  if (sustainedMinutes > 30 || avgCpu > 15) {
    baselineStatus = 'critical';
  } else if (sustainedMinutes > 10 || avgCpu > 8) {
    baselineStatus = 'elevated';
  }

  const findings: string[] = [];
  const recommendations: string[] = [];

  findings.push(
    `Analyzed ${gatewaySamples.length} gateway samples over ${hours}h.`
  );
  findings.push(
    `Avg CPU: ${avgCpu.toFixed(1)}% | Max: ${maxCpu.toFixed(1)}% | P95: ${p95Cpu.toFixed(1)}%`
  );
  findings.push(
    `Longest sustained elevation (>${alertThreshold}%): ${sustainedMinutes.toFixed(1)} min`
  );

  if (baselineStatus === 'critical') {
    findings.push(
      `🔴 CRITICAL: Gateway CPU sustained elevated for ${sustainedMinutes.toFixed(1)} min or avg >15%.`
    );
    recommendations.push(
      'Restart the gateway: openclaw gateway restart'
    );
    recommendations.push(
      'Check gateway logs for error loops: tail -50 ~/Library/Logs/openclaw/gateway.error.log'
    );
    recommendations.push(
      'Check for stuck subagents: openclaw sessions list'
    );
  } else if (baselineStatus === 'elevated') {
    findings.push(
      `🟡 ELEVATED: Gateway CPU higher than normal baseline.`
    );
    recommendations.push(
      'Monitor for another hour to see if it persists.'
    );
    recommendations.push(
      'Check if any cron jobs or subagents are active.'
    );
  } else {
    findings.push(
      `🟢 HEALTHY: Gateway CPU within normal idle range.`
    );
  }

  // Check for error patterns in logs (if accessible)
  findings.push(...checkLogPatterns());

  return {
    windowHours: hours,
    totalSamples: gatewaySamples.length,
    avgCpu,
    maxCpu,
    p95Cpu,
    sustainedElevatedMinutes: sustainedMinutes,
    baselineStatus,
    findings,
    recommendations,
  };
}

function estimateSampleInterval(samples: any[]): number {
  if (samples.length < 2) return 30;
  const totalSpan = samples[samples.length - 1].timestamp - samples[0].timestamp;
  return totalSpan / (samples.length - 1) / 1000;
}

function checkLogPatterns(): string[] {
  const findings: string[] = [];
  try {
    const logPath = path.join(os.homedir(), 'Library', 'Logs', 'openclaw', 'gateway.error.log');
    if (!fs.existsSync(logPath)) return findings;

    const stats = fs.statSync(logPath);
    const recentThreshold = Date.now() - 60 * 60 * 1000; // 1 hour
    if (stats.mtimeMs < recentThreshold) return findings;

    const content = fs.readFileSync(logPath, 'utf-8');
    const recentLines = content.split('\n').slice(-200);

    const errorPatterns = [
      { pattern: /sync failed.*openai/i, name: 'OpenAI memory sync failures' },
      { pattern: /session initialization conflicted/i, name: 'Session conflict loops' },
      { pattern: /spooled update.*failed/i, name: 'Spooled update failures' },
      { pattern: /long-running session/i, name: 'Long-running session warnings' },
    ];

    for (const { pattern, name } of errorPatterns) {
      const count = recentLines.filter((l: string) => pattern.test(l)).length;
      if (count > 0) {
        findings.push(`⚠️ Log pattern: ${count} recent "${name}"`);
      }
    }
  } catch {
    // Ignore log access errors
  }
  return findings;
}

function printReport(result: GatewayHealthResult): void {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║           🔍 Gateway Health Report                           ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║ Window: ${String(result.windowHours + 'h').padEnd(51)} ║`);
  console.log(`║ Samples: ${String(result.totalSamples).padEnd(50)} ║`);
  console.log(`║ Avg CPU: ${String(result.avgCpu.toFixed(1) + '%').padEnd(50)} ║`);
  console.log(`║ Max CPU: ${String(result.maxCpu.toFixed(1) + '%').padEnd(50)} ║`);
  console.log(`║ P95 CPU: ${String(result.p95Cpu.toFixed(1) + '%').padEnd(50)} ║`);
  console.log(`║ Sustained Elevated: ${String(result.sustainedElevatedMinutes.toFixed(1) + ' min').padEnd(40)} ║`);
  console.log(`║ Status: ${String(result.baselineStatus.toUpperCase()).padEnd(51)} ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);

  console.log('\n📋 Findings:');
  for (const finding of result.findings) {
    console.log(`  • ${finding}`);
  }

  if (result.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    for (const rec of result.recommendations) {
      console.log(`  → ${rec}`);
    }
  }
  console.log('');
}

function main(): void {
  try {
    const { hours, alertThreshold, dbPath } = parseArgs();
    const db = connectDB(dbPath);
    const result = analyzeGatewayHealth(db, hours, alertThreshold);
    db.close();
    printReport(result);

    // Exit with non-zero if critical
    process.exit(result.baselineStatus === 'critical' ? 1 : 0);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}

main();
