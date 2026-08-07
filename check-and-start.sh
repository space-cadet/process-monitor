#!/bin/bash
# Check if process-monitor and dashboard are running, start if not
#
# ⚠️ WORKSPACE COPY (LIVE)
# This script lives in ~/.openclaw/workspace/scripts/ — this is the copy that runs.
# There is also a copy in code/process-monitor/ which is the git-tracked backup.
#
# If you edit this script, also copy it to the repo and commit:
#   cp ~/.openclaw/workspace/scripts/procmon-check-and-start.sh ~/.openclaw/workspace/code/process-monitor/check-and-start.sh
#   cd ~/.openclaw/workspace/code/process-monitor && git add check-and-start.sh && git commit

MONITOR_LOG="/Users/sage/.openclaw/workspace/code/process-monitor/logs/auto-start.log"
RESTARTED=0

cd /Users/sage/.openclaw/workspace/code/process-monitor

# Check monitor (compiled: node dist/main.js)
if ! pgrep -f "node dist/main.js" > /dev/null 2>&1; then
    bash run.sh > /dev/null 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S'): process-monitor started" >> "$MONITOR_LOG"
    RESTARTED=1
fi

# Check dashboard by port 3456 (more reliable than process name)
if ! lsof -ti:3456 > /dev/null 2>&1; then
    # Port is not bound — dashboard is down
    cd /Users/sage/.openclaw/workspace/code/process-monitor
    bash start-dashboard.sh > /dev/null 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S'): dashboard started (port 3456 was down)" >> "$MONITOR_LOG"
    RESTARTED=1
fi

# Exit non-zero if we had to restart anything, so cron can report it
exit $RESTARTED
