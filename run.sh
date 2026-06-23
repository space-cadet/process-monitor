#!/bin/bash
cd /Users/sage/.openclaw/workspace/code/process-monitor
/usr/local/bin/npx tsx src/main.ts >> /Users/sage/.openclaw/workspace/code/process-monitor/logs/monitor.log 2>> /Users/sage/.openclaw/workspace/code/process-monitor/logs/monitor-error.log
