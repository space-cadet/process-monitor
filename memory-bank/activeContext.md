# Active Context

*Last Updated: 2026-06-22 18:12 IST*

## Current Tasks

### 🔥 T4: Dashboard Extended — Disk/Network Monitoring + Auto-Save + Drain Settings (Completed)
**Completed:** 2026-06-22. Fourth major extension to T4.

**What was added:**
- **Drain Detection Settings**: Adjustable via Settings panel (threshold 0.5%/min, min duration 1min, cooldown 5min) with more sensitive defaults
- **Client-Side Query Caching**: 5-minute TTL cache for analysis preset queries (prevents re-running expensive 7-day SQL)
- **Auto-Save Settings**: Debounced 500ms auto-save on any settings change; transient "💾 Saved" toast
- **Disk Monitoring**: KPI card (usage %), chart tab (I/O rate from cumulative counter deltas), analysis preset (daily usage trend)
- **Network Monitoring**: KPI card (live RX/TX throughput), chart tab (KB/s rate from counter deltas), analysis preset (daily RX/TX volume)
- **Mobile Fixes**: Chart tabs horizontally scrollable on narrow screens
- **Bug Fixes**: 404 on disk/network trend endpoints (server restart), y-axis auto-scaling with adaptive units, live network rate computation

**Files Modified:**
- `src/config/ConfigManager.ts` — sensitive drain defaults
- `src/storage/TimeSeriesDB.ts` — added disk/network columns to `getSnapshotHistory()`
- `src/web/server.ts` — `/api/analysis/disk-trend`, `/api/analysis/network-trend`
- `web/public/index.html` — new KPI cards, chart tabs, preset buttons, drain settings inputs
- `web/public/app.js` — auto-save, caching, rate computation, new renderers
- `web/public/styles.css` — disk/network accent colors, mobile chart tabs

---

### 🔥 T17: Multi-Device Dashboard — Syncthing-Inspired Architecture (Planning Complete)
**Created:** 2026-06-22. Design complete, implementation pending.

See `memory-bank/tasks/T17.md` for full spec.

---

## Completed Tasks (Recent)
- **T4-ext2: Dashboard v4** (2026-06-22) — Disk/network KPIs + charts, auto-save, drain settings, query caching, mobile fixes
- **T17-design: Multi-Device Dashboard Architecture** (2026-06-22) — Syncthing-inspired discovery, QR pairing, 3-layer model
- **T4-ext: Dashboard v3** (2026-06-19) — Analysis tab with 6 preset queries, Settings tab with restart/cleanup
- **T2: Telegram/OpenClaw Alert Integration** (2026-06-18)
- **T8: LaunchDaemon Installation** (2026-06-15)
- **T6: Spike Detection** (2026-06-09)
- **T7: Battery Impact** (2026-06-09)
- **T4: Web Dashboard v2** (2026-06-10)
- **T3: Query Interface** (2026-06-10)

## Next Steps
- **T17: Multi-Device Dashboard V1** — Identity endpoint, QR display, observer polling (HIGH priority)
- **T9: Sleep/Wake Correlation** — HIGH priority, biggest blind spot
- **T10: Automated Daily Report** — Builds on analysis endpoints already in place
- **T16: Native Notifications** — Replace osascript with UNUserNotificationCenter

## System Status
- **Battery**: 65%, plugged in
- **Memory**: ~97% used (normal for this Mac)
- **DB**: `~/.procmon/monitor.db` — ~90+ MB, 17K+ snapshots, 750K+ process samples
- **Dashboard**: Running on http://localhost:3456 with 5 chart tabs (Battery, CPU, Memory, Disk, Network)
- **Monitor**: Running via LaunchDaemon + cron check every 10 minutes
- **GitHub Repo**: https://github.com/space-cadet/process-monitor (public, 27+ commits)
- **Git Status**: Uncommitted changes from T4 v4 work
