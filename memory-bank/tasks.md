# Memory Bank - Sage Workspace

*Created: 2026-06-26 07:39:11 IST*
*Last Updated: 2026-07-23 09:36:23 IST*

## Overview

This is the Memory Bank for the Sage (灵剑) OpenClaw workspace.

## Active Tasks

| ID | Title | Status | Priority | Started | Dependencies | Details |
|----|-------|--------|----------|---------|--------------|---------|
| T22 | Design: Forensic process identification layer with portable core and platform-specific adapters for troublesome process mapping. | 🔄 | HIGH | 2026-07-23 | T13, T19 | [Details](tasks/T22.md) |
| T21 | Fix: DB size-based cleanup was broken — `cleanupOldSamples` ignored `maxSizeMB`, causing 608MB DB (108MB over limit). Added size-based batch deletion, `process_spikes` FK cleanup, `VACUUM`. | ✅ | HIGH | 2026-07-15 | - | [Details](tasks/T21.md) |
| T20 | Design: Dashboard detail views with clickable KPI cards. CPU→process list, Memory→memory details, Disk→disk/volume list, Network→interface list+connections, Battery→battery history+per-process energy. | 🔄 | MEDIUM | 2026-06-26 | - | [Details](tasks/T20.md) |

## Task Relationships

```
T22: Design: Forensic process identification layer — portable interval profiler and identity model, macOS-first launchd/lsof/sample/fs_usage adapter, later Linux/Windows adapters
T21: Fix: DB size-based cleanup — cleanupOldSamples maxSizeMB + process_spikes FK + VACUUM
T20: Design: Dashboard detail views with clickable KPI cards. CPU→process list, Memory→memory details, Disk→disk/volume list, Network→interface list+connections, Battery→battery history+per-process energy.
```

## Status Summary

- **Active**: 2
- **Completed**: 1
- **Paused**: 0
- **Total**: 3
