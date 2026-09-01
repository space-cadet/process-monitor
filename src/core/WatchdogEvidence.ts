import { execFileSync } from 'child_process';
import {
  HostEvidence,
  ProcessSnapshot,
  SwapUsageEvidence,
  VmStatEvidence,
} from '../types/index.js';

export const RELEVANT_PROCESS_GROUPS = [
  'codex', 'chatgpt', 'openclaw', 'node', 'imagemagick', 'windowserver', 'process-monitor',
] as const;

export type RelevantProcessGroup = typeof RELEVANT_PROCESS_GROUPS[number] | 'other';

export function safeExecutableName(value: string): string {
  const cleaned = value.trim().split(/[\\/]/).pop() || 'unknown';
  return cleaned.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'unknown';
}

export function classifyProcess(name: string, executable = name): RelevantProcessGroup {
  const text = `${name} ${executable}`.toLowerCase();
  if (text.includes('process-monitor') || text.includes('procmon')) return 'process-monitor';
  if (text.includes('openclaw')) return 'openclaw';
  if (text.includes('chatgpt')) return 'chatgpt';
  if (text.includes('codex')) return 'codex';
  if (text.includes('imagemagick') || text.includes('magick')) return 'imagemagick';
  if (text.includes('windowserver')) return 'windowserver';
  if (/(^|[\s/_-])node(?:$|[\s._-]|\d)/.test(text)) return 'node';
  return 'other';
}

export function isRelevantProcess(name: string, executable = name): boolean {
  return classifyProcess(name, executable) !== 'other';
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bytesFromUnit(value: string, unit: string): number | null {
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  const normalized = unit.toLowerCase();
  const multiplier: Record<string, number> = { '': 1, b: 1, k: 1024, kb: 1024, m: 1024 ** 2, mb: 1024 ** 2, g: 1024 ** 3, gb: 1024 ** 3, t: 1024 ** 4, tb: 1024 ** 4 };
  return number * (multiplier[normalized] || 1);
}

export function parseSwapUsage(output: string): SwapUsageEvidence {
  const match = output.match(/total\s*=\s*([\d.]+)\s*([KMGTP]?B?)\s+used\s*=\s*([\d.]+)\s*([KMGTP]?B?)\s+free\s*=\s*([\d.]+)\s*([KMGTP]?B?)/i);
  if (!match) return { totalBytes: null, usedBytes: null, freeBytes: null, usedPercent: null };
  const totalBytes = bytesFromUnit(match[1], match[2]);
  const usedBytes = bytesFromUnit(match[3], match[4]);
  const freeBytes = bytesFromUnit(match[5], match[6]);
  return {
    totalBytes,
    usedBytes,
    freeBytes,
    usedPercent: totalBytes && usedBytes !== null ? (usedBytes / totalBytes) * 100 : null,
  };
}

export function parseMemoryPressure(output: string): { level: string | null; percent: number | null } {
  const normalized = output.replace(/\s+/g, ' ');
  const levelMatch = normalized.match(/(?:pressure|level)\s*[:=]\s*([A-Za-z]+)/i)
    || normalized.match(/(?:normal|warn(?:ing)?|critical|critical\s+pressure)/i);
  const percentMatch = normalized.match(/(?:free|pressure|critical|available)[^\d]{0,30}(\d+(?:\.\d+)?)\s*%/i);
  const level = levelMatch?.[1] || levelMatch?.[0] || null;
  const rawPercent = percentMatch ? Number(percentMatch[1]) : null;
  // memory_pressure reports free percentage. Convert that to pressure
  // percentage so the stored field has one unambiguous meaning.
  const percent = rawPercent === null ? null : /free|available/i.test(percentMatch?.[0] || '') ? 100 - rawPercent : rawPercent;
  return { level: level ? level.toLowerCase() : null, percent };
}

export function parseVmStat(output: string): VmStatEvidence {
  const pageSize = output.match(/page size of\s+(\d+)\s+bytes/i);
  const values = new Map<string, number>();
  for (const line of output.split('\n')) {
    const match = line.match(/^([^:]+):\s*(\d+)\./);
    if (match) values.set(match[1].trim().toLowerCase(), Number(match[2]));
  }
  const get = (...names: string[]) => {
    for (const name of names) {
      const value = values.get(name);
      if (value !== undefined) return value;
    }
    return null;
  };
  const pageSizeBytes = pageSize ? Number(pageSize[1]) : null;
  return {
    pageSizeBytes,
    pagesFree: get('pages free'),
    pagesActive: get('pages active'),
    pagesInactive: get('pages inactive'),
    pagesWired: get('pages wired down', 'pages wired'),
    pagesCompressed: get('pages occupied by compressor', 'pages occupied by compressor'),
    pagesPurged: get('pages purged'),
    pageins: get('pageins'),
    pageouts: get('pageouts'),
    swapins: get('swapins'),
    swapouts: get('swapouts'),
    compressorBytes: pageSizeBytes !== null && get('pages occupied by compressor') !== null
      ? pageSizeBytes * (get('pages occupied by compressor') as number)
      : null,
  };
}

export interface PsEvidenceRow {
  pid: number;
  ppid: number | null;
  user: string;
  cpuPercent: number;
  rssKB: number;
  state: string;
  elapsed: string;
  executable: string;
  processGroup: RelevantProcessGroup;
}

/** Parse the fixed, argument-free ps format used by the collector. */
export function parseProcessTable(output: string): PsEvidenceRow[] {
  return output.split('\n').map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8 || !/^\d+$/.test(parts[0])) return null;
    const executable = safeExecutableName(parts.slice(7).join(' '));
    return {
      pid: Number(parts[0]),
      ppid: numberOrNull(parts[1]),
      user: safeExecutableName(parts[2]),
      cpuPercent: numberOrNull(parts[3]) || 0,
      rssKB: numberOrNull(parts[4]) || 0,
      state: safeExecutableName(parts[5]),
      elapsed: parts[6].slice(0, 32),
      executable,
      processGroup: classifyProcess(executable),
    } as PsEvidenceRow;
  }).filter(Boolean) as PsEvidenceRow[];
}

export function collectHostEvidence(previousTimestamp: number | null, relevantProcessCount: number, processCount: number, uniquePidCount: number, pidChurnPercent: number | null = null): HostEvidence {
  const now = new Date();
  const timestampUtc = now.toISOString();
  const timestampIst = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(',', '');
  const swap = runCommand('sysctl', ['-n', 'vm.swapusage']) || '';
  const vm = runCommand('vm_stat', []) || '';
  const pressure = runCommand('memory_pressure', ['-Q']) || runCommand('memory_pressure', []) || '';
  const memoryPressure = parseMemoryPressure(pressure);
  const vmStat = parseVmStat(vm);
  const swapUsage = parseSwapUsage(swap);
  const gap = previousTimestamp === null ? null : Math.max(0, (Date.now() - previousTimestamp) / 1000);
  return {
    timestampUtc,
    timestampIst,
    memoryPressure: memoryPressure.level,
    memoryPressurePercent: memoryPressure.percent,
    swapUsage,
    vmStat,
    availableMemoryMB: null,
    processCount,
    relevantProcessCount,
    uniquePidCount,
    pidChurnPercent,
    sampleGapSeconds: gap,
  };
}

function runCommand(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 });
  } catch {
    return null;
  }
}

export function collectPsEvidence(): PsEvidenceRow[] {
  const output = runCommand('ps', ['-axo', 'pid=,ppid=,user=,pcpu=,rss=,state=,etime=,comm=']) || '';
  return parseProcessTable(output);
}

export function applyProcessEvidence(processes: ProcessSnapshot[], rows: PsEvidenceRow[]): ProcessSnapshot[] {
  const byPid = new Map(rows.map(row => [row.pid, row]));
  return processes.map(process => {
    const row = byPid.get(process.pid);
    const executable = safeExecutableName(row?.executable || process.name);
    const group = row?.processGroup || classifyProcess(process.name, executable);
    return {
      ...process,
      ppid: row?.ppid ?? null,
      user: row?.user || 'unknown',
      executable,
      processGroup: group,
      safeIdentifier: group === 'other' ? null : `${group}:${executable}`,
      elapsed: row?.elapsed || undefined,
      state: row?.state || process.state || 'unknown',
      // Keep the legacy field for compatibility, but never put arguments in it.
      cmdline: executable,
    };
  });
}
