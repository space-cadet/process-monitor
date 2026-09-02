# T24: Watchdog Evidence Dashboard UI Implementation

**Created:** 2026-09-01 22:25 IST
**Status:** Complete
**Related Task:** T24 — Watchdog Evidence Collection and Correlation

---

## Overview

The Watchdog Dashboard UI provides real-time visibility into system alerts and incident bundles through a dedicated tab in the process-monitor dashboard. It was implemented as the frontend component of T24, complementing the backend evidence collection system.

## Architecture

The dashboard follows the existing single-page application architecture:
- **Static HTML** (`web/public/index.html`) — Tab navigation and panel structure
- **Vanilla JavaScript** (`web/public/app.js`) — Dynamic content loading and interaction
- **CSS** (`web/public/styles.css`) — Dark-theme styling with severity-based visual cues

## Components

### 1. Tab Navigation
- New "🚨 Watchdog" tab added as the 7th tab (after Sleep)
- Alert count badge appears when active alerts exist (`.tab-badge`)
- Tab switching managed by existing `switchTab()` function

### 2. Active Alerts Panel (`#watchdog-alerts`)
- **Function:** `loadWatchdogAlerts()`
- **Endpoint:** `GET /api/evidence-alerts`
- **Auto-refresh:** Every 30 seconds when tab is active
- **Visual design:**
  - Severity-colored left border: red (critical), yellow (warning), blue (info)
  - Each card shows: timestamp, alert type, observation, severity badge
  - "No active alerts" message when empty

### 3. Incident Actions Panel (`#watchdog-actions`)
- **Create Incident Bundle card:**
  - Calls `createIncidentBundle()` with optional alertId
  - POSTs to `/api/incident-bundle`
  - Shows success/error notification
- **View Bundles card:**
  - Calls `loadIncidentBundles()`
  - Fetches `/api/incident-bundles`
  - Displays bundle names, creation timestamps, sizes, and download links

### 4. Alert History Panel (`#watchdog-history`)
- **Function:** `loadAlertHistory()`
- **Table columns:** Time, Type, Severity, Observation, Actions
- **Features:**
  - "Load History" button to fetch from API
  - Sortable by timestamp (newest first)
  - Expandable rows for detailed observation text

## JavaScript Functions

### `loadWatchdogAlerts()`
```javascript
// Fetches active alerts from /api/evidence-alerts
// Renders severity-colored cards in #watchdog-alerts
// Updates tab badge with alert count
// Auto-refreshes every 30s via setInterval
```

### `createIncidentBundle(alertId = null)`
```javascript
// POSTs to /api/incident-bundle with optional alert context
// Displays success notification with bundle path
// Handles network errors gracefully
```

### `renderWatchdogAlert(alert)`
```javascript
// Creates DOM element for single alert
// Maps severity to CSS class: critical|warning|info
// Formats ISO timestamp to local time
```

### `loadIncidentBundles()`
```javascript
// Fetches /api/incident-bundles
// Renders saved bundle metadata and download links
```

### `loadAlertHistory()`
```javascript
// Fetches historical alerts from /api/evidence-alerts?minutes=60
// Populates #watchdog-history-table
// Handles empty state
```

## CSS Classes

| Class | Purpose |
|-------|---------|
| `.watchdog-alert-item` | Alert card container with severity border |
| `.watchdog-alert-critical` | Red left border (4px solid #ff4444) |
| `.watchdog-alert-warning` | Yellow left border (4px solid #ffbb33) |
| `.watchdog-alert-info` | Blue left border (4px solid #33b5e7) |
| `.watchdog-action-card` | Action card with hover effect |
| `.watchdog-history-table` | Styled table for alert history |
| `.tab-badge` | Alert count indicator on tab |

## API Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/evidence-alerts` | GET | Fetch active/historical alerts |
| `/api/incident-bundle` | POST | Create manual incident bundle |
| `/api/incident-bundles` | GET | List saved incident bundles |
| `/api/incident-bundle?name=...` | GET | Download a saved incident bundle |

## Cache Busting

Assets are cache-busted via query parameters:
- `styles.css?v=5` ( incremented from v4 )
- `app.js?v=9` ( incremented from v8 )

## Files Modified

1. `web/public/index.html` — Added Watchdog tab button and panel containers
2. `web/public/app.js` — Added 4 new JavaScript functions
3. `web/public/styles.css` — Added ~30 CSS rules for Watchdog components

## Verification

- ✅ 6 active alerts displayed correctly
- ✅ 11 incident bundles were present during the 2026-09-01 verification
- ✅ APIs responding on port 3456
- ✅ Dashboard serving with all 7 tabs functional
- ✅ Auto-refresh working (30s interval)
- ✅ Severity colors mapping correctly

## Notes

- The dashboard uses the existing dark theme (`#1a1d29` background)
- Process names are sanitized (no full command lines)
- Bundle creation is synchronous (no background job)
- Alert history is client-side only (no server-side pagination)
- Response-contract, alert-lifecycle, alert-ID, and bundle-listing fixes landed in commit `8bcf9c2`.
