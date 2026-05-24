# Mac Process Monitor — Web Dashboard Implementation

*Project*: mac-process-monitor  
*Component*: Web Dashboard (T4)  
*Last Updated*: 2026-05-25  

## Overview

Real-time web dashboard for monitoring macOS system metrics. Serves from a lightweight Node HTTP server with vanilla JS frontend. No framework dependencies.

## Architecture

```
┌─────────────────────────────────────────┐
│           Browser (any device)            │
│  ┌─────────────────────────────────────┐ │
│  │  index.html + app.js + styles.css   │ │
│  │  • Auto-refresh every 5s            │ │
│  │  • KPI cards (battery, CPU, mem)    │ │
│  │  • Process table (sortable)         │ │
│  │  • Battery history chart            │ │
│  │  • Drain events + CSV export        │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    ▼ HTTP (port 3456)
┌─────────────────────────────────────────┐
│       src/web/server.ts (Node HTTP)     │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │/api/    │ │/api/     │ │/api/     │ │
│  │snapshot │ │history   │ │drain-    │ │
│  │ (LIVE)  │ │ (DB)     │ │events   │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ Static files: web/public/*          │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Server (`src/web/server.ts`)

### Design Decisions

- **Native Node `createServer`** — No Express dependency, lighter weight
- **Live data for snapshot** — `/api/snapshot` calls `SystemCollector.getSystemSnapshot()` directly, not DB cache. Ensures current data even if monitor isn't running.
- **DB for history** — `/api/history` and `/api/drain-events` read from SQLite
- **CORS enabled** — Allows access from Android/other devices on local network
- **0.0.0.0 binding** — Accessible from any device on LAN

### API Endpoints

| Endpoint | Data Source | Returns |
|----------|-------------|---------|
| `GET /api/snapshot` | Live collection | Current battery, CPU, processes |
| `GET /api/history?minutes=60` | SQLite DB | Time-series: timestamp, battery_percent, cpu_total, memory_total |
| `GET /api/drain-events` | SQLite DB | Drain events with associated processes |

### Key Code Pattern

```typescript
// /api/snapshot — ALWAYS live, never stale DB
if (pathname === '/api/snapshot') {
  const snapshot = await collector.getSystemSnapshot();  // Live!
  res.end(JSON.stringify(snapshot));
}

// /api/history — DB time-series
if (pathname === '/api/history') {
  const history = db.getSnapshotHistory(minutes);
  res.end(JSON.stringify(history));
}
```

## Frontend (`web/public/app.js`)

### State Management

No framework — plain JS with module-level variables:

```javascript
let currentProcesses = [];  // Last fetched process list
let currentSort = 'cpu';    // 'cpu' | 'mem'
let refreshInterval = null; // 5s auto-refresh timer
```

### Data Flow

```
init()
  ├── fetchData() ──→ GET /api/snapshot
  │     └── updateDashboard(data)
  │           ├── updateBatteryCard()
  │           ├── updateCpuCard()
  │           ├── updateMemCard()
  │           ├── updateStatusCard()
  │           └── renderProcesses() ──→ sort + top 10
  ├── loadHistory(60) ──→ GET /api/history?minutes=60
  │     └── renderChart(data)
  └── loadDrainEvents() ──→ GET /api/drain-events
        └── renderDrainEvents(events)

Every 5s: fetchData() + loadDrainEvents()
```

### Chart Implementation

**CSS-only bar chart** — no Chart.js or D3 dependency.

**Structure**:
```html
<div class="chart-wrapper">
  <div class="chart-y-axis">     <!-- 100%, 75%, 50%, 25%, 0% -->
  <div class="chart-area">
    <div class="chart-gridlines"> <!-- 5 horizontal lines -->
    <div class="chart-container"> <!-- Bars -->
      <div class="chart-bar" style="height: 38%;" data-value="38% @ 00:51">
      </div>
    </div>
  </div>
</div>
<div class="chart-x-axis">       <!-- Time labels -->
```

**Key features**:
- Y-axis labels: percentage (0–100%)
- X-axis labels: first, middle, last timestamps
- Gridlines: faint horizontal reference lines
- Hover tooltip: `data-value` attribute shows exact % + time
- Bars: `flex: 1` for equal width, `height: ${percent}%` for value

**Responsive**: Bars scale with container, labels stay readable.

### Process Table

| Column | Sortable | Display |
|--------|----------|---------|
| Process | No | Name + icon |
| PID | No | Process ID |
| CPU | **Yes** (▼ default) | Percentage + visual bar |
| Memory | **Yes** | MB value |

**CPU bar**: 
- Track: 60px wide, 4px tall, dark background
- Fill: colored bar, width = percentage
- Color: default blue, `high` class = red if > 50%

### Sorting

```javascript
function sortProcesses(by, clickedBtn) {
  currentSort = by;  // 'cpu' or 'mem'
  renderProcesses();
  // Update button active state
}

function renderProcesses() {
  const sorted = [...currentProcesses].sort((a, b) => {
    if (currentSort === 'cpu') return b.cpuPercent - a.cpuPercent;
    return b.memoryPercent - a.memoryPercent;  // Note: mem sort uses memoryPercent, not rssMB
  }).slice(0, 10);
}
```

**Note**: Memory sort button exists but sorts by `memoryPercent` (percentage of total RAM), not `rssMB` (absolute MB). This is a known limitation — T4 Phase 2 will add proper MB sorting.

## Styling (`web/public/styles.css`)

### Design System

```css
:root {
  --bg: #0f1115;           /* Deep charcoal background */
  --surface: #181b21;      /* Card background */
  --surface-raised: #1e2128; /* Elevated elements */
  --text: #e2e8f0;         /* Primary text */
  --text-dim: #94a3b8;     /* Secondary text */
  --border: rgba(255,255,255,0.06);
  --accent-battery: #22d3ee;  /* Cyan */
  --accent-cpu: #a78bfa;      /* Purple */
  --accent-mem: #34d399;      /* Green */
  --accent-drain: #f87171;    /* Red */
  --font-display: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Layout

- **Header**: Title + live indicator (pulsing green dot)
- **KPI Grid**: 4 cards in 2×2 grid (desktop), 2×2 (tablet), 1 column (mobile)
- **Main Grid**: Process table + Battery chart side by side (desktop), stacked (mobile)
- **Drain Events**: Full-width panel below

### Responsive Breakpoints

```css
@media (max-width: 768px) {
  .main-grid { grid-template-columns: 1fr; }  /* Stack panels */
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }  /* 2×2 KPIs */
}
```

## Data Format Handling

### Snake Case vs Camel Case

The DB uses `snake_case` column names, but the original code expected `camelCase`. Fixed with fallback:

```javascript
// In renderChart()
const percent = d.battery_percent ?? d.batteryPercent ?? 0;

// In server.ts (if reconstructing from DB)
processes.map(p => ({
  cpuPercent: p.cpu_percent,      // DB → JS
  memoryPercent: p.memory_percent,
  rssMB: p.rss_mb,
}))
```

**Rule**: Frontend should always use `??` fallback for API fields that may change casing.

## Known Limitations

1. **Memory sort**: Button exists but sorts by `memoryPercent` (%) not `rssMB` (absolute MB)
2. **CPU history**: No chart yet — only battery history exists
3. **No auth**: Dashboard is open on local network (acceptable for home use)
4. **No WebSocket**: Polling every 5s (simple but not real-time)
5. **Chart bars**: CSS-only, limited to ~50 bars before crowding

## Testing

### Manual Test Checklist

- [ ] Dashboard loads at `http://localhost:3456`
- [ ] Accessible from phone on `http://192.168.1.x:3456`
- [ ] KPI cards show live data (battery %, CPU %, memory GB)
- [ ] Process table shows top 10 by CPU
- [ ] Click "Mem ▲" sorts by memory
- [ ] Battery chart shows bars with Y-axis % labels
- [ ] X-axis shows time labels
- [ ] Hover over bar shows tooltip
- [ ] Auto-refresh updates every 5s (check timestamp)
- [ ] Drain events panel shows "No drain events" (or real events)
- [ ] Export CSV button works (when events exist)

### Debug

```javascript
// In browser console:
fetch('/api/snapshot').then(r => r.json()).then(console.log)
fetch('/api/history?minutes=60').then(r => r.json()).then(d => console.log(d.length, d[0]))
fetch('/api/drain-events').then(r => r.json()).then(console.log)
```

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/web/server.ts` | HTTP server + API routes | ~111 |
| `web/public/index.html` | Dashboard markup | ~123 |
| `web/public/app.js` | Frontend logic | ~234 |
| `web/public/styles.css` | Dark theme styling | ~512 |

---

*See also*: `architecture.md` for overall system design, `memory-bank/tasks/T4.md` for task progress.
