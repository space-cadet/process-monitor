# Forensic Process Identification Plan

*Created: 2026-07-23 09:36:23 IST*
*Last Updated: 2026-07-23 10:07:03 IST*
*Status: 🔄 First Slice Implemented*
*Task: T22*

## Purpose

The monitor should do more than show that a process is hot. It should identify the process well enough to decide whether it is expected, stale, orphaned, misconfigured, or worth deeper inspection.

## Current Gap

The current TypeScript monitor collects process samples, process spikes, battery impact, dashboard data, live process tree data, and some live network connection data. That is useful for trends, but not enough for forensic attribution.

Known limitations:
- Process history is based mainly on process name, PID, and command line.
- Snapshots keep only the top 50 processes sorted by instantaneous CPU.
- There is no durable cumulative CPU interval profile for all processes.
- There is no durable process identity table with user, executable path, start time, parent chain, launch owner, or service label.
- There is no launchd, systemd, Windows Services, or Scheduled Tasks mapping layer.
- There is no LaunchAgent/LaunchDaemon plist audit for missing targets or stale jobs.
- There is no durable `lsof`-style file/socket provenance.
- There is no on-demand stack or IO sampler integration.

## Architecture

Use a common evidence model with platform adapters.

### Portable Core

This layer should work on macOS, Linux, and Windows with adapter-specific collectors:
- Interval CPU profiler based on cumulative CPU time deltas.
- Process identity collector for PID, PPID, user, executable path, command line, start time, state, RSS, and CPU time.
- Parent-chain and process-tree reconstruction.
- Historical storage for process identities, process samples, interval profiles, and findings.
- Dashboard and CLI reports that do not assume one operating system.

### macOS Adapter

This should be implemented first.

Evidence sources:
- `ps` for process identity, parentage, user, start time, and cumulative CPU time.
- `launchctl print`, `launchctl list`, and `launchctl procinfo` for launchd labels, domains, state, exit status, and ownership.
- Launch plist scans in `/Library/LaunchDaemons`, `/Library/LaunchAgents`, and user `~/Library/LaunchAgents`.
- Plist validation for missing `Program` or `ProgramArguments[0]` targets.
- `lsof` for open files, listener ports, and app/workspace attribution.
- `sample` for on-demand stack capture during suspicious CPU activity.
- `fs_usage` for short on-demand filesystem activity traces.
- Optional code-signature, bundle ID, and package receipt checks for app attribution.

### Linux Adapter

Linux should use the same evidence model, but different sources:
- `/proc` for process identity, CPU time, executable path, command line, cwd, parent PID, file descriptors, and sockets.
- `systemctl` and unit files for service ownership.
- cgroups for container/session attribution.
- `ss` or `lsof` for network listeners.
- `strace`, `perf`, or eBPF tooling for optional deeper traces when available.
- Package manager ownership where available.

### Windows Adapter

Windows should use the same evidence model with Windows-native sources:
- WMI or PowerShell for process identity, command line, executable path, owner, parent PID, and start time.
- Windows Services and Scheduled Tasks for service ownership.
- ETW or Event Logs for deeper process and system activity.
- Handle and socket inspection via Windows-native APIs or PowerShell.

## Initial Deliverables

1. Define process identity and forensic evidence types. Status: initial live API model implemented.
2. Add an interval CPU profiler that records CPU seconds per process over a window. Status: implemented as `/api/process-cpu-profile`.
3. Store all-process interval results, not only the top 50 instantaneous CPU processes. Status: not yet persisted; live interval endpoint returns bounded results.
4. Add macOS launchd mapping from PID to label/domain where possible. Status: only lightweight command/plist hinting implemented; full `launchctl` mapping remains.
5. Add macOS launch plist audit for missing or stale targets. Status: pending.
6. Add listener/open-file mapping for suspicious processes. Status: initial `lsof -p` evidence implemented in `/api/process-forensics`.
7. Add a CLI report that explains why a process is suspicious and what owns it. Status: pending; dashboard Analysis preset and modal findings are implemented first.

## Implemented First Slice

Backend:
- `/api/process-forensics`: read-only live process evidence from `ps`, parent-chain reconstruction, lightweight ownership kind, recent DB CPU summary, and bounded `lsof` ports/open files.
- `/api/process-cpu-profile`: bounded live interval profiler using cumulative CPU-time deltas.
- `/api/analysis/troublesome-processes`: historical queue for high CPU, high peak CPU, PID churn, and ambiguous process names.
- `/api/sleep-wake-events`: accepts timestamp cutoffs as well as relative range strings.
- Dashboard `HOST` is configurable for loopback-only verification while keeping the default host unchanged.

Frontend:
- Analysis auto-loads Troubling/Troublesome Processes instead of opening blank.
- Reports auto-load today instead of showing a default placeholder.
- Recent Drain Events handles both snake_case and camelCase event fields.
- Sleep 7-day range now matches the backend.
- Process modal includes Identity, Ownership, Findings, Listener Ports, and Open Files.
- Analysis includes a 5-second CPU Profile action and a Troublesome Processes preset.
- Report rendering was changed to a line-based markdown renderer to avoid broken table spacing.

Validation:
- `npm run build` passed.
- `git diff --check` passed.
- Browser smoke test passed against `HOST=127.0.0.1 PORT=3457 ./node_modules/.bin/tsx src/web/server.ts`.

Known limits:
- The first slice is live/on-demand. It does not yet persist process identity/provenance into SQLite.
- The launchd label inference is only a hint; full `launchctl print/list/procinfo` mapping is still required.
- LaunchAgent/LaunchDaemon plist validation, missing target detection, `sample`, and `fs_usage` remain planned macOS adapter work.
- Linux and Windows adapter implementations remain planned behind the common evidence model.

## Design Rule

Do not hide platform differences behind vague generic labels. Keep the storage and UI common, but keep the collectors explicit: macOS launchd, Linux systemd/procfs, and Windows Services/Scheduled Tasks are different systems.
