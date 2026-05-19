/**
 * Dashboard frontend — fetches data from /api/* and renders Chart.js charts.
 * Auto-refreshes every 5 seconds.
 */

const REFRESH_MS = 5000;
let charts = {};

// ─── Helpers ───────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function fmtNum(n, digits = 1) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(digits);
}

// ─── Chart Config ────────────────────────────────────────────────────

function createLineChart(ctx, label, color, fill = false) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: fill ? color + '20' : 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { display: false },
        y: {
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
      },
    },
  });
}

function createMultiLineChart(ctx, datasets) {
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { display: false },
        y: {
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
      },
    },
  });
}

// ─── Init Charts ─────────────────────────────────────────────────────

function initCharts() {
  charts.cpu = createMultiLineChart(
    document.getElementById('cpu-chart').getContext('2d'),
    [
      { label: 'CPU total', data: [], borderColor: '#38bdf8', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3 },
      { label: 'CPU user', data: [], borderColor: '#34d399', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'CPU system', data: [], borderColor: '#fbbf24', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'Memory %', data: [], borderColor: '#a78bfa', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
    ]
  );

  charts.battery = createLineChart(
    document.getElementById('battery-chart').getContext('2d'),
    'Battery %', '#f87171', true
  );

  charts.extras = createMultiLineChart(
    document.getElementById('extras-chart').getContext('2d'),
    [
      { label: 'Load avg', data: [], borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0, tension: 0.3 },
      { label: 'Swap used MB', data: [], borderColor: '#fbbf24', borderWidth: 1.5, pointRadius: 0, tension: 0.3, yAxisID: 'y1' },
      { label: 'CPU temp °C', data: [], borderColor: '#f87171', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
    ]
  );
  charts.extras.options.scales.y1 = {
    position: 'right',
    grid: { display: false },
    ticks: { color: '#94a3b8', font: { size: 11 } },
  };

  charts.io = createMultiLineChart(
    document.getElementById('io-chart').getContext('2d'),
    [
      { label: 'Disk read', data: [], borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0, tension: 0.3 },
      { label: 'Disk write', data: [], borderColor: '#fbbf24', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'Net rx MB', data: [], borderColor: '#34d399', borderWidth: 1.5, pointRadius: 0, tension: 0.3, yAxisID: 'y1' },
      { label: 'Net tx MB', data: [], borderColor: '#a78bfa', borderWidth: 1.5, pointRadius: 0, tension: 0.3, yAxisID: 'y1' },
    ]
  );
  charts.io.options.scales.y1 = {
    position: 'right',
    grid: { display: false },
    ticks: { color: '#94a3b8', font: { size: 11 } },
  };
}

// ─── Fetch & Render ──────────────────────────────────────────────────

async function loadData() {
  try {
    const [snapshotsRes, processesRes, drainsRes, statsRes] = await Promise.all([
      fetch('/api/snapshots?minutes=60'),
      fetch('/api/processes?limit=20'),
      fetch('/api/drain-events'),
      fetch('/api/stats'),
    ]);

    const snapshots = await snapshotsRes.json();
    const processes = await processesRes.json();
    const drains = await drainsRes.json();
    const stats = await statsRes.json();

    updateCharts(snapshots);
    updateProcessTable(processes);
    updateDrainTable(drains);
    updateStats(stats);

    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Dashboard refresh failed:', err);
  }
}

function updateCharts(snapshots) {
  // Reverse so oldest-first for charts
  const ordered = [...snapshots].reverse();
  const labels = ordered.map(s => fmtTime(s.timestamp));

  // CPU chart
  charts.cpu.data.labels = labels;
  charts.cpu.data.datasets[0].data = ordered.map(s => s.cpu_total ?? 0);
  charts.cpu.data.datasets[1].data = ordered.map(s => s.cpu_user ?? 0);
  charts.cpu.data.datasets[2].data = ordered.map(s => s.cpu_system ?? 0);
  charts.cpu.data.datasets[3].data = ordered.map(s => s.memory_total ?? 0);
  charts.cpu.update('none');

  // Battery chart
  charts.battery.data.labels = labels;
  charts.battery.data.datasets[0].data = ordered.map(s => s.battery_percent ?? 0);
  charts.battery.update('none');

  // Extras chart
  charts.extras.data.labels = labels;
  charts.extras.data.datasets[0].data = ordered.map(s => s.load_avg ?? 0);
  charts.extras.data.datasets[1].data = ordered.map(s => s.swap_used_mb ?? 0);
  charts.extras.data.datasets[2].data = ordered.map(s => s.cpu_temp ?? 0);
  charts.extras.update('none');

  // IO chart
  charts.io.data.labels = labels;
  charts.io.data.datasets[0].data = ordered.map(s => s.disk_read_io ?? 0);
  charts.io.data.datasets[1].data = ordered.map(s => s.disk_write_io ?? 0);
  charts.io.data.datasets[2].data = ordered.map(s => (s.net_rx_bytes ?? 0) / 1e6);
  charts.io.data.datasets[3].data = ordered.map(s => (s.net_tx_bytes ?? 0) / 1e6);
  charts.io.update('none');
}

function updateProcessTable(processes) {
  const tbody = document.querySelector('#process-table tbody');
  tbody.innerHTML = '';
  for (const p of processes) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.pid}</td>
      <td>${fmtNum(p.cpu_percent, 1)}</td>
      <td>${fmtNum(p.cpu_user_percent, 1)}</td>
      <td>${fmtNum(p.cpu_system_percent, 1)}</td>
      <td>${fmtNum(p.memory_percent, 1)}</td>
      <td>${fmtNum(p.rss_mb, 0)}</td>
      <td>${p.state || '—'}</td>
      <td>${p.nice ?? '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

function updateDrainTable(drains) {
  const tbody = document.querySelector('#drain-table tbody');
  const emptyMsg = document.getElementById('no-drains');
  tbody.innerHTML = '';

  if (drains.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  for (const d of drains) {
    const top = d.top_processes?.[0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(d.start_time)}</td>
      <td>${d.start_percent}% → ${d.end_percent}%</td>
      <td>${fmtNum(d.drain_rate, 2)}%/min</td>
      <td>${fmtNum(d.duration_minutes, 1)} min</td>
      <td>${top ? top.name + ' (' + fmtNum(top.cpu_percent, 1) + '%)' : '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

function updateStats(stats) {
  document.getElementById('db-snapshots').textContent = stats.totalSnapshots ?? '--';
  document.getElementById('db-events').textContent = stats.totalEvents ?? '--';
}

// ─── Boot ────────────────────────────────────────────────────────────

initCharts();
loadData();
setInterval(loadData, REFRESH_MS);
