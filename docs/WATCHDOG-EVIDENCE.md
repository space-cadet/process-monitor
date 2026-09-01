# Watchdog evidence collection

The monitor records a bounded, timestamped history to help reconstruct memory
and process pressure if macOS later reports a kernel watchdog timeout. The
records describe observations and correlations; they do not identify a root
cause.

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
