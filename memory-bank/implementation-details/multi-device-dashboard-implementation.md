# Multi-Device Dashboard Implementation (T17)

*Created: 2026-06-24*
*Last Updated: 2026-06-24*
*Status: ✅ Complete*
*Task: T17*

## Overview

The multi-device dashboard allows monitoring multiple machines from a single web interface. One device runs the full dashboard + monitor, while other devices run only the monitor (or a lightweight metrics endpoint). The dashboard polls peers for metrics and displays them in a unified view.

## Architecture

```
┌─────────────────┐     QR Scan / Manual     ┌─────────────────┐
│  Device A       │ ◄─────────────────────── │  Device B       │
│  (Dashboard)    │                          │  (New Device)   │
│                 │     HTTP GET /metrics    │                 │
│  Polls peers    │ ───────────────────────► │  Serves metrics │
│  every 30s      │                          │                 │
└─────────────────┘                          └─────────────────┘
```

## Device Identity

Each device gets a UUIDv4 `did` (device ID) persisted to `~/.procmon/config/device.json`:

```json
{
  "did": "550e8400-e29b-41d4-a716-446655440000",
  "name": "MacBook Pro",
  "platform": "darwin",
  "createdAt": 1719212345678
}
```

The name defaults to the hostname but can be customized via the dashboard.

## Network Discovery

### Auto-Detected Endpoints
The device automatically detects its own network endpoints:

```typescript
// From src/core/DeviceIdentity.ts
function getAllEndpoints() {
  const endpoints = [];
  
  // LAN IPs: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
  const lanIPs = getLocalIPs();
  for (const ip of lanIPs) {
    endpoints.push(`http://${ip}:3456`);
  }
  
  // Tailscale IPs: 100.x.x.x
  const tailscaleIPs = getTailscaleIPs();
  for (const ip of tailscaleIPs) {
    endpoints.push(`http://${ip}:3456`);
  }
  
  // localhost (always works)
  endpoints.push('http://localhost:3456');
  
  return endpoints;
}
```

### Why Multiple Endpoints?
- LAN IPs work when devices are on the same WiFi
- Tailscale IPs work across networks (VPN mesh)
- localhost is the fallback for same-machine access
- The dashboard tries all endpoints when polling a peer

## Device Registry

Peers are stored in `~/.procmon/devices.json`:

```json
[
  {
    "did": "550e8400-e29b-41d4-a716-446655440000",
    "name": "MacBook Pro",
    "endpoints": ["http://192.168.1.42:3456", "http://100.92.54.38:3456"],
    "lastSeen": 1719212345678,
    "status": "online"
  }
]
```

### Registry Operations
- **Register:** POST `/api/devices` with device identity JSON
- **Remove:** DELETE `/api/devices?id=X`
- **Heartbeat:** POST `/api/devices/heartbeat` (updates `lastSeen`)
- **List:** GET `/api/devices` returns all registered peers

## Pairing Flow

### QR Code Pairing
1. Dashboard device shows QR code at `/api/qr`
2. QR contains JSON with `did`, `name`, and all `endpoints`
3. New device scans QR code
4. New device POSTs its identity to one of the dashboard's endpoints
5. Dashboard adds new device to registry
6. Dashboard starts polling new device every 30s

### Manual Pairing
1. On new device, run `npx tsx src/show-data.ts` to get identity
2. Copy the device JSON
3. On dashboard device, POST to `/api/devices` with the JSON
4. Dashboard starts polling

## Peer Polling

### Metrics Endpoint (`GET /api/metrics`)
Returns a lightweight JSON payload:

```json
{
  "did": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1719212345678,
  "battery": {
    "percent": 78,
    "isCharging": false,
    "isPlugged": true
  },
  "cpu": {
    "total": 23.5,
    "user": 15.2,
    "system": 8.3
  },
  "memory": {
    "usedPercent": 45.2,
    "usedMB": 8192,
    "totalMB": 16384
  },
  "topProcesses": [
    {"name": "Chrome", "cpu": 12.5, "mem": 234},
    {"name": "node", "cpu": 8.3, "mem": 156}
  ]
}
```

### Why Not Full Snapshot?
- Reduces bandwidth (metrics is ~500 bytes vs snapshot ~10KB)
- Reduces peer processing (no process tree needed)
- Faster polling (30s interval is reasonable)

### Polling Logic
```javascript
// From web/public/app.js
async function pollPeer(device) {
  for (const endpoint of device.endpoints) {
    try {
      const response = await fetch(`${endpoint}/api/metrics`, {
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      if (response.ok) {
        const data = await response.json();
        updatePeerCard(device.did, data);
        device.status = 'online';
        return;
      }
    } catch (e) {
      // Try next endpoint
    }
  }
  device.status = 'offline';
}
```

The dashboard tries ALL endpoints for each device. If any works, the device is online. If none work, it's marked offline.

## Dashboard UI

### Devices Tab
- Grid of peer cards showing:
  - Device name + status (online/offline)
  - Battery percentage + charging indicator
  - CPU usage sparkline
  - Memory usage
  - Top 2 processes
  - Last seen timestamp

### Online vs Offline
- **Online:** Green indicator, shows live metrics, sparkline updates
- **Offline:** Red indicator, shows last known metrics, "Last seen X minutes ago"
- A device is offline if ALL endpoints fail for 2 consecutive polling cycles (1 minute)

## Configuration

```json
{
  "dashboard": {
    "port": 3456,
    "refreshIntervalMs": 5000
  }
}
```

(Note: Peer polling interval is hardcoded at 30s in the dashboard frontend.)

## Key Design Decisions

### Why HTTP Polling?
- WebSockets would require persistent connections and more complex infrastructure
- HTTP polling is stateless, simple, and works through NAT/Tailscale
- 30s interval is fast enough for monitoring, slow enough to be lightweight
- If a device is offline, the dashboard just gets 404s — no connection management needed

### Why QR Code Pairing?
- Manual IP entry is error-prone (especially Tailscale IPs)
- QR code contains all endpoints — no need to know which network the peer is on
- One scan pairs all endpoints automatically
- Works on mobile (scan with phone camera)

### Why Try All Endpoints?
- A device might have multiple IPs (LAN + Tailscale)
- Some endpoints might not be reachable from the current network
- The dashboard tries them in order and uses the first one that works
- This handles network transitions (e.g., laptop moves from home WiFi to coffee shop)

### Why Not Auto-Discover?
- mDNS/Bonjour would require additional libraries and network support
- Some networks block multicast (mDNS relies on it)
- QR code pairing is explicit and secure (no accidental discovery)
- Manual pairing is a one-time operation per device

## Limitations

1. **No Real-Time Sync:** Polling is 30s. Events (spikes, drains) might not be visible immediately on the dashboard. The dashboard shows the last polled state, not live data.

2. **Single Point of Failure:** The dashboard device is the aggregator. If it goes down, peer monitoring stops. Peers continue monitoring locally but don't report to anywhere.

3. **No Peer-to-Peer Alerts:** Alerts (spikes, drains) are only sent from the device that detects them. The dashboard doesn't forward alerts from peers to the user.

4. **NAT Issues:** If a peer is behind a strict NAT without Tailscale, its LAN IP might not be reachable from the dashboard. Tailscale is recommended for cross-network monitoring.

5. **Polling Overhead:** With 10 devices, the dashboard makes 10 HTTP requests every 30s. This is negligible bandwidth but could be optimized with batched requests in the future.

## Testing

- ✅ Device identity generated and persisted
- ✅ QR code contains correct JSON payload
- ✅ Manual pairing works via POST /api/devices
- ✅ Peer polling updates dashboard cards
- ✅ Offline detection works (all endpoints fail)
- ✅ Multiple endpoints tried in order
- ✅ Tailscale IPs detected correctly
- ✅ localhost fallback works for same-machine testing

## Future Improvements

- **WebSocket mode:** Optional persistent connections for real-time updates
- **Alert forwarding:** Forward peer alerts to the dashboard device for centralized alerting
- **Device groups:** Group devices by type (e.g., "Laptops", "Servers", "Phones")
- **Bulk import/export:** Export device registry as JSON for backup/restore
- **Peer dashboard:** Each device could serve its own dashboard, not just the aggregator
- **Polling interval config:** Allow user to adjust peer polling frequency

## Files

- `src/core/DeviceIdentity.ts` — UUID generation and endpoint discovery
- `src/core/DeviceRegistry.ts` — JSON file registry operations
- `src/web/server.ts` — `/api/devices`, `/api/metrics`, `/api/qr` endpoints
- `web/public/app.js` — Peer polling and device tab UI
- `~/.procmon/devices.json` — Persisted registry
- `~/.procmon/config/device.json` — Persisted identity

## Commit

- Part of T17 (Multi-Device Dashboard V1)
