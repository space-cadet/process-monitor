# Active Context

*Last Updated: 2026-06-24 13:22 IST*

## Current Tasks

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

### 🛠️ Cross-Platform Fixes (2026-06-24)
- **SleepWakeDetector**: `src/core/SleepWakeDetector.ts` — `getPlatform()` helper detects `darwin`/`linux`/`windows`/`other`. macOS: `ioreg`+`pmset`. Linux: reads battery from `/sys/class/power_supply/BAT*/capacity` + `status`. Others: graceful no-op with single log warning.
- **Restart Endpoint**: `src/web/server.ts` `/api/restart` — removed hardcoded `/Users/sage` path, now uses `process.cwd()` and `process.env.HOME || '/tmp'`.
- **Ignored Processes**: `src/config/ConfigManager.ts` — added Linux kernel threads (`kworker`, `ksoftirqd`, `rcu_preempt`, `migration`, `watchdogd`, `cpuhp`, `khugepaged`, `kcompactd0`, `oom_reaper`) alongside existing macOS ones (`kernel_task`, `WindowServer`, `mds`, `mdworker`).
- **Dashboard Battery UI**: `web/public/app.js` — detects `percent === 0 && isPlugged` as "no battery", shows `— N/A` / "No battery" / "Desktop / Server" instead of misleading `0%` on battery-less machines.
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
- **T11a-d:** Natural Language Search subtasks (in beads queue)
- **T5:** Swift Menubar App — Native macOS experience
- **T14:** Anomaly Detection — Statistical outliers beyond thresholds
- **T18:** Relay Server — For Android+NordVPN cross-network monitoring
- **Mobile tree view:** Return to CSS layout fix later

## System Status
- **Battery**: N/A (Linux VPS — no battery)
- **Memory**: ~17% used (Linux VPS, 2GB RAM)
- **DB**: `~/.procmon/monitor.db` — 83 snapshots, 532KB (fresh start on Linux VPS)
- **Dashboard**: Running on http://localhost:3456 with 6 tabs (Overview, Analysis, Devices, Settings, Reports, Sleep)
- **Monitor**: Running via `npx tsx src/main.ts` on Linux VPS, collecting every 30s
- **GitHub Repo**: https://github.com/space-cadet/process-monitor (public, 30+ commits)
- **Git Status**: All changes committed (commits `1561ca2`, `18a7024` pushed)
- **Network**: VPS public IP, no Tailscale on this node
