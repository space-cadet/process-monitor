#!/bin/bash
# Check if mac-process-monitor is running, start if not
if ! pgrep -f "tsx.*src/main.ts" > /dev/null 2>&1; then
    cd /Users/sage/.openclaw/workspace/code/mac-process-monitor
    bash run.sh > /dev/null 2>&1 &
    echo "$(date): mac-process-monitor started" >> /Users/sage/.openclaw/workspace/code/mac-process-monitor/logs/auto-start.log
fi
