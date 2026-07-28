#!/bin/bash
# Delay to let user session initialize (DiskArbitration framework)
sleep 10
cd /Users/sage/.openclaw/workspace/code/process-monitor
/Users/sage/.nvm/versions/node/v22.22.3/bin/node --require /Users/sage/.openclaw/workspace/code/process-monitor/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/preflight.cjs --import file:///Users/sage/.openclaw/workspace/code/process-monitor/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/loader.mjs src/main.ts
