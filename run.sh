#!/bin/bash
cd /Users/sage/.openclaw/workspace/code/process-monitor
node dist/main.js >> /Users/sage/.openclaw/workspace/code/process-monitor/logs/monitor.log 2>> /Users/sage/.openclaw/workspace/code/process-monitor/logs/monitor-error.log
