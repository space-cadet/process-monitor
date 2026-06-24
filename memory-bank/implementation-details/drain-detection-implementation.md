# Battery Drain Detection Implementation (T1)

*Created: 2026-06-24*
*Last Updated: 2026-06-24*
*Status: ✅ Complete*
*Task: T1*

## Overview

The drain analyzer detects periods of battery drain by monitoring a sliding window of battery samples. It identifies when the battery is dropping faster than a configurable threshold while not charging.

## Algorithm

### Sliding Window Analysis

1. **Sample Collection:** Battery state is sampled every 30 seconds (configurable)
2. **Window Size:** Default 5-minute window (10 samples at 30s intervals)
3. **Trigger Conditions:**
   - Not plugged in (not charging)
   - Drop rate > threshold (default: 1.0%/min)
   - Sustained for minimum duration (default: 2 minutes)
   - Cooldown expired (default: 5 minutes between events)

```typescript
// Pseudocode
function analyzeDrain(window) {
  if (window.first.isPlugged || window.last.isPlugged) return;
  
  const duration = (window.last.time - window.first.time) / 60000; // minutes
  const drop = window.first.percent - window.last.percent;
  const rate = drop / duration;
  
  if (rate >= drainThreshold && duration >= minDuration && !cooldown) {
    const topProcesses = correlateProcesses(window);
    recordDrainEvent(drop, rate, duration, topProcesses);
    sendAlert();
    startCooldown(5 minutes);
  }
}
```

### Process Correlation

During a drain event, the analyzer correlates which processes were active:

1. Collect all `process_samples` in the drain window
2. Average CPU per process across the window
3. Sort by average CPU usage
4. Return top 5 processes

**Why average, not peak?** A process that sustains high CPU throughout the drain is more likely the cause than one that spiked briefly.

## Database Schema

```sql
CREATE TABLE drain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  start_battery REAL,
  end_battery REAL,
  rate REAL,
  top_processes TEXT  -- JSON array: [{"name":"Chrome","pid":1234,"cpu_avg":45.2}]
);
```

## Alert Format

```
🔋 Battery Drain Detected

Drop: 8% → 3% (5% lost)
Duration: 5 minutes
Rate: 1.0%/min

Top Culprits:
1. Chrome (PID 1234) - avg 45% CPU
2. node (PID 5678) - avg 12% CPU
3. WindowServer (PID 901) - avg 8% CPU

Time: 2026-06-24 10:30:45
```

## Configuration

```json
{
  "enableDrainDetection": true,
  "drainThreshold": 1.0,
  "minDrainDurationMs": 120000
}
```

## Key Design Decisions

### Why Sliding Window?
- Battery percentage is noisy (can fluctuate by 1% due to sensor precision)
- A single sample showing drop could be noise
- A window of 5+ minutes smooths out noise and confirms genuine drain

### Why Ignore Plugged-In Periods?
- When plugged in, the battery may be charging even while CPU is high
- Drain rate while charging is not meaningful (charger compensates)
- Only unplugged drain reflects actual battery usage

### Why Top 5 Processes?
- The "culprit" is often multiple processes (e.g., Chrome + a Node.js build)
- Top 5 gives enough context without overwhelming the alert
- Stored as JSON in the DB for flexibility

### Why 5-Minute Cooldown?
- Prevents alert spam during sustained drain
- A single long drain event (e.g., 20 minutes) should trigger once, not every 5 minutes
- Cooldown is per-event, not per-process (unlike spike detection)

## Limitations

1. **Desktop/Server machines:** If there's no battery, drain detection never triggers. The monitor still tracks battery samples, but `isPlugged: true` and no change means no drain events.

2. **Battery precision:** Some systems report battery in 1% increments. A 5% drop over 5 minutes might be real or might be sensor noise. The threshold (1.0%/min) is conservative to avoid false positives.

3. **Correlation vs. causation:** The top processes during a drain window are correlated, not necessarily causal. A process might be using CPU for legitimate work while the real drain is from the GPU or screen brightness.

## Testing

- ✅ Detects drain when unplugged and CPU high
- ✅ Ignores drain when plugged in
- ✅ Respects cooldown between events
- ✅ Top 5 processes correctly identified
- ✅ No false positives on normal battery fluctuation

## Commit

- Part of initial implementation (T1)
