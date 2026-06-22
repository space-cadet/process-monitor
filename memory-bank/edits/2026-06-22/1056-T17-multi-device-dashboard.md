# Multi-Device Dashboard — Syncthing-Inspired Architecture

## Context

2026-06-22 discussion between Deepak and Sage about monitoring multiple devices (MacBook, Cloudy server, Ember/Android) from a single mobile view. The current dashboard only monitors the local device.

## Problem

- Dashboard is bound to single-device monitoring
- IP address changes break mobile access (e.g., 192.168.1.20 → 192.168.1.39)
- No way to observe multiple devices in a unified view
- No simple pairing mechanism for new devices

## Solution: Syncthing-Style Discovery + QR Pairing

### Architecture Overview

Each device runs monitor + dashboard with an identity endpoint. Observer device scans QR code to pair, then polls for metrics.

### Discovery Layers

1. **Local Discovery (mDNS/Broadcast)** — Devices on same LAN find each other automatically
2. **Global Discovery Server** — Device registers endpoints; observer queries to find them
3. **Relay** — NAT traversal when direct connection fails; dumb pipe, encrypted data

### QR Code Contents

```json
{
  "did": "ABC123-DEF456",
  "name": "sage-macbook",
  "v": 1,
  "endpoints": [
    "http://192.168.1.39:3456",
    "http://sage-macbook.local:3456"
  ]
}
```

### Implementation Phases

| Phase | Feature | Approach |
|-------|---------|----------|
| V1 | Manual QR + polling | QR code display, manual URL entry, polling |
| V2 | mDNS auto-discovery | Bonjour `.local` hostnames, automatic reconnection |
| V3 | Full Syncthing | Global discovery + relay server on Cloudy |

### API Additions

- `GET /api/identity` — Device info, endpoints, QR code data
- `GET /api/metrics?since=<timestamp>` — Metrics since last poll
- `GET /api/devices` — Known devices list (for sync)

### Unified View (Observer)

- Device cards showing: name, battery%, top processes, alerts
- "Add Device" button with QR scanner or manual URL
- Offline indicator with "last seen" timestamp
- Mobile-responsive layout

## Files Modified

- `memory-bank/tasks/T17.md` — New task file created
- `memory-bank/tasks.md` — Added T17 to HIGH priority
- `memory-bank/activeContext.md` — Added T17 as current focus
- `memory-bank/session_cache.md` — Updated session context
- `memory-bank/edit_history.md` — Regenerated

## Decisions

- **V1 first**: Manual QR pairing with no server infrastructure
- **Device ID**: Persistent UUID stored in `~/.procmon/device-id`
- **No auth for V1**: Local network trust model, device ID as identity
- **Same codebase**: Observer mode as part of existing dashboard, not separate project
- **Polling over WebSocket**: Simpler for V1, WebSocket for V2 if needed

## Open Questions

1. Should observer be same dashboard in "observer mode" or separate page?
2. Authentication for V2+ — bearer token with device ID?
3. Cloudy as relay vs. separate relay server?
4. Mobile UI framework — Tailwind responsive or native wrapper?

## References

- Syncthing discovery protocol: https://docs.syncthing.net/specs/globaldisco-v3.html
- mDNS/Bonjour: macOS native, use `bonjour` npm package for V2
- Tailwind CSS: Already used in dashboard, continue for mobile

## Related

- T4: Dashboard (completed) — Foundation
- T8: LaunchDaemon (completed) — Required for always-on devices
- T12: Data Export — Could share format for inter-device sync

*Chunk created: 2026-06-22 10:56 IST*
