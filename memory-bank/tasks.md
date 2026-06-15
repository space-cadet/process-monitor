# Memory Bank - Sage Workspace

*Created: 2026-05-25 05:05:17 IST*
*Last Updated: 2026-06-15 07:45 IST*

## Overview

This is the Memory Bank for the Sage (灵剑) OpenClaw workspace.

## Active Tasks

| ID | Title | Status | Priority | Started | Dependencies | Details |
|----|-------|--------|----------|---------|--------------|---------|
| T2 | Telegram/OpenClaw Alert Integration | ⬜ | HIGH | 2026-05-18 | - | [Details](tasks/T2.md) |
| T5 | Swift Menubar App (Future) | ⬜ | LOW | 2026-05-18 | - | [Details](tasks/T5.md) |

## Completed Tasks

| ID | Title | Status | Priority | Started | Completed | Dependencies | Details |
|----|-------|--------|----------|---------|-----------|--------------|---------|
| T1 | TypeScript Rewrite — Core Monitor | ✅ | HIGH | 2026-05-18 | 2026-05-18 | - | [Details](tasks/T1.md) |
| T3 | Per-Process History Query Interface | ✅ | MEDIUM | 2026-05-18 | 2026-06-10 | - | [Details](tasks/T3.md) |
| T4 | Web Dashboard for Live Monitoring | ✅ | MEDIUM | 2026-05-18 | 2026-06-10 | - | [Details](tasks/T4.md) |
| T6 | Process Spike Detection | ✅ | MEDIUM | 2026-06-09 | 2026-06-09 | - | [Details](tasks/T6.md) |
| T7 | Battery Impact Correlation | ✅ | MEDIUM | 2026-06-09 | 2026-06-09 | - | [Details](tasks/T7.md) |
| T8 | LaunchDaemon Installation for Auto-Start | ✅ | MEDIUM | 2026-06-13 | 2026-06-15 | - | [Details](tasks/T8.md) |

## Pending Tasks

| ID | Title | Status | Priority | Started | Dependencies | Details |
|----|-------|--------|----------|---------|--------------|---------|
| T2 | Telegram/OpenClaw Alert Integration | ⬜ | HIGH | 2026-05-18 | - | [Details](tasks/T2.md) |
| T5 | Swift Menubar App (Future) | ⬜ | LOW | 2026-05-18 | - | [Details](tasks/T5.md) |

## Task Relationships

```
T1: TypeScript Rewrite — Core Monitor
├── T2: Telegram/OpenClaw Alert Integration (pending)
├── T3: Per-Process History Query Interface (completed)
├── T4: Web Dashboard for Live Monitoring (completed)
├── T5: Swift Menubar App (Future) (pending)
├── T6: Process Resource Usage Spike Detection (completed)
├── T7: Battery Impact Correlation Analysis (completed)
└── T8: LaunchDaemon Installation for Auto-Start (completed)
```

## Status Summary

- **Active**: 0
- **Completed**: 6
- **Pending**: 2
- **Total**: 8

## Recent Incident: Git History Goof-Up (2026-06-15)

**What happened**: During a session to check alignment between workspace and remote copies, I used `git clone --depth 1` which created a shallow clone with only 1 commit. I then mistakenly replaced the local workspace directory with this shallow copy, temporarily losing the full git history locally.

**Impact**: The workspace copy was not a git repo when checked (no `.git` folder). The user's canonical copy at `/Users/deepak/code/mac-process-monitor` had the full 26-commit history. The remote (GitHub) also had full history.

**Resolution**: Re-cloned with full history, merged the newer T6/T7 features back in, and pushed a new commit (`f7e295a`). All 27 commits preserved. User's canonical copy needs `git pull` to sync.

**Lesson**: Never use `--depth 1` for alignment checks. Always use full clones when working with existing repos.

**Root cause**: The workspace copy (`~/.openclaw/workspace/code/mac-process-monitor`) was never a git repo despite having git-tracked files. The user maintains canonical repos in `~/code/` (per TOOLS.md). I should have checked there first.

**Files affected**: None permanently lost. All source code was preserved in backups. Only temporary confusion about which directory was the "real" repo.
