---
kind: edit_chunk
id: mac-process-monitor-2026-05-25-dashboard-fixes
created_at: 2026-05-25 00:52 IST
task_ids: [T4]
source_branch: main
source_commit: b8cd143
---

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
