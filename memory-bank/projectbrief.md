# Project Brief: mac-process-monitor

## Overview
A cross-platform system monitor that tracks battery drain, CPU, memory, disk I/O, network activity, and per-process resource usage. Stores time-series data in SQLite and detects rapid battery drain correlated with CPU-intensive processes. Built in TypeScript with `systeminformation` + `better-sqlite3`.

Originally planned as a macOS-only Python tool; rewritten in TypeScript during T1 when cross-platform potential became clear.

## Core Requirements
1. Sample system metrics every 30 seconds (battery, CPU, memory, swap, load, disk I/O, network, disk usage, temperature)
2. Track top 50 processes by CPU with per-process CPU breakdown (user/system), memory, nice value, state
3. Detect rapid battery drain using a sliding 5-minute window analysis
4. Correlate drain events with processes that had highest average CPU during the drain window
5. Store all data in SQLite for historical querying and trend analysis
6. Alert when drain exceeds configurable threshold (default: 1%/min for 2+ min)
7. Run with minimal system overhead (<1% CPU)
8. Graceful shutdown on SIGINT/SIGTERM

## Expanded Metrics (added 2026-05-19)
- CPU: total, user, system, idle percentages
- Memory: total %, absolute used MB, free MB
- Swap: used MB, total MB
- Load: 1-minute average
- Disk I/O: read, write, total cumulative operations
- Network: rx/tx bytes (first active interface)
- Disk usage: primary mount percentage
- CPU temperature (when sensors available)
- Per-process: user CPU %, system CPU %, nice value, process state

## Goals
- Provide reliable background monitoring with low overhead
- Create actionable alerts: name the culprits, not just "battery dropping"
- Enable historical analysis: "What was Chrome doing between 2-3pm?"
- Support future interfaces: Telegram alerts, web dashboard, Swift menubar
- Maintain a language-agnostic SQLite DB that a future Swift app can read

## Target Users
- Laptop users who want to catch runaway background processes before battery dies
- Developers monitoring resource usage of their own apps
- Power users who want historical data, not just real-time Activity Monitor

## Success Criteria
- Accurately detects battery drain within 2-5 minutes of it starting
- Identifies correct top-5 CPU processes during drain events
- Stores 30 days of data without unbounded disk growth
- Operates with <1% CPU overhead
- Cross-platform: works on macOS, Linux, Windows (with battery where available)
- DB survives version upgrades via auto-migration (ALTER TABLE for missing columns)
- Clean shutdown leaves DB in consistent state (WAL mode checkpoints on close)
