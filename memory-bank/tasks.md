# Memory Bank - process-monitor Tasks

*Created: 2026-05-25*
*Last Updated: 2026-06-24*

## Overview

Task tracking for the process-monitor project. Tasks are ordered by priority (HIGH → LOW).

## Task Legend
- ✅ Complete
- 🔄 In Progress
- ⬜ Pending

---

## Completed Tasks

| ID | Title | Completed | Details |
|----|-------|-----------|---------|
| T1 | TypeScript Rewrite — Core Monitor | 2026-05-18 | [Details](tasks/T1.md) |
| T3 | Per-Process History Query Interface | 2026-06-10 | [Details](tasks/T3.md) |
| T4 | Web Dashboard for Live Monitoring | 2026-06-10 | Extended 2026-06-19 with Analysis + Settings tabs, 6 preset SQL queries, export. Extended 2026-06-22 with disk/network KPIs + charts, auto-save, drain settings, query caching. Extended 2026-06-24 with Reports tab, export UI, process tree toggle, device cards. | [Details](tasks/T4.md) |
| T6 | Process Spike Detection | 2026-06-09 | [Details](tasks/T6.md) |
| T7 | Battery Impact Correlation | 2026-06-09 | [Details](tasks/T7.md) |
| T8 | LaunchDaemon Installation for Auto-Start | 2026-06-15 | [Details](tasks/T8.md) |
| T2 | Telegram/OpenClaw Alert Integration | 2026-06-18 | [Details](tasks/T2.md) |
| T9 | Sleep/Wake Correlation Tracking | 2026-06-24 | `sleep_wake_events` table, `/api/sleep-wake-events`, Sleep tab in dashboard. [Details](tasks/T9.md) |
| T10 | "What Drained My Battery?" Report | 2026-06-24 | `ReportGenerator.ts`, `--report` CLI, Reports tab with health score + insights. [Details](tasks/T10.md) |
| T12 | Data Export (CSV/JSON) | 2026-06-24 | `/api/export/csv` and `/api/export/json`, date range picker in Reports tab. [Details](tasks/T12.md) |
| T13 | Process Tree View (Hierarchical) | 2026-06-24 | `/api/process-tree`, Tree/List toggle in Processes tab. [Details](tasks/T13.md) |
| T15 | macOS Energy API Integration | 2026-06-24 | `EnergyCollector.ts` — `powermetrics` energy (mJ), `energy_mj` field in DB. [Details](tasks/T15.md) |
| T17 | Multi-Device Dashboard V1 | 2026-06-24 | `DeviceIdentity`, `DeviceRegistry`, QR pairing, peer polling, Tailscale/LAN/localhost. [Details](tasks/T17.md) |

---

## Pending Tasks (Prioritized)

### 🔥 HIGH Priority

| ID | Title | Why | Est. Effort | Dependencies |
|----|-------|-----|-------------|--------------|
| T11 | Natural Language Search / Query Box | ⬜ PENDING — decomposed into 4 beads subtasks (T11a-d). See beads queue for details. | 4-5h total | None |

### 🔮 LOW Priority / Future

| ID | Title | Why | Est. Effort | Dependencies |
|----|-------|-----|-------------|--------------|
| T14 | Anomaly Detection with ML | Statistical outliers beyond simple thresholds | 6-8h | T6 |
| T5 | Swift Menubar App | Native macOS experience | 8-12h | None |
| T18 | Relay Server for Cross-Network | Android+NordVPN can't use Tailscale simultaneously | 3-4h | T17 |

---

## Task Relationships

```
T1: Core Monitor (done)
├── T2: Alerts (done) ──┬── T9: Sleep/Wake (done)
│                       ├── T10: Reports (done)
│                       └── T16: Native Notifications (deferred)
├── T3: Query Interface ──┬── T11: NL Search (next)
│                         └── T12: Export (done)
├── T4: Dashboard ──┬── T13: Process Tree (done)
│                   ├── T15: Energy API (done)
│                   └── T17: Multi-Device (done)
├── T6: Spike Detection ──→ T14: Anomaly Detection
├── T7: Battery Impact ──→ T10: Reports (done)
└── T8: LaunchDaemon (done)
```

## Recommended Implementation Order

1. **T11** — Natural language search (power user feature)
2. **T14** — Anomaly detection (advanced, after baseline data accumulates)
3. **T5** — Swift menubar app (big project, nice-to-have)
4. **T18** — Relay server (if Android+NordVPN monitoring becomes important)

## Status Summary

- **Completed**: 13 (T1, T2, T3, T4, T6, T7, T8, T9, T10, T12, T13, T15, T17)
- **Pending**: 4 (T5, T11, T14, T18)
- **Total**: 17

---

*Note: T16 was not originally planned — emerged from T2 implementation as an enhancement opportunity (replace osascript with UNUserNotificationCenter). T18 is a new task identified from T17 limitations (Android VPN conflict).*

