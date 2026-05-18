# Active Context

*Last Updated: 2026-05-18 18:37 IST*

## Current Tasks
1. **[T1]**: Enhance mac-process-monitor with battery tracking (HIGH priority)
   - Status: 🔄 IN PROGRESS
   - Current Focus: Audit existing codebase, plan battery integration
   - Existing: Python process monitor with CPU/memory thresholds
   - Goal: Add battery level monitoring + rapid drain detection

## Next Steps
- Add battery monitoring to collector.py
- Implement drain rate calculation in analyzer.py
- Add Telegram/OpenClaw alert integration
- Update config schema for battery thresholds

## System Status
- **Collector**: ✅ CPU, memory, disk tracking (psutil)
- **Analyzer**: ✅ Threshold analysis with duration tracking
- **Logger**: ✅ Rotating file logs
- **Battery**: ⬜ Not implemented
- **Alerts**: ⬜ Not implemented
