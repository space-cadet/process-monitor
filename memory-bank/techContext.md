# Technical Context: process-monitor

## Technology Stack

### Core Language and Runtime
- **TypeScript 5.x**: Type-safe Node.js with ESM modules
- **tsx**: TypeScript execution without pre-compilation
- **Node.js 18+**: LTS runtime for async/await and ESM

### System Interaction
- **systeminformation**: Cross-platform system stats (battery, processes, CPU, memory, disk, network)
- **better-sqlite3**: Fast synchronous SQLite for time-series storage
- **Node.js built-ins**: `process` for signals, `path`/`fs` for DB path resolution
- **powermetrics** (macOS): Per-process energy impact (mJ) — requires `sudo`

### Storage
- **SQLite**: Time-series DB with eight tables — `snapshots`, `process_samples`, `drain_events`, `process_spikes`, `battery_impact`, `battery_impact_events`, `sleep_wake_events`, `device_registry`
- **better-sqlite3**: Chosen for synchronous, simple API (no async transaction overhead)
- **WAL mode**: Enabled for concurrent reads (dashboard queries while monitor writes)
- **JSON files**: Device registry (`~/.procmon/devices.json`), device identity (`~/.procmon/config/device.json`)

### Configuration
- **JSON config**: `MonitorConfig` interface + `ConfigManager.ts` — persists to `~/.procmon/config.json`
- **CLI flags**: `minimist` for `--report`, `--output`, `--spikes`, `--battery`, `--stats`, `--top`, `--process`
- **Auto-save**: Debounced 500ms save on any settings change via dashboard

### Alerting
- **Telegram Bot API**: `node-telegram-bot-api` — Real-time alerts for spikes and drain events
- **macOS osascript**: Native notifications via `osascript -e 'display notification'` (fallback)
- **OpenClaw message tool**: Proactive alerts via OpenClaw messaging (fallback)
- **Per-event cooldowns**: 5-minute cooldown per drain event, per-process cooldown for spikes

### Dashboard Frontend
- **Vanilla HTML/CSS/JS**: No framework dependency — pure DOM manipulation
- **Chart.js**: Lightweight canvas charts for battery, CPU, memory, disk, network history
- **CSS Grid/Flexbox**: Responsive layout with mobile-first design
- **QR Code**: `qrcode` npm package — SVG generation for device pairing

### Multi-Device Networking
- **Tailscale**: Mesh VPN for cross-network device communication (100.x IPs)
- **LAN Discovery**: Auto-detect `192.168.x.x` / `10.x.x.x` / `172.16-31.x.x` IPs
- **Identity**: UUIDv4 device IDs persisted to `~/.procmon/config/device.json`
- **Peer Polling**: HTTP `fetch()` every 30s to registered device `/api/metrics`

## Development Environment

### Required Tools
- Node.js 18+ with npm/pnpm
- TypeScript compiler (`tsc` for build, `tsx` for dev)
- macOS for battery/process APIs (systeminformation supports Linux/Windows too)
- Tailscale (optional, for cross-network device monitoring)

### Development Setup
```bash
pnpm install
npx tsx src/main.ts        # Run monitor
npx tsx src/show-data.ts   # Show current system data
npx tsx src/test-basic.ts  # Validate battery/process collection
npx tsx src/query.ts --report --output=text  # Generate daily report
npx tsx src/web/server.ts  # Run dashboard server
```

## Technical Constraints

### System Compatibility
- **Primary target**: macOS 12+ (Monterey and newer)
- **Cross-platform**: systeminformation works on Linux/Windows, but battery % accuracy varies
- **Node.js**: Requires 18+ for modern ESM and top-level await

### Performance Requirements
- Sampling overhead: <1% CPU at 30s intervals
- DB writes: batched per sample (1 snapshot + up to 50 process rows)
- Memory footprint: analyzer keeps only last ~11 samples (5-min window at 30s)
- SQLite: WAL mode recommended for concurrent reads (dashboard T4)
- Peer polling: 30s interval, lightweight JSON fetch

### Permission Requirements
- User-level permissions sufficient for process listing (systeminformation)
- **No elevated permissions needed for battery/process monitoring**
- **`sudo` required for `powermetrics` energy data** (T15) — energy only available when running with privileges
- **Tailscale**: Requires tailscale daemon running for 100.x IPs

## Dependencies

### Core Dependencies
- `systeminformation@^5.25.0` — Battery, processes, CPU, memory, disk, network stats
- `better-sqlite3@^12.0.0` — SQLite time-series storage
- `node-telegram-bot-api@^0.66.0` — Telegram alerts
- `minimist@^1.2.8` — CLI argument parsing
- `qrcode@^1.5.0` — QR code generation for device pairing

### Dev Dependencies
- `typescript@^5.7.0` — Type checking
- `tsx@^4.19.0` — TypeScript execution
- `@types/node@^22.0.0` — Node.js type definitions

## Deployment Strategy

### Installation Methods
- Clone + `pnpm install` (current)
- `npm install -g` or local `npx` execution (future)
- Homebrew formula (future, after Swift menubar T5)

### Packaging
- `tsc` builds to `dist/` for distribution
- `tsx` for development and testing

### Network Modes
| Mode | IP | Use Case | Requires |
|------|-----|----------|----------|
| Local | `localhost:3456` | Same machine | Nothing |
| LAN | `192.168.1.42:3456` | Same WiFi | Same network |
| Tailscale | `100.92.54.38:3456` | Anywhere | Tailscale daemon |

## File Structure
```
process-monitor/
├── src/
│   ├── types/
│   │   ├── index.ts              # All TypeScript interfaces
│   │   └── better-sqlite3.d.ts   # Type declarations for better-sqlite3
│   ├── core/
│   │   ├── SystemCollector.ts    # Battery + process + disk/network sampling
│   │   ├── DrainAnalyzer.ts      # Sliding window drain detection
│   │   ├── SpikeDetector.ts      # Per-process CPU/memory spike detection
│   │   ├── BatteryImpactAnalyzer.ts # Drain correlation + impact scoring
│   │   ├── AlertSender.ts        # Telegram + macOS notifications
│   │   ├── Monitor.ts            # Orchestrator loop
│   │   ├── DeviceIdentity.ts     # UUIDv4 device identity
│   │   ├── DeviceRegistry.ts     # JSON-based peer registry
│   │   ├── ReportGenerator.ts    # Daily battery health reports
│   │   └── EnergyCollector.ts    # macOS powermetrics energy (mJ)
│   ├── storage/
│   │   └── TimeSeriesDB.ts       # SQLite time-series storage
│   ├── config/
│   │   └── ConfigManager.ts      # JSON config persistence
│   ├── web/
│   │   └── server.ts             # Dashboard HTTP server (native http)
│   ├── query.ts                  # CLI query interface
│   ├── main.ts                   # Entry point
│   ├── show-data.ts              # Live data display
│   └── test-*.ts                 # Validation scripts
├── web/public/                   # Dashboard frontend
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── memory-bank/                  # Project documentation
├── check-and-start.sh            # Cron health check script
├── package.json
├── tsconfig.json
└── README.md
```

## ESM Import Conventions
- Source files use `.js` extensions in import paths (`import { Monitor } from './core/Monitor.js'`)
- This is required for Node.js ESM resolution; `tsx` handles the translation at runtime
- `tsc` compiles `.ts` → `.js`, so paths remain valid in `dist/`

## Database Schema

### snapshots
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `timestamp INTEGER NOT NULL`
- `battery_percent REAL NOT NULL`
- `is_charging INTEGER NOT NULL`, `ac_connected INTEGER`, `time_remaining INTEGER`, `cycle_count INTEGER`
- `cpu_total REAL`, `memory_total REAL`
- `disk_read_io REAL`, `disk_write_io REAL`, `disk_total_io REAL`
- `net_rx_bytes REAL`, `net_tx_bytes REAL`
- `fs_used_percent REAL`, `cpu_temp REAL`

### process_samples
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `snapshot_id INTEGER NOT NULL` (FK → snapshots.id)
- `pid INTEGER NOT NULL`, `name TEXT NOT NULL`
- `cpu_percent REAL NOT NULL`, `cpu_user_percent REAL`, `cpu_system_percent REAL`
- `memory_percent REAL NOT NULL`, `rss_mb REAL NOT NULL`
- `nice INTEGER`, `state TEXT`, `cmdline TEXT`
- `energy_mj REAL` — per-process energy from powermetrics (T15)

### drain_events
- `id TEXT PRIMARY KEY`
- `start_time`, `end_time INTEGER NOT NULL`
- `start_percent`, `end_percent`, `drain_rate`, `duration_minutes REAL NOT NULL`
- `was_charging INTEGER NOT NULL`, `top_processes_json TEXT NOT NULL`

### sleep_wake_events
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `timestamp INTEGER NOT NULL`
- `event_type TEXT NOT NULL` — 'sleep' or 'wake'
- `battery_percent REAL`, `duration_minutes REAL`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | — | Dashboard HTML |
| `GET /api/db-stats` | — | DB size, row counts |
| `GET /api/live` | — | Latest snapshot + processes |
| `GET /api/history?minutes=N` | — | Historical snapshots |
| `GET /api/top-processes?metric=cpu\|mem&limit=N` | — | Top processes |
| `GET /api/spikes?since=ISO&limit=N` | — | Spike events |
| `GET /api/drain-events?since=ISO&limit=N` | — | Drain events |
| `GET /api/battery-impacts?since=ISO` | — | Battery impact rankings |
| `GET /api/processes?pid=N&since=ISO` | — | Per-process history |
| `GET /api/report?date=YYYY-MM-DD` | — | Daily battery report (markdown) |
| `GET /api/sleep-wake-events?since=24h\|7d` | — | Sleep/wake events |
| `GET /api/process-tree` | — | Hierarchical process tree |
| `GET /api/export/csv?from=ISO&to=ISO` | — | CSV export |
| `GET /api/export/json?from=ISO&to=ISO` | — | JSON export |
| `GET /api/identity` | — | Device identity (all networks) |
| `GET /api/qr` | — | SVG QR code for pairing |
| `GET /api/devices` | — | List registered devices |
| `POST /api/devices/register` | — | Register a device |
| `POST /api/devices/heartbeat` | — | Device heartbeat |
| `DELETE /api/devices?id=X` | — | Remove device |
| `GET /api/metrics?since=ISO&limit=N` | — | Peer metrics (for polling) |

## Drain Detection Algorithm
1. **Sample** battery + top-50 processes every `sampleIntervalSeconds` (default: 30s)
2. **Store** in SQLite (`snapshots` + `process_samples`)
3. **Analyze** sliding `windowMinutes` window (default: 5 min, ~11 samples)
4. **Trigger** if: not charging, drop rate > `drainThreshold` (default: 0.5%/min), sustained for `minDuration` (default: 1 min), and cooldown expired (default: 5 min)
5. **Correlate** — average CPU per PID across all samples in window, return top 5
6. **Store event** in `drain_events` + alert (T2)

## Multi-Device Architecture (T17)

```
┌─────────────────┐     QR Scan / Manual     ┌─────────────────┐
│  Device A       │ ◄─────────────────────── │  Device B       │
│  (Dashboard)    │                          │  (New Device)   │
│                 │     HTTP GET /metrics    │                 │
│  Polls peers    │ ───────────────────────► │  Serves metrics │
│  every 30s      │                          │                 │
└─────────────────┘                          └─────────────────┘
```

- **Identity**: UUIDv4 `did` persisted to `~/.procmon/config/device.json`
- **Registry**: JSON file `~/.procmon/devices.json` with CRUD + heartbeat
- **Discovery**: Auto-detect LAN (`192.168.x`) / Tailscale (`100.x`) / localhost IPs
- **Pairing**: QR code contains identity JSON with all network endpoints
- **Polling**: Dashboard fetches `/api/metrics` from registered peers every 30s

## Known Quirks
- **memRss**: `systeminformation` returns KB, not bytes. `rssMB = memRss / 1024`.
- **currentLoad**: May return `undefined` on some systems. Fallback chain: `currentload` → `avgload` → `0`.
- **timeRemaining**: Negative values indicate "calculating" — mapped to `null`.
- **temperature**: Negative values indicate unavailable — mapped to `null`.
- **energy_mj**: Only available when running with `sudo` (powermetrics requires root)
- **Android VPN conflict**: Tailscale and NordVPN can't run simultaneously on Android (VPN slot limitation)

## Additional Notes

### Python Legacy
The project was originally planned in Python (psutil, PyYAML, Flask). T1 replaced this with TypeScript for:
- Single-language stack (TypeScript for both monitor and web dashboard T4)
- ESM module system
- Better type safety for time-series data contracts
- `systeminformation` provides richer battery data than `psutil`

### Language Migration Considerations
- Core data structures (`SystemSnapshot`, `DrainEvent`, `ProcessSnapshot`) are simple interfaces — easy to port to Swift (T5)
- SQLite DB format is language-agnostic — Swift version can read the same DB
- Algorithm logic (sliding window, process aggregation) is self-contained in `DrainAnalyzer.ts`

### Interface Implementation Strategy
- CLI test scripts first (current: `show-data.ts`, `test-*.ts`)
- OpenClaw/Telegram alerts next (T2)
- Per-process query CLI (T3)
- Web dashboard with Express + Chart.js (T4)
- Multi-device with identity + QR + peer polling (T17)
- Swift menubar app as final native integration (T5)
