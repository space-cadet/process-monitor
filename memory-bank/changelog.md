## 2026-09-03 — T24 Fixes, Security Remediation, and Deployment

- Fixed alert lifecycle resolution, incident-bundle API/UI contracts, alert-ID
  propagation, bundle listing/downloads, and dashboard field names (`8bcf9c2`).
- Corrected the test setup: removed the unnecessary Jest dependency and made
  Playwright the project test runner (`3b901a8`).
- Remediated npm audit findings in the lockfile (`b1cf1d9`); audit returned zero
  vulnerabilities.
- Restarted both LaunchDaemons with the audited build and passed post-restart
  API smoke tests on port 3456. Build and Playwright E2E (5/5) passed.

## 2026-09-03 — T24 Memory-bank Reconciliation

- Reconciled project-status wording after T24 deployment and dashboard verification.
- Updated the T24 dashboard implementation notes for incident-bundle listing and downloads.
- Recorded commit `8bcf9c2` as the current implementation baseline.

## 2026-09-01 — T24 Watchdog Evidence Collection

- Added configurable host and relevant-process sampling for future kernel-watchdog investigations.
- Added bounded durable history, privacy-safe process identity, threshold alerts with hysteresis, sampling-gap alerts, and atomic incident bundles.
- Extended the existing snapshot/history APIs with memory, VM, swap, paging, process-count, PID-churn, and timestamp evidence.
- Added focused evidence tests and documented verification limits: Jest parsing failure, local SQLite native-module ABI mismatch, separate loaded sage checkout, and unavailable dashboard port during the probe.
