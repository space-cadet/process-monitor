# Edit Chunk: 2026-06-26 10:08:36 IST

## Task: T20

### Work Done

Phase 3: Backend APIs for Network, Disk, Status, Battery + user follow-up improvements

### Files Modified

- Modified `src/core/SystemCollector.ts` — Added network interfaces, disk volumes, system info, battery health, disk I/O rates. User added Apple Silicon battery temp via ioreg.
- Modified `src/types/index.ts` — Added NetworkInterface, DiskVolume, SystemInfo types. Extended BatterySample with health field.
- Modified `src/web/server.ts` — Added /api/network-interfaces, /api/network-connections, /api/disk-volumes endpoints.
- Modified `src/storage/TimeSeriesDB.ts` — Reconstruct missing fields (networkInterfaces, diskVolumes, systemInfo) from historical snapshots.
- Modified `web/public/app.js` — Network view: async fetch interfaces + connections tables. Disk view: per-volume table + I/O rates. Status view: battery temp, power source, uptime, system info table. Battery view: time remaining, health %, removed broken energy table.

