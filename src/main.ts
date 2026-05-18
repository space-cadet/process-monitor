import { Monitor } from './core/Monitor.js';

/**
 * Entry point for mac-process-monitor v2.
 * Starts the battery/CPU monitoring loop.
 */
async function main() {
  const monitor = new Monitor({
    sampleIntervalSeconds: 30,
    dbPath: '~/.procmon/monitor.db',
    retentionDays: 30,
    alert: {
      enabled: true,
      drainThreshold: 1.0,   // Alert if draining > 1%/min
      minDuration: 2,        // For at least 2 minutes
      cooldownMinutes: 10,   // Don't alert more than every 10 min
    },
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Main] SIGINT received, shutting down...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Main] SIGTERM received, shutting down...');
    monitor.stop();
    process.exit(0);
  });

  await monitor.start();

  // Keep alive
  setInterval(() => {
    const stats = monitor.getStats();
    console.log(`[Main] ${new Date().toISOString()} | Samples: ${stats.sampleCount} | Window: ${stats.windowMinutes.toFixed(1)}min | DB snapshots: ${stats.db.totalSnapshots}`);
  }, 60000);  // Status log every minute
}

main().catch((err) => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
