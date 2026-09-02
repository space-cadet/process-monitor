## 2026-09-03 — T24 Memory-bank Reconciliation

- Reconciled project-status wording after T24 deployment and dashboard verification.
- Updated the T24 dashboard implementation notes for incident-bundle listing and downloads.
- Recorded commit `8bcf9c2` as the current implementation baseline.

## 2026-09-01 — T24 Watchdog Evidence Collection

- Added configurable host and relevant-process sampling for future kernel-watchdog investigations.
- Added bounded durable history, privacy-safe process identity, threshold alerts with hysteresis, sampling-gap alerts, and atomic incident bundles.
- Extended the existing snapshot/history APIs with memory, VM, swap, paging, process-count, PID-churn, and timestamp evidence.
- Added focused evidence tests and documented verification limits: Jest parsing failure, local SQLite native-module ABI mismatch, separate loaded sage checkout, and unavailable dashboard port during the probe.
