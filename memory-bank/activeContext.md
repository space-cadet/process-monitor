# Active Context

*Last Updated: 2026-09-03 02:37 IST*

## Current Tasks

### ✅ T24: Watchdog Evidence Collection and Correlation — Fully Complete
**Status:** Evidence collection, bounded persistence, alerts, incident bundles, API exposure, AND dashboard UI are all implemented and verified. T24 is complete.
**Started:** 2026-09-01. Completed: 2026-09-01 22:25 IST.

**What was done (Backend — 2026-09-01 21:32):**
- Added configurable 15-second host/process sampling with UTC and IST timestamps.
- Added memory pressure, `vm.swapusage`, `vm_stat`, available-memory, load, uptime, process-family, PID-churn, and sampling-gap evidence.
- Added privacy-safe process names/identifiers, bounded durable history, threshold alerts with hysteresis, and atomic incident bundles.
- Extended current snapshot/history APIs and bounded JSON responses.
- Added focused parser, alert, gap, storage, and API-limit coverage; TypeScript and pure evidence tests pass.

**What was done (Dashboard UI — 2026-09-01 22:25):**
- Added new "🚨 Watchdog" tab (7th tab) to dashboard (`web/public/index.html`, `app.js`, `styles.css`).
- Active Alerts panel: severity-colored cards (red=critical, yellow=warning, blue=info) with auto-refresh every 30s.
- Incident Actions panel: "Create Incident Bundle" and "View Bundles" action cards.
- Alert History panel: sortable table of all alerts with "Load History" button.
- `loadWatchdogAlerts()`, `createIncidentBundle()`, `renderWatchdogAlert()`, `loadIncidentBundles()` JS functions.
- Cache-busted assets: `styles.css?v=5`, `app.js?v=9`.
- Verified: 6 active alerts, 11 incident bundles created today, API endpoints responding correctly.

**Memory-bank reconciliation (2026-09-03):** Corrected the stale project-status
header and aligned the T24 dashboard notes with the current implementation at
`8bcf9c2`. T22 remains the only active process-monitor task.

**Deployment and validation (2026-09-03):** Fixed the remaining T24 alert/API/UI
contracts in `8bcf9c2`, corrected the test runner in `3b901a8`, and remediated
the npm audit findings in `b1cf1d9`. Build and Playwright E2E validation passed
(5/5); both LaunchDaemons were restarted and post-restart API smoke tests passed
on port 3456. The deployed build is `b1cf1d9`.

**Process correction:** An unnecessary Jest dependency was briefly added because
the test inventory was misread; it was removed after confirming the repository's
tests are Playwright-only. No Jest suite exists.

### ✅ T23: TypeScript Compilation — Complete
**Status:** All source fixed, compiled to dist/, services running with plain node.
**Started:** 2026-08-08. Completed: 2026-08-08.

**What was done:**
- Fixed `require()` → ESM imports in `TimeSeriesDB.ts`, `DeviceIdentity.ts`, `server.ts`
- Compiled TypeScript to `dist/` with `pnpm exec tsc`
- Added `"type": "module"` to `package.json`
- Updated startup scripts: `run.sh`, `start-dashboard.sh`, `check-and-start.sh`
- Both services now run with plain `node dist/...` — no tsx dependency
- Tested `bun build --compile`: builds but fails at runtime (better-sqlite3 native bindings)

**Current state:**
- Monitor: `node dist/main.js` running
- Dashboard: `node dist/web/server.js` on port 3456
- Zero errors, no ESM warnings

---

### ✅ T20: Dashboard Detail Views — Complete
**Status:** Phase 3 complete (all views have real data via backend APIs). Phase 4 (charts) deferred.
**Started:** 2026-06-26. Completed: 2026-06-26.

**Implemented:**
- **CPU** → Process list sorted by CPU ✅ (Phase 1)
- **Memory** → Memory pressure gauge + process list sorted by memory ✅ (Phase 2)
- **Disk** → Disk usage gauge + I/O rates (MB/s) + per-volume table ✅ (Phase 3)
- **Network** → RX/TX/Total rate cards + interface list + active connections ✅ (Phase 3)
- **Battery** → Battery status + time remaining + health % ✅ (Phase 3)
- **Status** → Load avg, CPU temp, process count, uptime, OS, CPU model, hostname ✅ (Phase 3)

**Backend APIs added (Phase 3):**
- `/api/network-interfaces` — per-interface RX/TX/speed/state/errors
- `/api/network-connections` — active TCP/UDP connections with process names
- `/api/disk-volumes` — per-mount stats, size, used, available, filesystem type

**Cross-platform improvements:**
- Apple Silicon battery temperature via `ioreg -r -c AppleSmartBattery`
- Disk I/O rates computed from delta (like network rates)
- System info collected: platform, distro, release, arch, hostname, CPU model, cores, threads
- Battery health % from maxCapacity/designedCapacity ratio

---

### ✅ T17: Multi-Device Dashboard V1 — Complete
**Completed:** 2026-06-24. Full V1 implementation.

**What was built:**
- **Device Identity**: `DeviceIdentity.ts` — UUIDv4 `did`, persisted to `~/.procmon/config/device.json`
- **Device Registry**: `DeviceRegistry.ts` — JSON-based peer registry with CRUD + heartbeat
- **QR Pairing**: `/api/qr` returns SVG QR code with identity + all network endpoints
- **Network Auto-Detection**: `getTailscaleIP()` + `getLanIP()` + `getAllHosts()` — advertises LAN, Tailscale, and localhost
- **Peer Polling**: Dashboard polls registered devices every 30s via `fetch()` to their `/api/metrics` endpoint
- **Devices Tab**: Online/offline status cards, battery sparklines, "Show QR" button
- **Identity Endpoint**: `/api/identity` returns structured endpoints for all three network modes

**Files:**
- `src/core/DeviceIdentity.ts` — new
- `src/core/DeviceRegistry.ts` — new
- `src/web/server.ts` — `/api/identity`, `/api/qr`, `/api/metrics`, `/api/devices/*`
- `web/public/app.js` — peer polling, device cards, QR modal
- `web/public/styles.css` — device grid, QR modal styles

**Limitations:**
- Android can't run Tailscale + NordVPN simultaneously (VPN slot conflict)
- LAN mode works for same-network monitoring
- Tailscale mode works for cross-network (when both devices have Tailscale)
- No relay server for Android+NordVPN case (T18 proposed)

---

### ✅ T15: Energy API — Complete
**Completed:** 2026-06-24.

- `EnergyCollector.ts` — `powermetrics` integration for per-process energy (mJ)
- `energy_mj` field added to `process_samples` table
- Energy displayed in process cards
- **Note**: `powermetrics` requires `sudo` — energy data only available when running with privileges

---

### ✅ T13: Process Tree View — Complete
**Completed:** 2026-06-24.

- `/api/process-tree` endpoint — hierarchical tree from `systeminformation.processes()`
- Tree/List toggle in Processes tab
- Recursive rendering with CPU/memory per node
- **UI improvements (2026-06-24):** Split path display (directory dimmed, basename bright), process type badges (system/daemon/user), bigger toggle buttons (22×22px), parent row highlight, gradient tree guide lines, search bar (works for both list/tree)
- **Mobile layout:** Deferred — attempted multiple CSS approaches for name column sizing without success. CSS cache-bumped to `styles.css?v=2`. To revisit later.

---

### ✅ T12: Data Export — Complete
**Completed:** 2026-06-24.

- `/api/export/csv` and `/api/export/json` — date range picker (`from`/`to` ISO params)
- Export UI in Reports tab — dropdown for format + date range
- CSV includes snapshots, battery, processes
- JSON returns structured data

---

### ✅ T10: Reports — Complete
**Completed:** 2026-06-24.

- `ReportGenerator.ts` — daily battery health report with scoring
- `--report` CLI flag (`--output=text|json`)
- Reports tab in dashboard — health score, drain events, top culprits, insights, export UI
- Auto-generates at 22:00 daily via cron

---

### ✅ T9: Sleep/Wake — Complete
**Completed:** 2026-06-24.

- `sleep_wake_events` table
- `/api/sleep-wake-events` endpoint
- Sleep tab in dashboard with timeline

---

### ✅ T4: Dashboard Extended — v4 Complete (2026-06-22)
Already documented in previous version.

---

- **T11a** (`workspace-94r`): Time Expression Parser
- **T11b** (`workspace-st0`): Query Tokenizer
- **T11c** (`workspace-ev0`): SQL Generator (depends on a+b)
- **T11d** (`workspace-um0`): Search API + Dashboard UI (depends on c)

See workspace beads queue for full details.

---

### 🛠️ Config Fixes (2026-06-24)
- **OpenClaw compaction:** `reserveTokensFloor` 48000 → 12000. Triggers compaction at ~188k for 200k models instead of ~152k.
- **Git Guardian:** Updated `repo-manifest.json` — `mac-process-monitor` renamed to `process-monitor`

---

### 🛠️ Cross-Platform Fixes (2026-06-24 + 2026-06-26)
- **SleepWakeDetector**: `src/core/SleepWakeDetector.ts` — `getPlatform()` helper detects `darwin`/`linux`/`windows`/`other`. macOS: `ioreg`+`pmset`. Linux: reads battery from `/sys/class/power_supply/BAT*/capacity` + `status`. Others: graceful no-op with single log warning.
- **Restart Endpoint**: `src/web/server.ts` `/api/restart` — removed hardcoded `/Users/sage` path, now uses `process.cwd()` and `process.env.HOME || '/tmp'`.
- **Ignored Processes**: `src/config/ConfigManager.ts` — added Linux kernel threads (`kworker`, `ksoftirqd`, `rcu_preempt`, `migration`, `watchdogd`, `cpuhp`, `khugepaged`, `kcompactd0`, `oom_reaper`) alongside existing macOS ones (`kernel_task`, `WindowServer`, `mds`, `mdworker`).
- **Dashboard Battery UI**: `web/public/app.js` — detects `percent === 0 && isPlugged` as "no battery", shows `— N/A` / "No battery" / "Desktop / Server" instead of misleading `0%` on battery-less machines.
- **Disk Usage Fix (2026-06-26)**: `src/core/SystemCollector.ts` — on macOS Catalina+, prefer `/System/Volumes/Data` (the data volume) over `/` (the read-only system volume) for accurate disk usage reporting. Fixes bug where MacBooks showed ~20% usage when actually ~80% full.
- **Repo renamed**: `mac-process-monitor` → `process-monitor` on GitHub and locally.

---

## Completed Tasks (Recent)
- **T23: TypeScript Compilation** (2026-08-08) — Compiled src/ → dist/, eliminated tsx dependency, fixed ESM imports
- **T21: DB Size-Based Cleanup Fix** (2026-07-15) — Fixed size-based cleanup algorithm and foreign key constraint errors
- **T17: Multi-Device Dashboard V1** (2026-06-24) — Identity, QR pairing, peer polling, Tailscale/LAN/localhost
- **T15: Energy API** (2026-06-24) — `powermetrics` integration, `energy_mj` field
- **T13: Process Tree View** (2026-06-24) — `/api/process-tree`, tree/list toggle
- **T12: Data Export** (2026-06-24) — CSV/JSON endpoints, date range picker
- **T10: Reports** (2026-06-24) — `ReportGenerator.ts`, `--report` CLI, dashboard tab
- **T9: Sleep/Wake** (2026-06-24) — `sleep_wake_events` table, API endpoint, dashboard tab
- **T4-ext2: Dashboard v4** (2026-06-22) — Disk/network KPIs + charts, auto-save, drain settings
- **T2: Telegram/OpenClaw Alert Integration** (2026-06-18)
- **T8: LaunchDaemon Installation** (2026-06-15)
- **T6: Spike Detection** (2026-06-09)
- **T7: Battery Impact** (2026-06-09)
- **T4: Web Dashboard v2** (2026-06-10)
- **T3: Query Interface** (2026-06-10)

## Active Tasks
- **T22: Forensic Process Identification Layer** — Interval CPU profiler implemented, live process identity model added. Remaining: SQLite provenance storage, macOS forensic adapter (launchd/plist/sample/fs_usage), cross-platform adapters.

## Next Steps
- **T22:** Forensic Process Identification Layer — Continue with SQLite provenance tables and macOS launchd/plist adapter
- **T11a-d:** Natural Language Search subtasks (in beads queue)
- **T5:** Swift Menubar App — Native macOS experience
- **T14:** Anomaly Detection — Statistical outliers beyond thresholds
- **T18:** Relay Server — For Android+NordVPN cross-network monitoring
- **Mobile tree view:** Return to CSS layout fix later

## Implementation Details

Detailed implementation documentation for individual features:

- [Dashboard Detail Views](memory-bank/implementation-details/dashboard-detail-views.md) (T20) — Clickable KPI cards, context-aware detail views, per-subsystem drill-down
- [Cross-Platform Implementation](memory-bank/implementation-details/cross-platform-implementation.md) (T19) — Platform detection, OS-specific modules, support matrix
- [Spike Detection](memory-bank/implementation-details/spike-detection-implementation.md) (T1) — Dual-threshold algorithm, baseline tracking, cooldown system
- [Drain Detection](memory-bank/implementation-details/drain-detection-implementation.md) (T1) — Sliding window analysis, process correlation, alert format
- [Battery Impact Analysis](memory-bank/implementation-details/battery-impact-implementation.md) (T1) — Scoring formula, accumulation strategy, dashboard display
- [Multi-Device Dashboard](memory-bank/implementation-details/multi-device-dashboard-implementation.md) (T17) — Device identity, QR pairing, peer polling, network discovery

## System Status
- **Battery**: 53% (discharging, MacBook Air)
- **Memory**: ~17% used
- **DB**: `~/.procmon/monitor.db` — collecting every 30s
- **Dashboard**: Running on http://localhost:3456 with 7 tabs (Overview, Analysis, Devices, Settings, Reports, Sleep, **🚨 Watchdog**)
- **Monitor**: Running via `node dist/main.js` (compiled), collecting every 30s
- **GitHub Repo**: https://github.com/space-cadet/process-monitor (public, 30+ commits)
- **Git Status**: T23 changes staged (pending commit)
- **Network**: MacBook Air, Tailscale active
