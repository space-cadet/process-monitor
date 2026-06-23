# Edit History

*Last Updated: 2026-06-22 18:12 IST*

---

## 2026-06-22

#### 18:12 IST - T4: Dashboard v4 — Disk/Network Monitoring + Auto-Save + Drain Settings

**T4 Extended Again: Dashboard v4**
- Modified `src/config/ConfigManager.ts` — More sensitive drain detection defaults (threshold 0.5%/min, minDuration 1min, cooldown 5min)
- Modified `src/storage/TimeSeriesDB.ts` — `getSnapshotHistory()` now returns disk/network columns for chart rate computation
- Modified `src/web/server.ts` — Added `/api/analysis/disk-trend` and `/api/analysis/network-trend` endpoints
- Modified `web/public/index.html` — New Disk/Network KPI cards, chart tabs, analysis preset buttons, drain detection settings inputs
- Modified `web/public/app.js` — Auto-save with 500ms debounce, client-side query caching (5-min TTL), live network rate computation from snapshot deltas, disk/network chart rate computation, adaptive y-axis formatters, mobile chart tab overflow fix
- Modified `web/public/styles.css` — Disk (#8b5cf6) and Network (#06b6d4) accent colors, mobile horizontal scroll for chart tabs
- Restarted dashboard server to activate new endpoints

**Features**
- Drain Detection settings adjustable via Settings panel with more sensitive defaults
- Client-side analysis query caching prevents re-running expensive SQL
- Auto-save settings with transient "💾 Saved" toast
- Disk KPI (usage %), chart (I/O rate), and analysis preset (daily trend)
- Network KPI (live RX/TX throughput), chart (KB/s rate), and analysis preset (daily volume)
- Adaptive unit labels: B/s → KB/s → MB/s based on magnitude

---

#### 10:56 IST - T17: Multi-Device Dashboard — Syncthing-Inspired Architecture

**T17 Design: Multi-Device Dashboard (Planning Complete)**
- Created `memory-bank/tasks/T17.md` — Full technical specification with architecture, API design, implementation phases
- Created edit chunk `edits/2026-06-22/1056-T17-multi-device-dashboard.md` — Detailed plan and decisions
- Updated `tasks.md` — Added T17 to HIGH priority
- Updated `activeContext.md` — Added T17 as current focus, updated next steps
- Updated `session_cache.md` — Added T17 design completion to session context
- Updated `check-and-start.sh` — Port-based dashboard check (more robust than process name matching)

**Architecture Overview**
- Syncthing-style discovery: local mDNS (Layer 1), global discovery server (Layer 2), relay fallback (Layer 3)
- QR code pairing: device shows QR → observer scans → polls for metrics
- Each device runs: monitor + dashboard + identity endpoint
- Observer: unified view of all devices as cards (battery, processes, alerts)

**Implementation Phases**
- V1: Manual QR + polling (no infrastructure) — immediate
- V2: QR + mDNS auto-discovery — local network
- V3: Full Syncthing — global discovery + relay on Cloudy

**API Design**
- `GET /api/identity` → `{ did, name, version, endpoints[] }`
- `GET /api/metrics?since=<timestamp>` → `{ battery, processes, alerts, timestamp }`
- `GET /api/devices` → known devices list

**Open Questions**
- Observer mode: separate page or same dashboard?
- Authentication for V2+: bearer token with device ID?
- Cloudy as relay vs. separate relay server?
- Mobile UI framework: continue Tailwind or native wrapper?

**New Task: T17** — Multi-Device Dashboard (HIGH priority, 4-6h estimated, depends on T4 done)

---

## 2026-06-19

#### 00:52 IST - T4: Dashboard Analysis & Settings Tabs

**Dashboard v3: Three-Tab Redesign**
- Modified `src/web/server.ts` — Added 6 analysis API endpoints (`/api/analysis/*`), `/api/db-size`, `/api/server-info`, `/api/restart`
- Modified `web/public/index.html` — Restructured into 3 tabs (Overview, Analysis, Settings); Quick Stats moved above preset queries; added restart button and confirmation dialog
- Modified `web/public/app.js` — Tab switching, preset query handlers, analysis result rendering, JSON/CSV export, quick stats loading
- Modified `web/public/styles.css` — Main tab styles, analysis layout, preset buttons, quick stats, analysis tables, activity badges
- Modified `check-and-start.sh` — Auto-start both monitor and dashboard if either is down
- Fixed SQL queries for SQLite3 compatibility (removed `LAG()` window functions, added `JOIN snapshots` for time filtering)

**Analysis Tab Features**
- 6 preset queries: Battery Trend, Top Battery Impact, Spike Patterns, Drain Correlation, Idle vs Active, Process Consistency
- Quick stats panel: total samples, drain events, spikes, days logged
- JSON and CSV export for query results

**Settings Tab Features**
- Restart Monitor button (`/api/restart` endpoint)
- Confirmation dialog before cleanup (`confirm()` with retention days)
- Config management, logging toggles, cleanup, auto-refresh interval

---

## 2026-06-18

#### 02:24 IST — T2: Telegram Alerts + Settings Tab + New Tasks T9-T16

**T2: Telegram/OpenClaw Alert Integration** ✅
- NEW `src/core/AlertSender.ts` — Telegram Bot API + macOS osascript notifications
- MOD `src/core/Monitor.ts` — wired AlertSender into drain/spike/battery-impact handlers
- Tested: macOS notification fires, Telegram path logs correctly when no token

**Settings Tab Enhancement**
- Dashboard Settings panel now has full config management:
  - Retention: max age (days) + max size (MB), OR logic
  - Logging toggles: battery, processes, spikes, impact
  - Sample interval, save button, restart notice
- Backend: `/api/config` GET/POST, `saveConfig()` writes to `~/.procmon/config.json`
- Monitor: auto-cleanup every 100 ticks with size+age thresholds
- DB: `insertSnapshot(snapshot, includeProcesses)` flag to optionally skip process storage

**DB Growth Analysis**
- 90.2 MB, 14,769 snapshots, ~11.2 MB/day growth rate
- Projections: 30d=335MB, 90d=1GB, 1yr=4GB

**New Task Files Created**: T9, T10, T11, T12, T13, T14, T15, T16
- Full specs with technical approach, estimated effort, dependencies
- Updated `tasks.md` with prioritized list and recommended implementation order

---

## 2026-06-15

#### 07:45 IST - T8: LaunchDaemon Installation + Git History Recovery

**T8: LaunchDaemon Installation for Auto-Start**
- Created `ai.openclaw.procmon.monitor.plist` — LaunchDaemon for core monitor (runs as sage, PID 53211)
- Created `ai.openclaw.procmon.dashboard.plist` — LaunchDaemon for web dashboard (runs as sage, PID 57453, port 3456)
- Installed at `/Library/LaunchDaemons/` with root:wheel ownership and 644 permissions
- Resolved port conflict: old `com.process-monitor.dashboard.plist` was holding port 3456, removed it
- Verified both services running via `launchctl list`
- Dashboard responding with HTTP 200 on http://localhost:3456
- Auto-start on boot confirmed

**GitHub Sync: T6/T7 Commit**
- Pushed T6/T7 features to GitHub (commit `f7e295a`)
- Full 27-commit history restored after `--depth 1` goof-up
- User's canonical copy at `/Users/deepak/code/process-monitor` needs `git pull`

---

## 2026-06-10

#### 14:30 IST - T4 Dashboard Rebuild + T3 Queries

**T4: Web Dashboard Rebuilt**
- Rebuilt dashboard with full features: side-by-side layout, sortable columns, process detail modal
- Added T6 spike panel and T7 battery impact panel
- Profile CRUD with color coding
- Auto-refresh every 5 seconds

**T3: Per-Process Query Interface**
- CLI: `npx tsx src/query.ts` with `--spikes`, `--battery`, `--top`, `--process`, `--stats`
- Dashboard API: all query endpoints exposed

---

## 2026-06-09

#### 18:00 IST - T6: Process Spike Detection + T7: Battery Impact

**T6: Process Spike Detection**
- `SpikeDetector.ts` with per-process baseline tracking
- Dual-threshold: absolute + relative to baseline
- `process_spikes` table with cooldown

**T7: Battery Impact Correlation**
- `BatteryImpactAnalyzer.ts` with drain period detection
- Per-process impact scoring (CPU-seconds × duration)
- `battery_impact` + `battery_impact_events` tables

---

## 2026-05-19

#### 10:00 IST - Expanded Metrics + Architecture Docs

- Added: disk I/O, network I/O, disk usage, CPU temperature, per-process breakdown
- Updated memory bank with correct TypeScript architecture

---

## 2026-05-18

#### 09:00 IST - T1: TypeScript Rewrite

- Rewrote from Python to TypeScript
- Core: SystemCollector, DrainAnalyzer, TimeSeriesDB, Monitor
- Initial memory bank setup (T2-T5 planned)
