# Edit Chunk: 2026-06-22 Evening — T4 Dashboard v4: Disk/Network Monitoring + Auto-Save + Drain Settings

## Summary
Extended dashboard (T4) with disk/network KPI cards and charts, auto-save settings with debounce, drain detection settings in Settings panel, client-side query caching, and multiple bug fixes.

## Changes

### 1. Drain Detection Settings Adjustable (User Request)
**File:** `src/config/ConfigManager.ts`
- Changed `DEFAULT_CONFIG.alert` defaults:
  - `drainThreshold`: 1.0 → 0.5 (%/min)
  - `minDuration`: 2 → 1 (minutes)
  - `cooldownMinutes`: 10 → 5 (minutes)
- More sensitive defaults capture more drain events without excessive noise

**File:** `web/public/index.html`
- Added "Drain Detection" section in Settings panel with 3 inputs:
  - Drain threshold (%/min), range 0.1–10, default 0.5
  - Min duration (min), range 1–30, default 1
  - Cooldown (min), range 1–120, default 5

**File:** `web/public/app.js`
- `loadMonitorConfig()`: populates drain settings from config
- `saveMonitorConfig()`: sends drain settings to `/api/config`

### 2. Client-Side Analysis Query Caching
**File:** `web/public/app.js`
- Added `analysisCache` Map with 5-minute TTL
- `runPresetQuery()` checks cache before fetching; stores results after fetch
- Prevents re-running expensive 7-day SQL aggregations on every click
- Cache key includes preset name; `clearAnalysisCache()` for manual refresh

### 3. Auto-Save Settings
**File:** `web/public/app.js`
- `initSettingsAutoSave()`: attaches `change`/`input` listeners to all settings inputs
- `debouncedAutoSave()`: 500ms debounce after user stops typing/changing
- `saveMonitorConfig(silent = true)`: saves without showing restart notice
- `showAutoSaveIndicator()`: transient "💾 Saved" toast bottom-right, fades after 2s
- Manual "Save Config" button still works for explicit saves

### 4. Disk & Network Monitoring
**File:** `src/web/server.ts`
- New endpoints:
  - `GET /api/analysis/disk-trend` — daily min/avg/max disk usage %
  - `GET /api/analysis/network-trend` — daily RX/TX cumulative MB

**File:** `src/storage/TimeSeriesDB.ts`
- `getSnapshotHistory()`: now returns `diskTotalIO`, `netRxBytes`, `netTxBytes`, `fsUsedPercent` columns (needed for chart rate computation)

**File:** `web/public/index.html`
- New KPI cards in overview: Disk (usage %), Network (live throughput)
- New chart tabs: Disk, Network (alongside Battery, CPU, Memory)
- New analysis preset buttons: Disk Usage Trend, Network Activity Trend

**File:** `web/public/app.js`
- `updateDashboard()`: Disk KPI shows `fsUsedPercent`; Network KPI computes live rates from snapshot deltas
- `renderLineChart()`: Precomputes `disk_rate` (I/O per second) and `network_rate` (KB/s) from cumulative counter deltas
- Auto-scaling y-axis for disk/network with adaptive unit labels (B/s, KB/s, MB/s)
- New renderers: `renderDiskTrend()`, `renderNetworkTrend()`

**File:** `web/public/styles.css`
- New CSS variables: `--accent-disk` (#8b5cf6), `--accent-network` (#06b6d4)
- `.kpi-card.disk`, `.kpi-card.network` accent colors
- `.chart-tab[data-tab="disk"].active`, `.chart-tab[data-tab="network"].active` styles
- Mobile: `.chart-tabs` horizontal scroll on narrow screens (`overflow-x: auto`)

### 5. Bug Fixes
- **404 on disk/network trend views**: Dashboard server wasn't restarted after adding endpoints. Restarted `src/web/server.ts` — endpoints now respond.
- **Y-axis labels all "1K"**: Two causes: (a) `/api/history` missing disk/network columns → all rates zero, (b) `toFixed(0)` rounded small values to 1. Fixed by adding columns to `getSnapshotHistory()` and using adaptive precision formatters.
- **Mobile chart tabs overflow**: Added `flex-wrap: nowrap` + `overflow-x: auto` on mobile (<640px).
- **Network KPI showed cumulative totals**: Changed to live throughput (RX/TX rates in KB/s or MB/s) computed from snapshot-to-snapshot deltas.

## Decisions
- **More sensitive drain defaults**: 0.5%/min threshold catches more events; user confirmed they want more visibility into drain patterns
- **Client-side caching only**: No server-side cache needed; 5-minute TTL is sufficient for analysis queries
- **Rate computation in frontend**: Disk/network counters are cumulative; frontend computes deltas. Keeps backend simple.
- **Adaptive unit labels**: Network chart auto-switches B/s → KB/s → MB/s based on max value; disk chart uses IO/s with 1 decimal when <10

## Files Modified
- `src/config/ConfigManager.ts`
- `src/storage/TimeSeriesDB.ts`
- `src/web/server.ts`
- `web/public/index.html`
- `web/public/app.js`
- `web/public/styles.css`

## Task Impact
- **T4 (Dashboard)**: Extended again — now includes disk/network monitoring, auto-save, drain settings, query caching
- No new task ID needed; all changes are T4 dashboard enhancements
