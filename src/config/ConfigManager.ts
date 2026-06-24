import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { MonitorConfig } from '../types/index.js';

const CONFIG_PATH = join(process.env.HOME || '', '.procmon', 'config.json');

export const DEFAULT_CONFIG: MonitorConfig = {
  sampleIntervalSeconds: 30,
  dbPath: '~/.procmon/monitor.db',
  retentionDays: 30,
  retentionSizeMB: 400,
  logProcesses: true,
  logBattery: true,
  logSpikes: true,
  logBatteryImpact: true,
  alert: {
    enabled: true,
    drainThreshold: 0.5,
    minDuration: 1,
    cooldownMinutes: 5,
  },
  spike: {
    enabled: true,
    thresholds: {
      cpuPercent: 50,
      memoryPercent: 20,
      cpuMultiplier: 3,
      memoryMultiplier: 3,
      minBaselineSamples: 5,
      cooldownSeconds: 60,
    },
    watchedProcesses: [],
    ignoredProcesses: ['kernel_task', 'WindowServer', 'mds', 'mdworker', 'kworker', 'ksoftirqd', 'rcu_preempt', 'migration', 'watchdogd', 'cpuhp', 'khugepaged', 'kcompactd0', 'oom_reaper'],
  },
  batteryImpact: {
    enabled: true,
    analysisWindowMinutes: 5,
    minBatteryDropPercent: 2.0,
    minDurationMinutes: 2,
    scoreDecayHours: 168,
  },
};

export function loadConfig(): MonitorConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      const saved = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...saved };
    }
  } catch (err) {
    console.error('[Config] Failed to load config, using defaults:', (err as Error).message);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: Partial<MonitorConfig>): void {
  try {
    const current = loadConfig();
    const merged = { ...current, ...config };
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error('[Config] Failed to save config:', (err as Error).message);
    throw err;
  }
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
