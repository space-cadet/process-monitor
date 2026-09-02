## 2026-09-01

- **Existing Jest command:** `npm test` stopped before executing tests because the current Babel/Jest setup could not parse `src/dashboard/test/dashboard.spec.ts` TypeScript syntax.
- **Storage test:** `better-sqlite3` could not load because the installed native module ABI did not match the active Node runtime; offline rebuild was also blocked by the local node-gyp cache permissions.
- **Live collector probe:** sandbox restrictions prevented some `sysctl`, `ps`, and `top` reads; the collector degraded safely with available `vm_stat` evidence and nullable restricted fields.
- **Live API probe:** `127.0.0.1:3456` refused the connection during verification; checked-in LaunchDaemon plists still identify the dashboard service and `sage` ownership.

## 2026-09-03

- **Test-scope misdiagnosis:** I initially treated the stale Jest command as a
  missing Jest suite and caused an unnecessary Jest dependency to be added.
  Repository inspection confirmed there are no Jest tests; the actual suite is
  Playwright. Jest was removed and `npm test` now runs Playwright.
- **Initial deployment gap:** The corrected build was committed and tested in
  isolation before the live LaunchDaemons were restarted. Both services were
  subsequently restarted with `b1cf1d9` and smoke-tested successfully.
- **Dependency audit:** Installing the local test dependency exposed four npm
  audit findings; lockfile updates in `b1cf1d9` reduced the audit result to zero
  vulnerabilities without source changes.
