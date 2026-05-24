# Active Context

*Last Updated: 2026-05-25 00:52 IST*

## Current Tasks
1. **[T4]**: Web Dashboard for Live Monitoring (MEDIUM priority)
   - Status: 🔄 IN PROGRESS
   - Output: Dashboard server running on port 3456, accessible from local network + Android
   - Fixes: Chart JS bugs fixed, memory display fixed, live data working
   - Files: `src/web/server.ts`, `web/public/index.html`, `web/public/app.js`, `web/public/styles.css`

2. **[T2]**: Telegram/OpenClaw Alert Integration (HIGH priority)
   - Status: ⬜ PENDING
   - Next: Add sendAlert() to Monitor.ts, format drain event messages

3. **[T3]**: Per-Process History Query Interface (MEDIUM priority)
   - Status: ⬜ PENDING
   - Next: Add process-centric DB queries, build CLI tool

4. **[T5]**: Swift Menubar App (LOW priority)
   - Status: ⬜ PENDING
   - Next: Port proven TypeScript logic to Swift after T2-T4 stable

## Completed Tasks (Recent)
- T1: TypeScript rewrite — battery, process tracking, drain detection, SQLite storage (2026-05-18)

## Next Steps
- T4: Dashboard polish — add CPU history chart, process memory sorting
- T2: Telegram alerting — integrate OpenClaw message tool
- T3: Process queries — `npx tsx src/query.ts --process Chrome --since 2h`
- T5: Swift menubar — native macOS app (future)

## System Status
- **Battery**: 39%, not charging
- **Memory**: 99.1% used (8GB machine)
- **DB**: ~/.procmon/monitor.db with snapshots + process samples
- **Dashboard**: Running on http://192.168.1.103:3456 (live data)
- **Monitor**: Running (PID 79284), sampling every 30s
