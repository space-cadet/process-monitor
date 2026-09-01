# Watchdog evidence collection

The monitor records a bounded, timestamped history to help reconstruct memory
and process pressure if macOS later reports a kernel watchdog timeout. The
records describe observations and correlations; they do not identify a root
cause.

## Dashboard UI

The process-monitor dashboard includes a dedicated **🚨 Watchdog** tab (7th tab)
that provides real-time visibility into system alerts and incident bundles.

### Active Alerts Panel
- Displays current unresolved alerts with severity-colored borders:
  - 🔴 **Critical** (red) — memory/compressor at limit, severe pressure
  - 🟡 **Warning** (yellow) — elevated pressure, rapid swap growth, high CPU/RSS
  - 🔵 **Info** (blue) — process count changes, sampling gaps, state transitions
- Auto-refreshes every 30 seconds when the Watchdog tab is active
- Shows alert timestamp, type, observation, and severity

### Incident Actions Panel
- **Create Incident Bundle** — Captures current system state + process snapshot +
  alert context as a JSON bundle in `~/.procmon/incidents/`
- **View Bundles** — Shows the incident bundle storage location and creation info

### Alert History Panel
- Sortable table of all alerts with timestamp, type, severity, and observation
- Click "Load History" to populate from `/api/evidence-alerts`
- Useful for identifying patterns across multiple incidents

### API Endpoints

```text
GET  /api/evidence-alerts?minutes=60&limit=100   # List active alerts
POST /api/incident-bundle                        # Create manual bundle
```

## Sampling and retention

- The default interval is 15 seconds (`sampleIntervalSeconds`).
- `/api/history` accepts `minutes=1..60` and returns at most 240 samples.
- Automatic age and size cleanup remain controlled by `retentionDays` and
  `retentionSizeMB`; the default age is 30 days and the default size target is
  400 MB.
- Each snapshot and its process rows are committed in one SQLite transaction.
- Incident bundles are written atomically under `~/.procmon/incidents/` with
  restrictive file permissions.

## Recorded fields

Each snapshot includes the existing CPU, battery, disk, network, load, uptime,
and filesystem fields, plus:

- `timestampUtc` and `timestampIst`.
- `memoryPressure` and `memoryPressurePercent` (the latter is normalized as
  pressure percentage; `memory_pressure`'s free percentage is inverted).
- `swapUsage`: total, used, free, and used percentage.
- `vmStat`: page size, free/active/inactive/wired/compressed/purged pages,
  page-ins, page-outs, swap-ins, swap-outs, and compressor bytes.
- Available memory when the platform API reports it reliably.
- Process count, relevant-process count, unique PID count, and the measured
  PID churn percentage and gap since the preceding sample.

Relevant process rows contain PID, PPID, user, CPU, RSS, process state,
elapsed time, sanitized executable name, process group, and an allowlisted
safe identifier. The persisted legacy `cmdline` field contains only that
sanitized executable name. Complete command lines, environment variables,
credentials, and prompt contents are not collected by this evidence path.

The monitored groups are Codex, ChatGPT, OpenClaw, node, ImageMagick/magick,
WindowServer, and process-monitor. The collector also retains the highest-CPU
ordinary processes needed for context, capped at 75 rows per sample.

## Alerts and bundles

The monitor records transition alerts for memory/compressor pressure, rapid
swap growth, sustained paging or swap activity, high CPU/RSS in a relevant
group, process-count/PID churn, and sampling gaps. Every alert has an ISO UTC
timestamp and an observation. Alerts use wording such as “observed
contributor” and “correlated pressure”; they do not claim that a process
caused a kernel panic.

When an alert transitions into an active state, the monitor writes a bounded
incident bundle containing the latest history, current sanitized process rows,
and recent alerts. A manual bundle can be requested with:

```text
POST /api/incident-bundle
```

Recent alert records are available from:

```text
GET /api/evidence-alerts?minutes=60&limit=100
```

The existing `/api/snapshot` and `/api/history` endpoints expose the current
and historical evidence without changing LaunchDaemon ownership.

## Frontend Implementation

The Watchdog dashboard UI was implemented on **2026-09-01** and consists of:

| File | Purpose |
|------|---------|
| `web/public/index.html` | Tab navigation and panel structure |
| `web/public/app.js` | `loadWatchdogAlerts()`, `createIncidentBundle()`, `renderWatchdogAlert()`, `loadIncidentBundles()` |
| `web/public/styles.css` | Severity-colored borders, action cards, history table, tab badges |

Cache-busted assets: `styles.css?v=5`, `app.js?v=9`.

## Related Tasks

- **T24** — Watchdog Evidence Collection and Correlation (fully complete)
