# Edit History

*Last Updated: 2026-09-01 21:32:36 IST*

---

## 2026-09-01

#### 21:32:36 IST - T24: Watchdog evidence collection and correlation
- Created `src/core/WatchdogEvidence.ts` - parsers and privacy-safe host/process evidence collection.
- Created `src/core/WatchdogAlertDetector.ts` - threshold alerts, hysteresis, sampling-gap detection, and observation-only wording.
- Created `src/core/ResponseLimit.ts` - bounded API JSON serialization.
- Created `src/test-watchdog-evidence.ts` and `src/test-watchdog-storage.ts` - focused evidence and durable-storage coverage.
- Modified `src/core/Monitor.ts`, `src/core/SystemCollector.ts`, `src/storage/TimeSeriesDB.ts`, and `src/types/index.ts` - persist and expose bounded watchdog evidence.
- Modified `src/web/server.ts`, `src/core/AlertSender.ts`, `src/config/ConfigManager.ts`, `src/main.ts`, `src/combined.ts`, `start-monitor.sh`, and `package.json` - expose evidence endpoints and apply configurable sampling.
- Created `docs/WATCHDOG-EVIDENCE.md` - document fields, privacy limits, alerts, retention, and verification.
- Created and modified Memory Bank task, session, cache, context, progress, changelog, error, and edit records for T24.

## 2026-06-26

#### 10:08:36 IST - T20: Phase 3: Backend APIs for Network, Disk, Status, Battery + user follow-up improvements
- Modified `src/core/SystemCollector.ts` - Added network interfaces, disk volumes, system info, battery health, disk I/O rates. User added Apple Silicon battery temp via ioreg.
- Modified `src/types/index.ts` - Added NetworkInterface, DiskVolume, SystemInfo types. Extended BatterySample with health field.
- Modified `src/web/server.ts` - Added /api/network-interfaces, /api/network-connections, /api/disk-volumes endpoints.
- Modified `src/storage/TimeSeriesDB.ts` - Reconstruct missing fields (networkInterfaces, diskVolumes, systemInfo) from historical snapshots.
- Modified `web/public/app.js` - Network view: async fetch interfaces + connections tables. Disk view: per-volume table + I/O rates. Status view: battery temp, power source, uptime, system info table. Battery view: time remaining, health %, removed broken energy table.

#### 07:39:11 IST - T20: Phase 2 complete: All detail views implemented with existing snapshot data. Memory view: pressure gauge + process list sorted by memory. Disk view: usage gauge + I/O counters. Network view: RX/TX/Total rate cards. Battery view: battery status + per-process energy table. Status view: load avg, CPU temp, process count, last update. Placeholders for per-volume/per-interface/per-history data that requires backend changes.
- Modified `web/public/app.js` - Modified web/public/app.js
- Modified `web/public/styles.css` - Modified web/public/styles.css
- Modified `web/public/index.html` - Modified web/public/index.html

#### 07:12:19 IST - T20: Phase 1 complete: Clickable KPI cards with detail view switching. Added onclick handlers, active card state with CSS transitions, localStorage persistence for selected card, renderDetailView() dispatcher. CPU card shows process list with search/tree toggle, other cards show themed placeholders.
- Modified `web/public/index.html` - Modified web/public/index.html
- Modified `web/public/styles.css` - Modified web/public/styles.css
- Modified `web/public/app.js` - Modified web/public/app.js

#### 07:10:27 IST - T20: Phase 1: Frontend skeleton — clickable KPI cards with detail view switching. Added onclick handlers, active card state, localStorage persistence, renderDetailView dispatcher. CPU card shows process list, others show placeholders.
- Modified `web/public/index.html` - Modified web/public/index.html
- Modified `web/public/styles.css` - Modified web/public/styles.css
- Modified `web/public/app.js` - Modified web/public/app.js

#### 06:53:06 IST - T20: Design: Dashboard detail views with clickable KPI cards. CPU→process list, Memory→memory details, Disk→disk/volume list, Network→interface list+connections, Battery→battery history+per-process energy.
