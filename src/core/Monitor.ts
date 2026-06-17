import { SystemCollector } from './SystemCollector.js';
import { DrainAnalyzer } from './DrainAnalyzer.js';
import { SpikeDetector } from './SpikeDetector.js';
import { BatteryImpactAnalyzer } from './BatteryImpactAnalyzer.js';
import { AlertSender } from './AlertSender.js';
import { TimeSeriesDB } from '../storage/TimeSeriesDB.js';
import { MonitorConfig, DrainEvent, ProcessSpike, BatteryImpactEvent } from '../types/index.js';
import { loadConfig } from '../config/ConfigManager.js';
import { statSync } from 'fs';

/**
 * Main monitor orchestrator.
 * Runs the sampling loop, coordinates collector → analyzer → storage → alerts.
 */
export class Monitor {
  private collector: SystemCollector;
  private analyzer: DrainAnalyzer;
  private spikeDetector: SpikeDetector;
  private batteryImpactAnalyzer: BatteryImpactAnalyzer;
  private alertSender: AlertSender;
  private db: TimeSeriesDB;
  private config: MonitorConfig;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private tickCount = 0;

  constructor(config: Partial<MonitorConfig> = {}) {
    // Load from file first, then override with passed config
    const fileConfig = loadConfig();
    this.config = {
      ...fileConfig,
      ...config,
      alert: { ...fileConfig.alert, ...config.alert },
      spike: { ...fileConfig.spike, ...config.spike },
      batteryImpact: { ...fileConfig.batteryImpact, ...config.batteryImpact },
    };

    this.collector = new SystemCollector();
    this.analyzer = new DrainAnalyzer(
      5,  // 5-minute analysis window
      this.config.sampleIntervalSeconds
    );
    this.spikeDetector = new SpikeDetector(
      this.config.spike.thresholds,
      this.config.spike.watchedProcesses,
      this.config.spike.ignoredProcesses
    );
    this.batteryImpactAnalyzer = new BatteryImpactAnalyzer(
      this.config.batteryImpact.minBatteryDropPercent,
      this.config.batteryImpact.minDurationMinutes
    );
    this.db = new TimeSeriesDB(this.config.dbPath);
    this.alertSender = new AlertSender(this.config.alert);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[Monitor] Starting — sampling every ${this.config.sampleIntervalSeconds}s`);
    console.log(`[Monitor] DB: ${this.config.dbPath}`);
    console.log(`[Monitor] Retention: ${this.config.retentionDays} days or ${this.config.retentionSizeMB}MB`);
    console.log(`[Monitor] Logging: battery=${this.config.logBattery}, processes=${this.config.logProcesses}, spikes=${this.config.logSpikes}, impact=${this.config.logBatteryImpact}`);
    console.log(`[Monitor] Alert threshold: ${this.config.alert.drainThreshold}%/min`);

    // Initial sample
    await this.tick();

    // Schedule recurring samples
    this.timer = setInterval(
      () => this.tick(),
      this.config.sampleIntervalSeconds * 1000
    );
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.db.close();
    console.log('[Monitor] Stopped');
  }

  private async tick(): Promise<void> {
    try {
      this.tickCount++;
      console.log(`[Monitor] Tick at ${new Date().toISOString()}`);
      const snapshot = await this.collector.getSystemSnapshot();
      
      // Store in DB (conditionally)
      let snapshotId: number | null = null;
      if (this.config.logBattery) {
        snapshotId = this.db.insertSnapshot(snapshot, this.config.logProcesses);
      }
      
      // Feed to analyzer
      this.analyzer.addSample(snapshot);
      
      // Check for drain
      const event = this.analyzer.analyze(
        this.config.alert.drainThreshold,
        this.config.alert.minDuration,
        this.config.alert.cooldownMinutes
      );
      
      if (event) {
        this.handleDrainEvent(event);
      }

      // Spike detection
      if (this.config.logSpikes && this.config.spike.enabled && snapshotId !== null) {
        const spikes = this.spikeDetector.detectSpikes(snapshot.processes, snapshotId);
        for (const spike of spikes) {
          this.handleSpike(spike);
        }
      }

      // Battery impact analysis
      if (this.config.logBatteryImpact && this.config.batteryImpact.enabled) {
        const impactEvent = this.batteryImpactAnalyzer.addSample(snapshot);
        if (impactEvent) {
          this.handleBatteryImpactEvent(impactEvent);
        }
      }
      
      // Periodic cleanup (every 100 ticks ≈ every 50 min at 30s interval)
      if (this.tickCount % 100 === 0) {
        this.runCleanup();
      }
      
    } catch (err) {
      console.error('[Monitor] Tick error:', err);
    }
  }

  private runCleanup(): void {
    try {
      const stats = this.db.getStats();
      const sizeMB = stats.dbSizeBytes / (1024 * 1024);
      const ageTriggered = stats.oldestSnapshot !== null && 
        (Date.now() - stats.oldestSnapshot) > this.config.retentionDays * 86400000;
      const sizeTriggered = sizeMB > this.config.retentionSizeMB;

      if (ageTriggered || sizeTriggered) {
        console.log(`[Monitor] Auto-cleanup triggered: ${ageTriggered ? 'age' : ''} ${sizeTriggered ? 'size' : ''} (${sizeMB.toFixed(1)}MB)`);
        this.db.cleanupOldSamples(this.config.retentionDays);
        const afterStats = this.db.getStats();
        const freedMB = (stats.dbSizeBytes - afterStats.dbSizeBytes) / (1024 * 1024);
        console.log(`[Monitor] Cleanup complete. Freed ${freedMB.toFixed(1)}MB. Now ${(afterStats.dbSizeBytes / (1024 * 1024)).toFixed(1)}MB`);
      }
    } catch (err) {
      console.error('[Monitor] Cleanup error:', err);
    }
  }

  private handleDrainEvent(event: DrainEvent): void {
    console.log(`\n⚠️  RAPID DRAIN DETECTED`);
    console.log(`   Battery: ${event.startPercent}% → ${event.endPercent}% (${event.drainRate.toFixed(2)}%/min)`);
    console.log(`   Duration: ${event.durationMinutes.toFixed(1)} minutes`);
    console.log(`   Top CPU processes:`);
    for (const proc of event.topProcesses) {
      console.log(`     • ${proc.name} (PID ${proc.pid}): ${proc.cpuPercent.toFixed(1)}% CPU`);
    }
    console.log();

    this.db.insertDrainEvent(event);

    if (this.config.alert.enabled) {
      this.alertSender.sendDrainAlert(event).catch(err =>
        console.error('[Monitor] Drain alert failed:', err)
      );
    }
  }

  private handleSpike(spike: ProcessSpike): void {
    console.log(`\n🔥 PROCESS SPIKE: ${spike.processName} (PID ${spike.pid})`);
    console.log(`   Metric: ${spike.metricType.toUpperCase()}`);
    console.log(`   Value: ${spike.value.toFixed(1)}% (baseline: ${spike.baseline.toFixed(1)}%, threshold: ${spike.threshold.toFixed(1)}%)`);
    console.log();

    this.db.insertProcessSpike(spike);

    this.alertSender.sendSpikeAlert(spike).catch(err =>
      console.error('[Monitor] Spike alert failed:', err)
    );
  }

  private handleBatteryImpactEvent(event: BatteryImpactEvent): void {
    console.log(`\n🔋 BATTERY IMPACT PERIOD DETECTED`);
    console.log(`   Battery: ${event.batteryDropPercent.toFixed(1)}% drop over ${event.durationMinutes.toFixed(1)} minutes`);
    console.log(`   Top process impacts:`);
    for (const proc of event.processImpacts.slice(0, 5)) {
      console.log(`     • ${proc.processName}: ${proc.impactScore.toFixed(2)} score (${proc.cpuSeconds.toFixed(1)} CPU-seconds, ${proc.avgCpuPercent.toFixed(1)}% avg CPU)`);
    }
    console.log();

    this.db.insertBatteryImpactEvent(event);

    this.alertSender.sendBatteryImpactAlert(event).catch(err =>
      console.error('[Monitor] Battery impact alert failed:', err)
    );
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      sampleCount: this.analyzer.getSampleCount(),
      windowMinutes: this.analyzer.getWindowDurationMinutes(),
      db: this.db.getStats(),
      spikeBaselines: this.spikeDetector.getBaselineStats().size,
      batteryDrainActive: this.batteryImpactAnalyzer.getCurrentDrain() !== null,
      tickCount: this.tickCount,
    };
  }
}
