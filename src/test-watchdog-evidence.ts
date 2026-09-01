import assert from 'node:assert/strict';
import {
  applyProcessEvidence,
  classifyProcess,
  parseMemoryPressure,
  parseProcessTable,
  parseSwapUsage,
  parseVmStat,
} from './core/WatchdogEvidence.js';
import { WatchdogAlertDetector } from './core/WatchdogAlertDetector.js';
import { SystemSnapshot, WatchdogEvidenceConfig } from './types/index.js';
import { MAX_API_RESPONSE_BYTES, serializeBoundedJson } from './core/ResponseLimit.js';

const pressure = parseMemoryPressure('System-wide memory free percentage: 12%\nPages stored in compressor: 88%');
assert.equal(pressure.percent, 88);
const swap = parseSwapUsage('total = 16.00G  used = 2.50G  free = 13.50G  (encrypted)');
assert.equal(Math.round((swap.usedBytes || 0) / 1024 ** 3 * 100) / 100, 2.5);
assert.equal(swap.usedPercent, 15.625);
const vm = parseVmStat(`Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 10.\nPages active: 20.\nPages wired down: 30.\nPages occupied by compressor: 40.\nPageins: 100.\nPageouts: 7.\nSwapins: 3.\nSwapouts: 4.`);
assert.equal(vm.pageSizeBytes, 16384);
assert.equal(vm.compressorBytes, 655360);
assert.equal(vm.swapouts, 4);

const ps = parseProcessTable('42 7 sage 91.2 123456 R 00:03:12 /Applications/Codex.app/Contents/MacOS/Codex');
assert.equal(ps[0].processGroup, 'codex');
assert.equal(ps[0].executable, 'Codex');
assert.equal(classifyProcess('magick'), 'imagemagick');
const sanitized = applyProcessEvidence([{
  pid: 42, name: 'Codex', cpuPercent: 91.2, cpuUserPercent: 0, cpuSystemPercent: 0,
  memoryPercent: 1, rssMB: 120, vmsMB: 0, nice: 0, state: 'running',
  cmdline: 'secret prompt token=abc',
}], ps);
assert.equal(sanitized[0].cmdline, 'Codex');
assert.equal(sanitized[0].safeIdentifier, 'codex:Codex');
assert.equal(serializeBoundedJson({ samples: Array.from({ length: 240 }, (_, i) => ({ timestamp: i, vmPagesCompressed: i })) }).tooLarge, false);
assert.equal(serializeBoundedJson('x'.repeat(MAX_API_RESPONSE_BYTES + 1)).tooLarge, true);

const config: WatchdogEvidenceConfig = {
  enabled: true, incidentHistoryMinutes: 60, maxHistorySamples: 240,
  pressureAlertPercent: 85, swapGrowthMBPerMinute: 10, pagingPerMinute: 10,
  relevantCpuPercent: 80, relevantRssMB: 1000, pidChurnPercent: 35,
  maxSamplingGapSeconds: 45, hysteresisClearRatio: 0.8,
};
const detector = new WatchdogAlertDetector(config);
const snapshot = (timestamp: number, pressurePercent: number, swapUsed: number): SystemSnapshot => ({
  timestamp,
  battery: { timestamp, percent: 50, isCharging: false, isPlugged: false, timeRemaining: null, cycleCount: null, temperature: null, health: null },
  hostEvidence: {
    timestampUtc: new Date(timestamp).toISOString(), timestampIst: '2026-01-01 00:00:00',
    memoryPressure: 'elevated', memoryPressurePercent: pressurePercent,
    swapUsage: { totalBytes: 16e9, usedBytes: swapUsed, freeBytes: 16e9 - swapUsed, usedPercent: swapUsed / 16e7 },
    vmStat: { pageSizeBytes: 4096, pagesFree: 1, pagesActive: 1, pagesInactive: 1, pagesWired: 1, pagesCompressed: 1, pagesPurged: 1, pageins: 1, pageouts: 1, swapins: 1, swapouts: 1, compressorBytes: 1 },
    availableMemoryMB: 100, processCount: 100, relevantProcessCount: 1, uniquePidCount: 100, pidChurnPercent: null,
    sampleGapSeconds: null,
  },
  processes: [{ pid: 42, name: 'Codex', executable: 'Codex', processGroup: 'codex', safeIdentifier: 'codex:Codex', cpuPercent: 1, cpuUserPercent: 0, cpuSystemPercent: 0, memoryPercent: 1, rssMB: 100, vmsMB: 0, nice: 0, state: 'sleeping', cmdline: 'Codex' }],
  cpuTotal: 1, cpuUser: 1, cpuSystem: 0, cpuIdle: 99, memoryTotal: 80, memoryUsedMB: 800, memoryFreeMB: 200, swapUsedMB: swapUsed / 1024 / 1024, swapTotalMB: 16000, loadAvg: 1,
  diskReadIO: null, diskWriteIO: null, diskTotalIO: null, diskReadRate: null, diskWriteRate: null, netRxBytes: null, netTxBytes: null, networkInterfaces: [], fsUsedPercent: null, diskVolumes: [], cpuTemp: null,
  systemInfo: { platform: 'test', distro: 'test', release: '1', arch: 'arm64', hostname: 'test', uptime: 1, bootTime: 1, cpuModel: 'test', cpuCores: 8, cpuThreads: 8 },
});
assert.equal(detector.evaluate(snapshot(100000, 90, 100 * 1024 * 1024)).length, 1);
assert.equal(detector.evaluate(snapshot(101000, 90, 200 * 1024 * 1024)).length, 1); // swap growth transition only once
assert.equal(detector.evaluate(snapshot(102000, 60, 210 * 1024 * 1024)).length, 0); // hysteresis clears without a recovery alert
const gap = snapshot(103000, 60, 220 * 1024 * 1024);
gap.hostEvidence!.sampleGapSeconds = 60;
assert.equal(detector.evaluate(gap).some(alert => alert.type === 'sampling-gap'), true);

console.log('WATCHDOG_EVIDENCE_TESTS_OK');
