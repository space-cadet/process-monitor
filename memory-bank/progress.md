# Progress Report: mac-process-monitor

*Last Updated: 2026-06-15 07:45 IST*

## Project Status: T1, T3, T4, T6, T7, T8 Complete; T2, T5 Pending

### What Works

- **T1 — TypeScript Core Monitor**: ✅ COMPLETE
  - `SystemCollector.ts`: Battery + process + expanded metric sampling via `systeminformation`
  - `DrainAnalyzer.ts`: Sliding window drain detection with process correlation
  - `TimeSeriesDB.ts`: SQLite storage with WAL + auto-migration (6 tables)
  - `Monitor.ts`: Orchestrator loop with configurable intervals and thresholds
  - `main.ts`: Entry point with graceful SIGINT/SIGTERM shutdown
  - Test scripts: `test-basic.ts`, `test-collector.ts`, `test-analyzer.ts`, `show-data.ts`

- **T3 — Per-Process Query Interface**: ✅ COMPLETE
  - `src/query.ts`: CLI tool with `--spikes`, `--battery`, `--top`, `--process`, `--stats`
  - `TimeSeriesDB.ts`: Query methods for history, stats, top processes, spikes, battery impact
  - All queries exposed via dashboard API endpoints

- **T4 — Web Dashboard**: ✅ COMPLETE (rebuilt 2026-06-10)
  - `src/dashboard/server.ts`: Native Node.js HTTP server, 12 API endpoints
  - `dashboard/public/`: 7-file modular frontend (HTML, CSS, utils, charts, tables, profiles, app)
  - Features: side-by-side layout, sortable columns, process detail modal, spike panel, battery impact panel, profile CRUD
  - Auto-refresh every 5 seconds, responsive design
  - Playwright E2E tests

- **T6 — Process Spike Detection**: ✅ COMPLETE
  - `src/core/SpikeDetector.ts`: Per-process baseline tracking, dual-threshold detection
  - `process_spikes` table: Stores spike events with baseline, threshold, snapshot reference
  - Dashboard: Real-time spike alert panel with clickable cards
  - CLI: `npx tsx src/query.ts --spikes --since 1h`

- **T7 — Battery Impact Correlation**: ✅ COMPLETE
  - `src/core/BatteryImpactAnalyzer.ts`: Drain period detection, per-process impact scoring
  - `battery_impact` + `battery_impact_events` tables: Accumulated scores + event history
  - Dashboard: Battery impact ranking bars with clickable process links
  - CLI: `npx tsx src/query.ts --battery --limit 10`

- **T8 — LaunchDaemon Installation**: ✅ COMPLETE (2026-06-15)
  - `ai.openclaw.procmon.monitor` → PID 53211, running via LaunchDaemon
  - `ai.openclaw.procmon.dashboard` → PID 57453, running via LaunchDaemon
  - Auto-start on boot confirmed
  - Old conflicting plist (`com.mac-process-monitor.dashboard`) removed to resolve port 3456 conflict

### What's Left to Build

| Task | Status | Description |
|------|--------|-------------|
| T2 | ⬜ | Telegram/OpenClaw alert integration |
| T5 | ⬜ | Swift menubar app (future) |

### Technical Debt (Resolved)

- ~~`techContext.md` was stale~~ — **FIXED** 2026-05-19
- ~~`productContext.md` was generic~~ — **FIXED** 2026-05-19
- ~~Dashboard frontend regression~~ — **FIXED** 2026-06-10 (advanced features restored)
- ~~Process modal `[object Object]` bug~~ — **FIXED** 2026-06-10 (click handler passed object instead of name)
- ~~GitHub repo out of sync~~ — **FIXED** 2026-06-15 (T6/T7 committed, 27 commits total)
- ~~LaunchDaemon port conflict~~ — **FIXED** 2026-06-15 (old conflicting plist removed)

### Known Issues

- `sendAlert()` in `Monitor.ts` is still a stub — prints to console, doesn't actually send messages (T2 pending)
- No formal test framework (Jest configured but no test files written)
- Battery impact data needs longer runtime on battery power (currently 0 events — needs 2% drop over 2+ min while not charging)

### Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-05-18 | T1: TypeScript rewrite with core monitoring | ✅ Complete |
| 2026-05-18 | Memory bank initialized, T2-T5 planned | ✅ Complete |
| 2026-05-19 | Memory bank updated to reflect actual TS stack | ✅ Complete |
| 2026-05-19 | T4: Web dashboard on port 3456 with Chart.js | ✅ Complete |
| 2026-06-09 | T6: Process spike detection with baseline tracking | ✅ Complete |
| 2026-06-09 | T7: Battery impact correlation with scoring | ✅ Complete |
| 2026-06-10 | T4: Dashboard rebuilt with full features + T3 queries | ✅ Complete |
| 2026-06-13 | T8: LaunchDaemon plist files created (pending manual sudo) | ✅ Complete |
| 2026-06-15 | T8: LaunchDaemons installed and running | ✅ Complete |
| 2026-06-15 | T6/T7 committed to GitHub, full history restored | ✅ Complete |
| *Next* | T2: OpenClaw/Telegram alerting | ⬜ Pending |
| *Future* | T5: Swift menubar | ⬜ Pending |

### Current Blockers

- None

### Next Milestone Goals

- Wire `Monitor.sendAlert()` to actually dispatch messages via OpenClaw message tool (T2)
- Capture dashboard screenshots for README
- User to run `git pull` in `/Users/deepak/code/mac-process-monitor` to sync canonical copy

### Notes

- Project rewritten from Python to TypeScript during T1
- Original `procmon/` Python package is vestigial (not imported by TS code)
- `requirements.txt` and `procmon/` can be removed once TS stack is fully validated
- Memory bank uses BOTH workflows: DB-native (`database/`) + text-based (`tasks.md`, `T*.md`, etc.)
- GitHub repo: https://github.com/space-cadet/mac-process-monitor (public, 27 commits)
- **Workspace vs. Canonical**: User's canonical copy is `/Users/deepak/code/mac-process-monitor`. Workspace copy is for Sage's working/transient use. I should check the canonical copy first when investigating alignment.
- **Git incident lesson**: Never use `git clone --depth 1` for alignment checks. The workspace copy had no `.git` folder when I checked, but the user's canonical copy was the real repo.
