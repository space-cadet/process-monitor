# Spike Detection Implementation (T1)

*Created: 2026-06-24*
*Last Updated: 2026-06-24*
*Status: ✅ Complete*
*Task: T1*

## Overview

The spike detector identifies processes that suddenly consume significantly more CPU or memory than their historical baseline. It uses a **dual-threshold system** to catch both absolute resource hogs and relative spikes in normally lightweight processes.

## Algorithm

### Dual-Threshold System

1. **Absolute Threshold:** CPU > 50% OR memory > 20% of total system memory
   - Catches runaway processes regardless of their baseline
   - Example: Chrome hitting 80% CPU is a spike even if its baseline is 60%

2. **Relative Threshold:** CPU > 3× baseline OR memory > 3× baseline
   - Catches processes that suddenly spike from low usage
   - Example: A background service jumping from 1% to 10% CPU is a spike

### Baseline Tracking

- Rolling average of last 10 samples per process
- Only starts tracking after a process has been seen ≥ 3 times
- This prevents false positives on processes that appear once with high initial usage

```typescript
// Pseudocode
if (sampleCount < 3) {
  addToBaseline(process);
  return; // Don't check for spikes yet
}

const baseline = rollingAverage(last10Samples);
const isAbsoluteSpike = cpu > 50 || memory > 20;
const isRelativeSpike = cpu > baseline * 3 || memory > baseline * 3;

if ((isAbsoluteSpike || isRelativeSpike) && !cooldownActive) {
  recordSpike();
  sendAlert();
  startCooldown(60 seconds);
}
```

### Cooldown

- 60-second cooldown per process after a spike is detected
- Prevents alert spam for sustained spikes (e.g., a process running at 100% for 5 minutes)
- Cooldown is tracked in memory, not persisted to DB

## Database Schema

```sql
CREATE TABLE process_spikes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  pid INTEGER NOT NULL,
  name TEXT NOT NULL,
  cpu REAL,
  memory REAL,
  baseline_cpu REAL,
  baseline_memory REAL,
  threshold_type TEXT  -- 'absolute' or 'relative'
);
```

## Alert Format

```
⚠️ CPU Spike Detected

Process: node (PID 1234)
CPU: 78% (baseline: 12%)
Memory: 245 MB (baseline: 180 MB)
Threshold: relative (3× baseline)

Time: 2026-06-24 10:30:45
```

## Configuration

```json
{
  "spikeAbsoluteCpuThreshold": 50.0,
  "spikeAbsoluteMemoryThreshold": 20.0,
  "spikeRelativeMultiplier": 3.0,
  "spikeCooldownMs": 60000
}
```

## Key Design Decisions

### Why Dual Threshold?
A single threshold misses two important cases:
1. **Absolute-only:** A process with 1% baseline spiking to 10% would be missed (not >50%)
2. **Relative-only:** A process with 40% baseline hitting 60% would trigger (not actually a problem, just normal fluctuation)

Dual thresholds catch both: absolute for runaways, relative for anomalies.

### Why 10-Sample Rolling Average?
- 10 samples at 30s intervals = 5 minutes of history
- Long enough to smooth out temporary fluctuations
- Short enough to adapt to genuine usage changes (e.g., user starting a new task)

### Why 3× Multiplier?
- 2× was too sensitive (many false positives on normal fluctuation)
- 5× was too insensitive (missed moderate spikes)
- 3× strikes a balance; configurable if needed

## Known Issues

1. **Kernel threads on Linux:** Without `ignoredProcesses` including `kworker`, `ksoftirqd`, etc., the spike detector fires constantly on normal kernel activity. Fixed in T19.

2. **One-shot processes:** Processes that appear once and immediately exit (e.g., `git status` in a large repo) may spike and then disappear before the next sample. They might not trigger a spike if they don't persist for 30s.

3. **Baseline reset on restart:** The baseline is kept in memory. If the monitor restarts, all baselines are reset. Processes need to be seen 3 times again before spike detection resumes.

## Testing

- ✅ Chrome with 50+ tabs triggers absolute spike
- ✅ Background service restart triggers relative spike
- ✅ Cooldown prevents duplicate alerts
- ✅ Baseline adapts after 3 samples
- ✅ Kernel threads filtered on Linux (T19)

## Commit

- Part of initial implementation (T1)
- Linux kernel thread filtering added in T19 (`18a7024`)
