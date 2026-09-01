import { randomUUID } from 'crypto';
import { SystemSnapshot, WatchdogAlert, WatchdogEvidenceConfig } from '../types/index.js';

/**
 * Emits transition alerts for pressure that can be correlated with a future
 * incident. These are observations only; they do not identify a panic cause.
 */
export class WatchdogAlertDetector {
  private previous: SystemSnapshot | null = null;
  private active = new Set<string>();

  constructor(private readonly config: WatchdogEvidenceConfig) {}

  evaluate(snapshot: SystemSnapshot): WatchdogAlert[] {
    if (!this.config.enabled) return [];
    const now = snapshot.timestamp;
    const host = snapshot.hostEvidence;
    if (!host) return [];
    const alerts: WatchdogAlert[] = [];
    const observe = (key: string, condition: boolean, observation: string, severity: WatchdogAlert['severity'] = 'warning', clearCondition = !condition) => {
      if (condition && !this.active.has(key)) {
        this.active.add(key);
        alerts.push(this.create(key, now, observation, severity, true));
      } else if (clearCondition && this.active.has(key)) {
        this.active.delete(key);
      }
    };

    const pressure = host.memoryPressure?.toLowerCase() || '';
    observe('memory-pressure', pressure.includes('critical') || pressure.includes('warn') ||
      (host.memoryPressurePercent !== null && host.memoryPressurePercent >= this.config.pressureAlertPercent),
      `Observed memory pressure ${host.memoryPressure || 'elevated'}${host.memoryPressurePercent === null ? '' : ` (${host.memoryPressurePercent.toFixed(1)}%)`}. This is correlated pressure, not a panic cause.`,
      pressure.includes('critical') ? 'critical' : 'warning',
      !pressure.includes('critical') && (host.memoryPressurePercent === null || host.memoryPressurePercent <= this.config.pressureAlertPercent * this.config.hysteresisClearRatio));

    const compressedRatio = host.vmStat.compressorBytes !== null && snapshot.memoryUsedMB > 0
      ? host.vmStat.compressorBytes / (snapshot.memoryUsedMB * 1024 * 1024) * 100 : 0;
    observe('compressor-saturation', compressedRatio >= 80,
      `Observed compressor storage at approximately ${compressedRatio.toFixed(1)}% of used memory; this is correlated VM pressure, not a panic cause.`,
      'critical', compressedRatio <= 80 * this.config.hysteresisClearRatio);

    const swapUsed = host.swapUsage.usedBytes;
    const previousSwap = this.previous?.hostEvidence?.swapUsage.usedBytes ?? null;
    const elapsedMinutes = this.previous ? Math.max((now - this.previous.timestamp) / 60000, 1 / 60) : null;
    const swapGrowth = swapUsed !== null && previousSwap !== null && elapsedMinutes !== null
      ? Math.max(0, (swapUsed - previousSwap) / 1024 / 1024 / elapsedMinutes) : 0;
      observe('swap-growth', swapGrowth >= this.config.swapGrowthMBPerMinute,
      `Observed swap usage growth of ${swapGrowth.toFixed(1)} MB/min; this is a correlated VM-pressure observation.`, 'warning', swapGrowth <= this.config.swapGrowthMBPerMinute * this.config.hysteresisClearRatio);

    const vm = host.vmStat;
    const previousVm = this.previous?.hostEvidence?.vmStat;
    const paging = previousVm && elapsedMinutes
      ? ((Math.max(0, (vm.pageins || 0) - (previousVm.pageins || 0)) + Math.max(0, (vm.pageouts || 0) - (previousVm.pageouts || 0))) / elapsedMinutes)
      : 0;
    const swapping = previousVm && elapsedMinutes
      ? ((Math.max(0, (vm.swapins || 0) - (previousVm.swapins || 0)) + Math.max(0, (vm.swapouts || 0) - (previousVm.swapouts || 0))) / elapsedMinutes)
      : 0;
    observe('paging', paging + swapping >= this.config.pagingPerMinute,
      `Observed sustained VM paging/swap activity of ${(paging + swapping).toFixed(1)} events/min.`, 'warning', paging + swapping <= this.config.pagingPerMinute * this.config.hysteresisClearRatio);

    const relevant = snapshot.processes.filter(p => p.processGroup && p.processGroup !== 'other');
    for (const process of relevant) {
      const key = `process:${process.pid}`;
      const highCpu = process.cpuPercent >= this.config.relevantCpuPercent;
      const highRss = process.rssMB >= this.config.relevantRssMB;
      observe(key, highCpu || highRss,
        `Observed contributor ${process.processGroup}/${process.executable || process.name} (PID ${process.pid}) at ${process.cpuPercent.toFixed(1)}% CPU and ${process.rssMB.toFixed(1)} MB RSS; correlation is not causation.`,
        highRss && process.cpuPercent >= this.config.relevantCpuPercent ? 'critical' : 'warning',
        process.cpuPercent <= this.config.relevantCpuPercent * this.config.hysteresisClearRatio && process.rssMB <= this.config.relevantRssMB * this.config.hysteresisClearRatio);
    }

    const previousCount = this.previous?.hostEvidence?.processCount;
    const countChange = previousCount ? Math.abs(host.processCount - previousCount) / previousCount * 100 : 0;
    const pidChurn = Math.max(countChange, host.pidChurnPercent || 0);
    observe('process-churn', pidChurn >= this.config.pidChurnPercent,
      `Observed process-count/PID churn of ${pidChurn.toFixed(1)}% (${previousCount ?? 'unknown'} to ${host.processCount}); no process is identified as a cause.`, 'warning', pidChurn <= this.config.pidChurnPercent * this.config.hysteresisClearRatio);

    if (host.sampleGapSeconds !== null && host.sampleGapSeconds > this.config.maxSamplingGapSeconds) {
      alerts.push(this.create('sampling-gap', now,
        `Observed monitor sampling gap of ${host.sampleGapSeconds.toFixed(1)} seconds. Historical coverage may be incomplete.`, 'warning', true));
    }
    this.previous = snapshot;
    return alerts;
  }

  private create(type: string, observedAt: number, observation: string, severity: WatchdogAlert['severity'], active: boolean): WatchdogAlert {
    return {
      id: randomUUID(), type, observedAt, timestampUtc: new Date(observedAt).toISOString(),
      observation, severity, active,
    };
  }
}
