---
kind: edit_chunk
id: 2026-09-01-T24-watchdog-evidence
created_at: 2026-09-01 21:32:36 IST
task_ids: [T24]
source_branch: main
source_commit: 8daefb6776ad5afba30dc546567bf7a577c95f5e
---

#### 21:32:36 IST - T24: Implement watchdog evidence collection
- Created `src/core/WatchdogEvidence.ts` - parsers and privacy-safe host/process evidence collection.
- Created `src/core/WatchdogAlertDetector.ts` - threshold alerts, hysteresis, sampling-gap detection, and observation-only wording.
- Created `src/core/ResponseLimit.ts` - bounded API JSON serialization.
- Created `src/test-watchdog-evidence.ts` - focused parser, grouping, sanitization, alert, gap, and response-limit coverage.
- Created `src/test-watchdog-storage.ts` - durable-write and restart-recovery coverage for the SQLite store.
- Modified `src/core/Monitor.ts`, `src/core/SystemCollector.ts`, `src/storage/TimeSeriesDB.ts`, and `src/types/index.ts` - persist and expose bounded watchdog evidence.
- Modified `src/web/server.ts`, `src/core/AlertSender.ts`, and `package.json` - expose evidence endpoints and test commands.
- Modified `src/config/ConfigManager.ts`, `src/main.ts`, `src/combined.ts`, and `start-monitor.sh` - apply the 15-second configurable sampling interval and graceful shutdown.
- Created `docs/WATCHDOG-EVIDENCE.md` - document evidence fields, privacy limits, alerts, retention, and verification.
- Created `memory-bank/tasks/T24.md` and `memory-bank/sessions/2026-09-01-evening.md` - record the completed implementation and remaining live verification.
- Modified `memory-bank/tasks.md`, `memory-bank/session_cache.md`, `memory-bank/activeContext.md`, `memory-bank/progress.md`, `memory-bank/changelog.md`, and `memory-bank/errorLog.md` - update Memory Bank state and known limitations.
