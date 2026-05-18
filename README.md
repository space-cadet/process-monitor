# mac-process-monitor

A macOS system monitor that tracks battery drain and correlates it with CPU-intensive processes. Built in TypeScript with SQLite time-series storage.

## What It Does

- **Monitors battery level** in real-time (via systeminformation)
- **Detects rapid drain** — alerts when battery drops faster than configured threshold
- **Correlates with processes** — identifies which apps spiked CPU during drain events
- **Stores time-series data** — SQLite DB for history, trends, and analysis
- **Planned**: Telegram alerts, web dashboard, Swift menubar app

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the monitor (samples every 30s, logs to ~/.procmon/monitor.db)
npx tsx src/main.ts

# Show current system data
npx tsx src/show-data.ts

# Run diagnostic tests
npx tsx src/test-basic.ts      # Battery + process validation
npx tsx src/test-collector.ts  # Collector + DB integration
npx tsx src/test-analyzer.ts   # Drain detection with fake data
```

## Architecture

```
src/
  types/
    index.ts              # All TypeScript interfaces
  core/
    SystemCollector.ts    # Battery + process sampling
    DrainAnalyzer.ts      # Sliding window drain detection
    Monitor.ts            # Orchestrator loop
  storage/
    TimeSeriesDB.ts       # SQLite time-series storage
  main.ts                 # Entry point
```

## How Drain Detection Works

1. **Sample** battery + top processes every 30 seconds
2. **Store** in SQLite (snapshots table + process_samples table)
3. **Analyze** sliding 5-minute window for battery drop
4. **Trigger** if drop rate exceeds threshold (default: 1%/min for 2+ minutes)
5. **Correlate** — find processes with highest average CPU during the drain window
6. **Alert** — Telegram notification with drain details + top processes

## Configuration

Edit `src/main.ts` or pass a config object to `Monitor`:

```typescript
const monitor = new Monitor({
  sampleIntervalSeconds: 30,
  dbPath: '~/.procmon/monitor.db',
  retentionDays: 30,
  alert: {
    enabled: true,
    drainThreshold: 1.0,    // % per minute
    minDuration: 2,         // minutes
    cooldownMinutes: 10,    // between alerts
  },
});
```

## Database Schema

**snapshots** — system-wide metrics per sample
- timestamp, battery_percent, is_charging, cpu_total, memory_total

**process_samples** — per-process metrics per sample
- snapshot_id, pid, name, cpu_percent, memory_percent, rss_mb, cmdline

**drain_events** — detected rapid drain incidents
- id, start_time, end_time, start_percent, end_percent, drain_rate, top_processes_json

## Project Roadmap

| Task | Status | Description |
|------|--------|-------------|
| T1 | ✅ | TypeScript rewrite with core monitoring |
| T2 | ⬜ | Telegram/OpenClaw alert integration |
| T3 | ⬜ | Per-process history query interface |
| T4 | ⬜ | Web dashboard for live monitoring |
| T5 | ⬜ | Swift menubar app (future) |

## Tech Stack

- **TypeScript 5.x** — Type-safe Node.js
- **systeminformation** — Cross-platform system stats
- **better-sqlite3** — Fast synchronous SQLite
- **tsx** — TypeScript execution without compilation

## License

MIT
