# Battery Impact Analysis Implementation (T1)

*Created: 2026-06-24*
*Last Updated: 2026-06-24*
*Status: ✅ Complete*
*Task: T1*

## Overview

The battery impact analyzer scores which processes are the worst battery drainers over time. Unlike simple correlation ("what was running during drain?"), it uses accumulated scoring so chronic offenders rise above one-time spikes.

## Algorithm

### Scoring Formula

For each drain event:
1. Collect all `process_samples` in the drain window
2. Calculate `cpuSeconds` per process: `avgCpu * duration / 100`
3. Total `cpuSeconds` = sum of all processes in the window
4. Process score contribution: `(processCpuSeconds / totalCpuSeconds) * batteryDropPercent`
5. Accumulate into `battery_impact` table: `INSERT ... ON CONFLICT DO UPDATE SET score = score + newScore`

```typescript
// Pseudocode
function analyzeImpact(drainEvent, processSamples) {
  const duration = drainEvent.durationMinutes;
  const totalDrop = drainEvent.startBattery - drainEvent.endBattery;
  
  const processCpuSeconds = new Map();
  let totalCpuSeconds = 0;
  
  for (const sample of processSamples) {
    const cpuSeconds = sample.cpu * duration / 100;
    processCpuSeconds.set(sample.name, 
      (processCpuSeconds.get(sample.name) || 0) + cpuSeconds
    );
    totalCpuSeconds += cpuSeconds;
  }
  
  for (const [name, cpuSeconds] of processCpuSeconds) {
    const score = (cpuSeconds / totalCpuSeconds) * totalDrop;
    accumulateScore(name, score);
  }
}
```

### Why CPU-Seconds Share?

- **Simple correlation:** Would flag every process running during drain equally
- **CPU-seconds share:** Weights by actual resource consumption
- A process using 5% CPU for 10 minutes gets less blame than one using 80% for 2 minutes

### Accumulation

The `battery_impact` table uses `ON CONFLICT DO UPDATE` to accumulate scores over time:

```sql
INSERT INTO battery_impact (pid, name, score, event_count, last_updated)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(pid, name) DO UPDATE SET
  score = score + excluded.score,
  event_count = event_count + 1,
  last_updated = excluded.last_updated;
```

This means:
- A process that appears in 10 drain events with small scores can outrank one that appears once with a large score
- Chronic offenders (always running, moderate CPU) rise to the top
- One-time spikes don't dominate the rankings

## Database Schema

```sql
CREATE TABLE battery_impact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pid INTEGER NOT NULL,
  name TEXT NOT NULL,
  score REAL DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  last_updated INTEGER,
  UNIQUE(pid, name)
);
```

## Dashboard Display

### Top Battery Impact Rankings
```
Top Battery Drainers (All Time)

1. Chrome       ████████░░  45.2 pts  (12 events)
2. node         █████░░░░░  28.1 pts  (8 events)
3. Python       ████░░░░░░  19.5 pts  (5 events)
4. Slack        ███░░░░░░░  12.3 pts  (3 events)
5. WindowServer ██░░░░░░░░  8.7 pts   (6 events)
```

### Per-Event Breakdown
Clicking a process shows which drain events contributed to its score:
```
Chrome - 45.2 pts (12 events)

Event 1: 2026-06-20 14:30 - 3.2 pts (5% drop, avg 65% CPU)
Event 2: 2026-06-21 09:15 - 8.1 pts (8% drop, avg 72% CPU)
Event 3: 2026-06-21 16:45 - 2.5 pts (4% drop, avg 38% CPU)
...
```

## Configuration

```json
{
  "enableBatteryImpact": true
}
```

(Note: The battery impact analyzer has no configurable thresholds — it uses the drain event's data directly.)

## Key Design Decisions

### Why Not Just Track Drain Events?
Drain events answer "when did my battery drop fast?" but not "why?" The impact analyzer answers "why" by scoring which processes are consistently present during drain.

### Why Score Rather Than Rank?
A simple rank (1st, 2nd, 3rd) would lose magnitude information. A process with 100 pts is objectively worse than one with 10 pts. Scores preserve this.

### Why Accumulate Over Time?
- A single bad day (e.g., running a build) shouldn't dominate rankings forever
- But a consistently bad process (e.g., Electron app with memory leak) should accumulate high scores
- The accumulation provides long-term insight into battery health

### Why Unique by PID + Name?
- PID is ephemeral (changes on restart)
- Name alone might collide (e.g., multiple `node` processes)
- The combination allows distinguishing `node` (webpack) from `node` (server) if they have different PIDs
- In practice, the name is what users care about, and PID just disambiguates

## Limitations

1. **No battery = no impact:** On desktop/server machines, no drain events occur, so no impact scores accumulate. The table remains empty.

2. **GPU/screen not tracked:** The analyzer only looks at CPU. A game using GPU heavily but moderate CPU might have low impact scores despite being the real drain cause.

3. **Baseline assumption:** The algorithm assumes all CPU usage during drain is "bad." A process doing legitimate work (e.g., video encoding) might have high scores but isn't actually a problem.

4. **PID rollover:** If a process restarts and gets a new PID, it starts a new score entry. The old score is orphaned. In practice, this is minor since scores are accumulated by name anyway.

## Testing

- ✅ Scores accumulate across multiple drain events
- ✅ Chronic offenders outrank one-time spikes
- ✅ Empty on desktop machines (no drain events)
- ✅ Top processes correctly identified from drain window
- ✅ Score magnitude reflects actual battery drop

## Commit

- Part of initial implementation (T1)
