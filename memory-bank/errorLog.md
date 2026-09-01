## 2026-09-01

- **Existing Jest command:** `npm test` stopped before executing tests because the current Babel/Jest setup could not parse `src/dashboard/test/dashboard.spec.ts` TypeScript syntax.
- **Storage test:** `better-sqlite3` could not load because the installed native module ABI did not match the active Node runtime; offline rebuild was also blocked by the local node-gyp cache permissions.
- **Live collector probe:** sandbox restrictions prevented some `sysctl`, `ps`, and `top` reads; the collector degraded safely with available `vm_stat` evidence and nullable restricted fields.
- **Live API probe:** `127.0.0.1:3456` refused the connection during verification; checked-in LaunchDaemon plists still identify the dashboard service and `sage` ownership.
