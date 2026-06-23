# Product Context: process-monitor

## Problem Statement
macOS users often don't notice when an app starts draining their battery aggressively — until it's too late. Background processes, browser tabs with runaway JavaScript, or apps stuck in a loop can silently consume CPU and kill battery life. Activity Monitor shows real-time data but doesn't track history or alert you when drain accelerates.

## Solution
A lightweight background monitor that:
- **Samples** battery level + top CPU processes every 30 seconds
- **Stores** time-series data in SQLite for history and trend analysis
- **Detects** rapid battery drain using a sliding 5-minute window
- **Correlates** drain events with the processes that spiked CPU during that window
- **Alerts** via Telegram/OpenClaw when drain exceeds configurable thresholds

## Key Use Cases

### Catch Runaway Background Processes
"My battery dropped 40% in an hour — what was running?" The monitor identifies the exact processes with highest average CPU during the drain window.

### Track Battery Health Over Time
SQLite storage means you can query historical data: "Show me drain events from last week" or "Which apps consistently spike when I'm on battery?"

### Proactive Alerts
Get notified within 2-5 minutes of drain starting, not when your battery hits 10%. Configurable thresholds and cooldown prevent spam.

### Development & Debugging
Developers monitoring resource usage of their own apps while testing on real battery power.

## User Experience Goals
- **Invisible**: Runs in background, minimal CPU overhead (<1%)
- **Actionable**: Alerts name the culprits, not just "battery dropping"
- **Persistent**: History survives reboots; SQLite is self-contained
- **Configurable**: Thresholds, intervals, and DB path are adjustable
- **Extensible**: Dashboard (T4) and native menubar app (T5) build on the same DB

## Non-Goals
- Replacing Activity Monitor's real-time process table
- Automatically killing processes (alert-only for now)
- Network traffic monitoring (out of scope)
- Cross-device sync (single-machine tool)

## Architecture in One Sentence
TypeScript Node.js process → `systeminformation` collector → sliding-window `DrainAnalyzer` → `better-sqlite3` storage → OpenClaw/Telegram alerts.

## Future Considerations
- Per-process history queries and CLI tool (T3)
- Web dashboard with live battery/CPU charts (T4)
- Swift menubar app with native macOS notifications (T5)
- Machine learning on historical patterns to predict drain before it happens