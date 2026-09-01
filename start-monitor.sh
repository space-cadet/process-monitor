#!/bin/bash
cd /Users/sage/.openclaw/workspace/code/process-monitor
exec /Users/sage/.nvm/versions/node/v22.22.3/bin/node dist/main.js >> logs/monitor.log 2>> logs/monitor-error.log
