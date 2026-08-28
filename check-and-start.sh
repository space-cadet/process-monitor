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

# Check monitor (process-based: tsx running src/main.ts)
if ! pgrep -f "tsx.*src/main.ts" > /dev/null 2>&1; then
    bash run.sh > /dev/null 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S'): process-monitor started" >> "$MONITOR_LOG"
    RESTARTED=1
fi

# Check dashboard by port 3456 (more reliable than process name)
if ! lsof -ti:3456 > /dev/null 2>&1; then
    # Port is not bound — dashboard is down
    cd /Users/sage/.openclaw/workspace/code/process-monitor
    node_modules/.bin/tsx src/web/server.ts >> logs/dashboard.log 2>> logs/dashboard-error.log &
    echo "$(date '+%Y-%m-%d %H:%M:%S'): dashboard started (port 3456 was down)" >> "$MONITOR_LOG"
    RESTARTED=1
fi

# Check Ollama (port 11434) — managed by LaunchDaemon, but we monitor it
if ! curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): OLLAMA DOWN (port 11434 not responding)" >> "$MONITOR_LOG"
    # Kickstart the LaunchDaemon in case it's stuck
    sudo launchctl kickstart -k system/ai.ollama.sage 2>/dev/null || true
    RESTARTED=1
fi
