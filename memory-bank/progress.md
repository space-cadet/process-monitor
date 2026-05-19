# Progress Report: mac-process-monitor

## Project Status: T1 Complete, T2-T5 Pending

### What Works
- **T1 — TypeScript Core Monitor**: ✅ COMPLETE
  - `SystemCollector.ts`: Battery + process sampling via `systeminformation`
  - `DrainAnalyzer.ts`: Sliding 5-min window drain detection with process correlation
  - `TimeSeriesDB.ts`: SQLite time-series storage (snapshots, process_samples, drain_events)
  - `Monitor.ts`: Orchestrator loop with configurable intervals and thresholds
  - `main.ts`: Entry point with graceful SIGINT/SIGTERM shutdown
  - Test scripts: `test-basic.ts`, `test-collector.ts`, `test-analyzer.ts`, `show-data.ts`
  - Memory Bank: Full task registry, product context, tech context, edit history

### What's In Progress
- T2: Telegram/OpenClaw alert integration (HIGH priority)

### What's Left to Build
| Task | Status | Description |
|------|--------|-------------|
| T2 | ⬜ | Telegram/OpenClaw alert integration |
| T3 | ⬜ | Per-process history query interface |
| T4 | ⬜ | Web dashboard for live monitoring |
| T5 | ⬜ | Swift menubar app (future) |

## Technical Debt
- `techContext.md` was stale (described old Python stack) — **FIXED** 2026-05-19
- `productContext.md` was generic — **FIXED** 2026-05-19 to describe battery drain use case

## Known Issues
- `sendAlert()` in `Monitor.ts` is a stub — prints to console, doesn't actually send messages
- No formal test framework (Jest configured but no test files written)
- `.js` import paths in source are ESM convention but look odd

## Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-05-18 | T1: TypeScript rewrite with core monitoring | ✅ Complete |
| 2026-05-18 | Memory bank initialized, T2-T5 planned | ✅ Complete |
| 2026-05-19 | Memory bank updated to reflect actual TS stack | ✅ Complete |
| *Next* | T2: OpenClaw/Telegram alerting | ⬜ Pending |
| *Next* | T3: CLI query tool (`--process Chrome --since 2h`) | ⬜ Pending |
| *Future* | T4: Web dashboard | ⬜ Pending |
| *Future* | T5: Swift menubar | ⬜ Pending |

## Current Blockers
- None

## Next Milestone Goals
- Wire `Monitor.sendAlert()` to actually dispatch messages (T2)
- Build `src/query.ts` CLI for per-process history (T3)
- Add HTTP dashboard server on port 3456 (T4)

## Notes
- Project was rewritten from Python to TypeScript during T1
- Original `procmon/` Python package is vestigial (not imported by TS code)
- `requirements.txt` and `procmon/` can be removed once TS stack is fully validated