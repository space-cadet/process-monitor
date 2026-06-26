# Dashboard Detail Views — Clickable KPI Cards (T20)

*Created: 2026-06-26*
*Status: 🔄 Design Complete, Pending Implementation*
*Task: T20*

## Overview

Replace the static process list below the KPI cards with a context-aware detail view. Clicking each card (CPU, Memory, Disk, Network, Battery) switches the bottom panel to show relevant details for that subsystem.

## Current State

The dashboard shows:
- Row of 5 KPI cards (CPU, Memory, Disk, Network, Battery)
- Below: always the process list sorted by CPU
- Charts section below that (battery/CPU/memory/disk/network toggles)

## Proposed Interaction

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  CPU    │ │ MEMORY  │ │  DISK   │ │ NETWORK │ │ BATTERY │
│  23%    │ │  4.1GB  │ │  45%    │ │ 1.2MB/s │ │  87%    │
│ Normal  │ │ Used    │ │ Normal  │ │ RX heavy│ │ 2h left │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │           │
     └───────────┴───────────┴───────────┴───────────┘
                         │
                    (selected card
                     highlights, view
                     swaps below)
┌─────────────────────────────────────────────────────────┐
│  DETAIL VIEW (context-aware, scrollable)                │
│                                                         │
│  [Content depends on selected card — see below]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Card → Detail View Mapping

### CPU Card (default view)
- **What shows:** Process list sorted by CPU % (current default)
- **Columns:** Name | PID | CPU % | Memory | State | Type badge
- **Sortable:** Yes (CPU, memory, name, PID)
- **Search:** Yes (filters name + PID)
- **Tree toggle:** Yes (hierarchical/tree view)

### Memory Card
- **What shows:** Process list sorted by RSS memory
- **Additional info:**
  - System memory pressure gauge (used/total)
  - Swap usage bar
  - Memory pressure level (normal/warning/critical — macOS `memorypressure` or Linux `vmstat`)
- **Columns:** Name | PID | RSS | VMS | Memory % | Type badge

### Disk Card
- **What shows:** Disk / volume / mount point list
- **Columns:** Mount | Type | Size | Used % | I/O Read | I/O Write | I/O Wait % | Queue Depth
- **Per-row sparkline:** 60s mini-chart of I/O throughput
- **SMART status badge:** (if available) Healthy / Warning / Critical
- **Sortable:** By used %, I/O throughput, queue depth

**Data sources:**
- `si.fsSize()` — mount points, size, used %
- `si.disksIO()` — aggregate I/O counters
- `si.blockDevices()` — per-device info (Linux)
- `si.diskLayout()` — SMART status (if supported)

**Platform notes:**
- macOS Catalina+: show both `/` and `/System/Volumes/Data` with labels (System / Data)
- Linux: show all block devices + LVM volumes
- Windows: show drive letters

### Network Card
- **What shows:** Network interface list + active connections
- **Interface columns:** Name | Type | State | Speed | RX Rate | TX Rate | Errors | Drops
- **Connection table (collapsible):** Process | Local | Remote | State | Protocol
- **Latency mini-card:** Ping to gateway / 8.8.8.8 (sparkline)

**Data sources:**
- `si.networkStats()` — per-interface RX/TX bytes, packet counts, errors, drops
- `si.networkInterfaces()` — interface type, speed, duplex, MTU
- `si.networkConnections()` — active TCP/UDP connections with PID
- `si.inetLatency(host)` — round-trip time

**Platform notes:**
- Filter out loopback (`lo` / `lo0`) from default view (show in expanded view)
- VPN tunnels (`utun*`, `tun*`, `wg*`) get a "VPN" badge
- Docker bridges (`docker0`, `br-*`) get a "Container" badge

### Battery Card
- **What shows:** Battery history chart + per-process energy/impact table
- **Top section:**
  - 24h battery level line chart
  - Charge/discharge rate indicator
  - Cycle count, health % (if available)
- **Bottom section:**
  - Per-process energy table (macOS: `energy_mj` from `top`)
  - Per-process battery impact table (all platforms: derived from `battery_impact` during drain events)
  - Columns: Process | Energy Score | Impact Score | Drain Events | Avg CPU during drain

**Data sources:**
- `snapshots.battery_percent` — historical levels
- `process_samples.energy_mj` — macOS per-process energy
- `battery_impact` / `battery_impact_events` — derived impact scores

**Platform notes:**
- macOS: show both raw energy (from `top`) AND derived impact
- Linux/Windows laptops: show only derived impact (requires drain events)
- Desktop/server (no battery): show "No battery detected" with a suggestion to hide the card via settings

## UI/UX Details

### Card Selection
- Clicking a card adds an `active` CSS class (subtle border/highlight)
- Default active card: CPU (on first load)
- Last selected card persisted to `localStorage` (key: `procmon_active_card`)
- Keyboard navigation: Tab cycles cards, Enter selects

### Responsive Behavior
- Mobile (< 768px): Cards scroll horizontally, detail view stacks below
- Tablet: Cards in 3+2 grid, detail view full width
- Desktop: Cards in single row, detail view full width

### Animation
- 200ms CSS transition on detail view swap (fade + slight slide)
- Card highlight: `transform: translateY(-2px)` + border color change

## Data Collection Changes

### New fields to collect (backend):
1. **Per-interface network stats** — currently we only collect the "primary" interface. We need ALL interfaces every tick.
2. **Network latency** — periodic ping to configurable host (default: gateway, fallback: 8.8.8.8)
3. **Disk I/O wait %** — from `si.disksIO().ms` or `si.disksIO().busy`
4. **Disk queue depth** — from `si.disksIO().queue`
5. **Memory pressure** — macOS: `memory_pressure` command; Linux: `vmstat` si/so fields

### New DB columns:
- `snapshots`: `disk_io_wait_ms`, `disk_queue`, `memory_pressure`
- New table: `network_interfaces` — per-interface RX/TX/error/drop counters per snapshot
- New table: `network_latency` — timestamp, host, latency_ms

## API Changes

### New endpoints:
- `GET /api/network-interfaces` — current per-interface stats
- `GET /api/network-connections` — active connections (optionally filtered by state)
- `GET /api/network-latency` — recent latency samples
- `GET /api/disk-volumes` — current volume/mount stats
- `GET /api/battery-history` — battery % over time range
- `GET /api/process-energy` — per-process energy scores (time range)

### Modified endpoints:
- `GET /api/snapshots` — include new fields (disk_io_wait_ms, memory_pressure)
- `GET /api/metrics` (peer polling) — include disk volume list, network interface list

## Implementation Order

### Phase 1: Frontend skeleton (no new data)
- Card click handlers + active state
- Detail view container with 5 sub-views
- CPU view: move existing process list into detail container
- Memory view: process list sorted by memory + memory pressure gauge (using existing data)
- Persist active card to localStorage

### Phase 2: Disk detail view
- Backend: collect per-disk data (`si.blockDevices()`, `si.fsSize()`)
- Backend: new `/api/disk-volumes` endpoint
- Frontend: disk volume table with sparklines

### Phase 3: Network detail view
- Backend: collect all interfaces, not just primary
- Backend: `/api/network-interfaces`, `/api/network-connections`
- Frontend: interface table + connections table

### Phase 4: Battery detail view
- Backend: `/api/battery-history`, `/api/process-energy`
- Frontend: battery chart + energy/impact tables

### Phase 5: Polish
- Responsive layout fixes
- Keyboard navigation
- Card visibility settings (hide cards for systems without battery, etc.)

## Design Reference

- **Inspiration:** iStat Menus (macOS) — clean card-based layout with drill-down detail
- **Color coding:** Use existing `--accent-cpu`, `--accent-memory`, `--accent-disk`, `--accent-network`, `--accent-battery` CSS variables for card highlights
- **Typography:** Existing dashboard font stack (system-ui, sans-serif)

## Related Tasks

- Depends on: T4 (Dashboard) — existing card layout and process list
- Complements: T17 (Multi-Device) — peer devices should also show these detail views
- Future: T14 (Anomaly Detection) — could highlight anomalous processes/connections in these views

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/public/app.js` | Major refactor | Card click handlers, detail view rendering, 5 sub-view functions |
| `web/public/styles.css` | Add styles | Card active state, detail view transitions, disk/network/battery tables |
| `src/core/SystemCollector.ts` | Extend | Collect per-interface network, disk queue, memory pressure |
| `src/storage/TimeSeriesDB.ts` | Extend | New tables: network_interfaces, network_latency; new columns: disk_io_wait_ms, memory_pressure |
| `src/web/server.ts` | Add endpoints | `/api/disk-volumes`, `/api/network-interfaces`, `/api/network-connections`, `/api/network-latency`, `/api/battery-history`, `/api/process-energy` |
| `src/types/index.ts` | Extend | New types: NetworkInterfaceStats, DiskVolume, NetworkConnection, LatencySample |

## Open Questions

1. **Should the charts section (below detail view) also change based on selected card?** Currently the chart tabs are battery/CPU/memory/disk/network. Should clicking the CPU card auto-select the CPU chart? Or keep charts as a separate concern?
2. **Disk I/O per process:** Requires root on macOS (`fs_usage`) and Linux (`iotop`). Worth the complexity?
3. **Network bandwidth per process:** Requires root on all platforms (`nettop`, `nethogs`). Worth the complexity?
4. **Should we show the process list in ALL detail views?** E.g., in Disk view, show "processes with highest disk I/O" — but we don't have per-process disk I/O. Without it, the disk view is just a volume list.

---

*Next step: Implement Phase 1 (frontend skeleton with card-click switching)*
