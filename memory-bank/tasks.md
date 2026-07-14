# Memory Bank - Sage Workspace

*Created: 2026-06-26 07:39:11 IST*
*Last Updated: 2026-06-26 07:39:11 IST*

## Overview

This is the Memory Bank for the Sage (灵剑) OpenClaw workspace.

## Active Tasks

| ID | Title | Status | Priority | Started | Dependencies | Details |
|----|-------|--------|----------|---------|--------------|---------|
| T21 | Fix: DB size-based cleanup was broken — `cleanupOldSamples` ignored `maxSizeMB`, causing 608MB DB (108MB over limit). Added size-based batch deletion, `process_spikes` FK cleanup, `VACUUM`. | ✅ | HIGH | 2026-07-15 | - | [Details](tasks/T21.md) |
| T20 | Design: Dashboard detail views with clickable KPI cards. CPU→process list, Memory→memory details, Disk→disk/volume list, Network→interface list+connections, Battery→battery history+per-process energy. | 🔄 | MEDIUM | 2026-06-26 | - | [Details](tasks/T20.md) |

## Task Relationships

```
T21: Fix: DB size-based cleanup — cleanupOldSamples maxSizeMB + process_spikes FK + VACUUM
T20: Design: Dashboard detail views with clickable KPI cards. CPU→process list, Memory→memory details, Disk→disk/volume list, Network→interface list+connections, Battery→battery history+per-process energy.
```

## Status Summary

- **Active**: 1
- **Completed**: 1
- **Paused**: 0
- **Total**: 2
