# Edit History

*Created: 2026-05-18 18:37 IST*
*Last Updated: 2026-05-25 00:52 IST*

---

## 2026-05-25

#### 00:52 IST - T4: Dashboard fixes — live data, chart JS bugs, memory display
- Modified `src/web/server.ts` - Changed /api/snapshot to use live collection instead of stale DB cache
- Modified `web/public/app.js` - Fixed sortProcesses() and loadHistory() click handlers (event.target undefined)
- Modified `web/public/app.js` - Fixed renderChart() to handle snake_case DB column names (battery_percent)
- Modified `web/public/index.html` - Updated onclick handlers to pass `this` explicitly
- Modified `src/core/SystemCollector.ts` - Clarified memRss unit comment (KB to MB calculation)
- Created `src/web/server.ts` - Native Node HTTP server with API routes for snapshot, history, drain-events
- Created `web/public/index.html` - Dashboard UI with KPI cards, process table, battery history chart
- Created `web/public/app.js` - Frontend logic with live fetching, sorting, chart rendering, CSV export
- Created `web/public/styles.css` - Dark theme styling with CPU bars, responsive layout

---

## 2026-05-18

#### 19:30 IST - T1: TypeScript rewrite COMPLETED + T2-T5 created + README + memory bank updated
- Modified `memory-bank/tasks/T1.md` - Updated status to COMPLETED, added full progress, files, decisions, known issues, next steps
- Created `memory-bank/tasks/T2.md` - Telegram/OpenClaw Alert Integration task
- Created `memory-bank/tasks/T3.md` - Per-Process History Query Interface task
- Created `memory-bank/tasks/T4.md` - Web Dashboard for Live Monitoring task
- Created `memory-bank/tasks/T5.md` - Swift Menubar App (Future) task
- Modified `memory-bank/tasks.md` - Updated registry: T1 ✅, T2-T5 ⬜, status summary updated
- Modified `memory-bank/session_cache.md` - Updated current session, task registry, completed tasks, system status
- Modified `memory-bank/sessions/2026-05-18-evening.md` - Full session log with all work done, decisions, files, next steps
- Modified `memory-bank/activeContext.md` - Updated with T1 completed, T2-T5 pending, system status
- Created `README.md` - Project README with quick start, architecture, configuration, roadmap
- Modified `src/core/SystemCollector.ts` - Fixed memory calculation (memRss is KB not bytes)
- Created `src/test-basic.ts` - Basic systeminformation validation test
- Created `src/test-collector.ts` - Collector + DB integration test
- Created `src/test-analyzer.ts` - Drain detection test with fake data
- Created `src/show-data.ts` - Live data display script

#### 18:37 IST - INIT: Memory bank initialized for mac-process-monitor
- Created `memory-bank/tasks.md` - Task registry with T1
- Created `memory-bank/session_cache.md` - Session tracking
- Created `memory-bank/activeContext.md` - Current context
- Created `memory-bank/edit_history.md` - Edit history (this file)
- Created `memory-bank/implementation-details/` - Knowledge layer directory
- Created `memory-bank/tasks/T1.md` - First task: battery tracking enhancement
- Created `memory-bank/sessions/2026-05-18-evening.md` - Session file for current work
