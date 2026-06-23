#!/bin/bash
# Check if process-monitor and dashboard are running, start if not

MONITOR_LOG="/Users/sage/.openclaw/workspace/code/process-monitor/logs/auto-start.log"
RESTARTED=0

cd /Users/sage/.openclaw/workspace/code/process-monitor

# Check monitor (process-based: tsx running src/main.ts)
if ! pgrep -f "tsx.*src/main.ts" > /dev/null 2>&1; then
    bash run.sh > /dev/null 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S'): process-monitor started" >> "$MONITOR_LOG"
    RESTARTED=1
fi

# Check dashboard by port 3456 (more reliable than process name)
if ! lsof -ti:3456 > /dev/null 2>&1; then
    # Port is not bound — dashboard is down
    /usr/local/bin/npx tsx src/web/server.ts >> logs/dashboard.log 2>> logs/dashboard-error.log &
    echo "$(date '+%Y-%m-%d %H:%M:%S'): dashboard started (port 3456 was down)" >> "$MONITOR_LOG"
    RESTARTED=1
fi

# Exit non-zero if we had to restart anything, so cron can report it
exit $RESTARTED
