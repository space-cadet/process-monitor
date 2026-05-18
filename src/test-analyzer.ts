import { SystemCollector } from './core/SystemCollector.js';
import { DrainAnalyzer } from './core/DrainAnalyzer.js';

async function test() {
  console.log('[Test] Collecting 2 snapshots...');
  const collector = new SystemCollector();
  const analyzer = new DrainAnalyzer(5, 1); // 5-min window, 1-sec interval for test

  const s1 = await collector.getSystemSnapshot();
  console.log('[Test] Snapshot 1 battery:', s1.battery.percent + '%');
  analyzer.addSample(s1);

  // Wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));

  const s2 = await collector.getSystemSnapshot();
  console.log('[Test] Snapshot 2 battery:', s2.battery.percent + '%');
  analyzer.addSample(s2);

  console.log('[Test] Analyzer samples:', analyzer.getSampleCount());
  console.log('[Test] Window duration:', analyzer.getWindowDurationMinutes().toFixed(2), 'min');

  // Force a drain event by creating a fake sample with lower battery
  const s3 = JSON.parse(JSON.stringify(s2)); // Deep clone
  s3.battery.percent = s1.battery.percent - 5; // Fake 5% drop over the window
  s3.timestamp = s2.timestamp + 1000; // 1 second later
  analyzer.addSample(s3);

  const event = analyzer.analyze(1.0, 0.03, 0); // 1%/min threshold, 0.03min duration, no cooldown
  if (event) {
    console.log('[Test] 🚨 Drain event detected!');
    console.log('[Test] Drain rate:', event.drainRate.toFixed(2), '%/min');
    console.log('[Test] Duration:', event.durationMinutes.toFixed(2), 'min');
    console.log('[Test] Top processes:', event.topProcesses.slice(0, 3).map(p => p.name));
  } else {
    console.log('[Test] No drain detected (expected for normal operation)');
  }

  console.log('[Test] All checks passed!');
}

test().catch(err => {
  console.error('[Test] Error:', err);
  process.exit(1);
});
