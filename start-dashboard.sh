#!/bin/bash
cd /Users/sage/.openclaw/workspace/code/process-monitor
node dist/web/server.js >> logs/dashboard.log 2>> logs/dashboard-error.log
