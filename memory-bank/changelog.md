## 2026-09-01 — T24 Watchdog Evidence Collection

- Added configurable host and relevant-process sampling for future kernel-watchdog investigations.
- Added bounded durable history, privacy-safe process identity, threshold alerts with hysteresis, sampling-gap alerts, and atomic incident bundles.
- Extended the existing snapshot/history APIs with memory, VM, swap, paging, process-count, PID-churn, and timestamp evidence.
- Added focused evidence tests and documented verification limits: Jest parsing failure, local SQLite native-module ABI mismatch, separate loaded sage checkout, and unavailable dashboard port during the probe.
