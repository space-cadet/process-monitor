import { SystemSnapshot, DrainEvent, ProcessSnapshot } from '../types/index.js';

/**
 * Analyzes system snapshots to detect rapid battery drain.
 * Correlates drain events with CPU-intensive processes.
 */
export class DrainAnalyzer {
  private samples: SystemSnapshot[] = [];
  private readonly maxSamples: number;
  private lastAlertTime: number = 0;

  constructor(windowMinutes: number = 5, sampleIntervalSeconds: number = 30) {
    // Keep enough samples for the analysis window
    this.maxSamples = Math.ceil((windowMinutes * 60) / sampleIntervalSeconds) + 1;
  }

  addSample(sample: SystemSnapshot): void {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /**
   * Check if battery is draining rapidly.
   * Returns a DrainEvent if drain rate exceeds threshold, null otherwise.
   */
  analyze(
    drainThresholdPercentPerMinute: number = 1.0,
    minDurationMinutes: number = 2,
    alertCooldownMinutes: number = 10
  ): DrainEvent | null {
    if (this.samples.length < 2) return null;

    const now = Date.now();
    const cooldownMs = alertCooldownMinutes * 60 * 1000;
    if (now - this.lastAlertTime < cooldownMs) return null;

    const oldest = this.samples[0];
    const newest = this.samples[this.samples.length - 1];

    // Skip if charging
    if (newest.battery.isCharging || newest.battery.isPlugged) return null;

    const durationMinutes = (newest.timestamp - oldest.timestamp) / 60000;
    if (durationMinutes < minDurationMinutes) return null;

    const percentDrop = oldest.battery.percent - newest.battery.percent;
    if (percentDrop <= 0) return null;

    const drainRate = percentDrop / durationMinutes;
    if (drainRate < drainThresholdPercentPerMinute) return null;

    // Find top CPU processes during the drain window
    const topProcesses = this.findTopProcessesDuringDrain();

    const event: DrainEvent = {
      id: this.generateId(),
      startTime: oldest.timestamp,
      endTime: newest.timestamp,
      startPercent: oldest.battery.percent,
      endPercent: newest.battery.percent,
      drainRate,
      durationMinutes,
      topProcesses,
      wasCharging: false,
    };

    this.lastAlertTime = now;
    return event;
  }

  private findTopProcessesDuringDrain(): ProcessSnapshot[] {
    // Aggregate CPU usage per process across all samples
    const processCpuMap = new Map<number, { name: string; totalCpu: number; count: number; cmdline: string }>();

    for (const sample of this.samples) {
      for (const proc of sample.processes) {
        const existing = processCpuMap.get(proc.pid);
        if (existing) {
          existing.totalCpu += proc.cpuPercent;
          existing.count++;
        } else {
          processCpuMap.set(proc.pid, {
            name: proc.name,
            totalCpu: proc.cpuPercent,
            count: 1,
            cmdline: proc.cmdline,
          });
        }
      }
    }

    // Convert to ProcessSnapshot with average CPU
    const averaged = Array.from(processCpuMap.entries()).map(([pid, data]) => ({
      pid,
      name: data.name,
      cpuPercent: Math.round((data.totalCpu / data.count) * 100) / 100,
      memoryPercent: 0, // Not aggregated here
      rssMB: 0,
      vmsMB: 0,
      cmdline: data.cmdline,
    }));

    return averaged.sort((a, b) => b.cpuPercent - a.cpuPercent).slice(0, 5);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  getSampleCount(): number {
    return this.samples.length;
  }

  getWindowDurationMinutes(): number {
    if (this.samples.length < 2) return 0;
    return (this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp) / 60000;
  }
}
