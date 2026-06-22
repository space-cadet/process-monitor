# Active Context

*Last Updated: 2026-06-19 00:52 IST*

## Current Tasks

### 🔥 T17: Multi-Device Dashboard — Syncthing-Inspired Architecture (New — Planning)
**Created:** 2026-06-22. Design complete, implementation pending.

**Problem:** Current dashboard only monitors local device. Need unified view of all devices (MacBook, Cloudy, Ember) from mobile.

**Design Decisions:**
- Syncthing-style discovery: local mDNS, global discovery server, relay fallback
- QR code pairing: device shows QR → observer scans → done
- V1: Manual QR + polling (no infrastructure)
- V2: Add mDNS auto-discovery
- V3: Full global discovery + relay on Cloudy

**API additions:** `GET /api/identity`, `GET /api/metrics?since=`, `GET /api/devices`

**Next:** Implement V1 — identity endpoint, QR display, observer polling, unified card view

---

### 🔥 T4: Dashboard Extended — Analysis + Settings Tabs (Completed / Extended)
Added 2026-06-19. Three-tab dashboard: Overview, Analysis, Settings.

**Completed:**
- **Analysis Tab**: 6 preset SQL queries (Battery Trend, Top Battery Impact, Spike Patterns, Drain Correlation, Idle vs Active, Process Consistency), quick stats panel, JSON/CSV export
- **Settings Tab**: Restart monitor button, confirmation dialog for cleanup, config management, logging toggles
- **Cron fix**: Auto-starts both monitor AND dashboard if either goes down
- **API additions**: 9 new endpoints (`/api/analysis/*`, `/api/db-size`, `/api/server-info`, `/api/restart`)

## Completed Tasks (Recent)
- **T17-design: Multi-Device Dashboard Architecture** (2026-06-22) — Syncthing-inspired discovery, QR pairing, 3-layer discovery model, V1/V2/V3 phases
- **T4-ext: Dashboard v3** (2026-06-19) — Analysis tab with 6 preset queries, Settings tab with restart/cleanup, 3-tab navigation, cache-busted frontend
- **T2: Telegram/OpenClaw Alert Integration** (2026-06-18) — AlertSender, wired into Monitor, macOS notifications tested
- **T8: LaunchDaemon Installation** (2026-06-15) — Two LaunchDaemons, auto-start on boot
- **T6: Spike Detection** (2026-06-09) — Baseline tracking, dual-threshold, DB storage, CLI + dashboard
- **T7: Battery Impact** (2026-06-09) — Drain detection, impact scoring, CLI + dashboard
- **T4: Web Dashboard v2** (2026-06-10) — Side-by-side layout, 12 API endpoints, profiles CRUD
- **T3: Query Interface** (2026-06-10) — CLI with `--spikes`, `--battery`, `--top`, `--process`, `--stats`

## Next Steps
- **T17: Multi-Device Dashboard V1** — Identity endpoint, QR display, observer polling, unified view (HIGH priority)
- **T9: Sleep/Wake Correlation** — HIGH priority, biggest blind spot
- **T10: Automated Daily Report** — Builds on analysis endpoints already in place
- **T16: Native Notifications** — Replace osascript with UNUserNotificationCenter

## System Status
- **Battery**: Varies (monitoring active)
- **Memory**: Normal
- **DB**: `~/.procmon/monitor.db` — ~90+ MB, 17K+ snapshots, 750K+ process samples
- **Dashboard**: Running on http://localhost:3456 with 3 tabs (Overview, Analysis, Settings)
- **Monitor**: Running via LaunchDaemon + cron check every 10 minutes
- **GitHub Repo**: https://github.com/space-cadet/mac-process-monitor (public, 27 commits)
- **Git Status**: Uncommitted changes from dashboard v3 work
