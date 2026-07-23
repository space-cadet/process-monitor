# Active Context

*Last Updated: 2026-07-23 10:07:03 IST*

## Current Tasks

### 🔄 T22: Forensic Process Identification Layer — First Slice Implemented (2026-07-23)
**Status:** Active. Initial live forensics and UI repair slice implemented; deeper persisted provenance and macOS launchd/plist adapter remain.

**Context:** Live troubleshooting showed that the monitor can surface CPU and process trends, but cannot yet fully identify troublesome processes. The missing layer is forensic attribution: cumulative interval CPU, stable process identity, parent/service ownership, launchd/plist mapping, open files/listener ports, and on-demand stack/IO traces.

**Platform decision:** Keep the architecture cross-platform by using a common evidence model and platform adapters. Implement macOS first because the current Sage/OpenClaw issues depend on `launchctl`, LaunchAgent/LaunchDaemon plists, `lsof`, `sample`, and `fs_usage`. Linux should map through `/proc`, `systemctl`, cgroups, `ss`/`lsof`, and optional tracing. Windows should map through WMI/PowerShell, Services, Scheduled Tasks, ETW/Event Logs, and handle/socket inspection.

**Documentation added:**
- `memory-bank/tasks/T22.md`
- `memory-bank/implementation-details/forensic-process-identification.md`

**Implemented first slice:**
- Fixed current dashboard gaps: Recent Drain Events field mismatch, Sleep range mismatch, Analysis default blank state, Reports default blank state, duplicated Process Consistency renderer, and rough report markdown spacing.
- Added `/api/process-forensics` for live process identity, parent chain, recent CPU summary, findings, listener ports, and open files.
- Added `/api/process-cpu-profile` for bounded interval CPU profiling by cumulative CPU-time deltas.
- Added `/api/analysis/troublesome-processes` and UI presets/actions for Troublesome Processes and 5-second CPU Profile.
- Added process modal forensic sections for Identity, Ownership, Findings, Listener Ports, and Open Files.
- Made dashboard host configurable with `HOST`, preserving default `0.0.0.0` while enabling loopback-only verification.

**Validation:** `npm run build`, `git diff --check`, and browser smoke test on `HOST=127.0.0.1 PORT=3457 ./node_modules/.bin/tsx src/web/server.ts`.

---

### ✅ T21: DB Size-Based Cleanup — FIXED (2026-07-15)
**Status:** Complete. Deployed and committed (`5ca8f1a`).

**Problem:** `cleanupOldSamples(retentionDays)` only accepted 1 parameter, silently ignoring `maxSizeMB`. DB grew to 608MB (108MB over 500MB limit). Cleanup only ran by age (30 days), never by size.

**Fixes:**
1. `cleanupOldSamples(retentionDays, maxSizeMB?)` — optional size parameter
2. After time-based cleanup, if DB still > `maxSizeMB`, deletes oldest snapshots in 500-record batches until under limit
3. Runs `VACUUM` to reclaim disk space
4. Added missing `process_spikes` foreign key cleanup (was causing `SQLITE_CONSTRAINT_FOREIGNKEY` errors)
5. `Monitor.ts` passes `retentionSizeMB` (default 400MB) to cleanup
6. Dashboard `/api/cleanup` accepts `maxSizeMB` parameter
7. Bonus: fixed `check-anomalies.ts` — `better-sqlite3` v12 removed `.pluck()`, replaced with `.get()` + column alias

**Files changed:**
- `src/storage/TimeSeriesDB.ts` — cleanup method + size-based batch deletion
- `src/core/Monitor.ts` — pass `retentionSizeMB` to cleanup
- `src/web/server.ts` — `/api/cleanup` accepts `maxSizeMB`
- `src/scripts/check-anomalies.ts` — replace `.pluck()` with `.get()`
- `package.json` — bump `better-sqlite3` to `^12.0.0`

---

### 🔄 T20: Dashboard Detail Views — Clickable KPI Cards
**Status:** Phase 2 complete (all views functional with existing data). Phases 3-4 pending backend APIs.
**Started:** 2026-06-26.

**Implemented:**
- **CPU** → Process list sorted by CPU ✅ (Phase 1)
- **Memory** → Memory pressure gauge + process list sorted by memory ✅ (Phase 2)
- **Disk** → Disk usage gauge + I/O counters ✅ (Phase 2)
- **Network** → RX/TX/Total rate cards ✅ (Phase 2)
- **Battery** → Battery status + per-process energy table ✅ (Phase 2)
- **Status** → Load avg, CPU temp, process count, last update ✅ (Phase 2)

**Pending backend APIs:**
- `/api/disk-volumes` — per-mount stats, I/O throughput, queue depth, SMART
- `/api/network-interfaces` — per-interface RX/TX/errors/drops
- `/api/network-connections` — active TCP/UDP connections
- `/api/battery-history` — battery % over time range
- `/api/process-energy` — per-process energy scores over time

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

## Next Steps
- **T22:** Persist process identity/provenance into SQLite and implement full macOS launchd/plist validation with `launchctl`, plist scans, `sample`, and `fs_usage`.
- **T20:** Dashboard Detail Views — clickable KPI cards (design complete, implement Phase 1)
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
- **Battery**: N/A (Linux VPS — no battery)
- **Memory**: ~17% used (Linux VPS, 2GB RAM)
- **DB**: `~/.procmon/monitor.db` — ~600MB (will cleanup to ~400MB on next monitor cycle)
- **Dashboard**: Running on http://localhost:3456
- **Monitor**: Running via `npx tsx src/main.ts` on Linux VPS, collecting every 30s
- **GitHub Repo**: https://github.com/space-cadet/process-monitor (public, 30+ commits)
- **Git Status**: All changes committed (commits `2127ae6`, `012d23b`, `db32fc0` pushed)
- **Network**: VPS public IP, no Tailscale on this node
