import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'memory_bank.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

function recordWork({
  task_id,
  task_description,
  files_modified = [],
  task_status = null,
  session_period = 'afternoon',
  session_notes = ''
}) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0];
  const timezone = 'IST';
  const timestamp = now.toISOString();

  // 1. Insert edit entry
  const editStmt = db.prepare(`
    INSERT INTO edit_entries (date, time, timezone, timestamp, task_id, task_description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const editResult = editStmt.run(date, time, timezone, timestamp, task_id, task_description);
  const editId = editResult.lastInsertRowid;

  // 2. Insert file modifications
  if (files_modified.length > 0) {
    const fileStmt = db.prepare(`
      INSERT INTO file_modifications (edit_entry_id, action, file_path, description)
      VALUES (?, ?, ?, ?)
    `);
    for (const f of files_modified) {
      fileStmt.run(editId, f.action, f.path, f.description || '');
    }
  }

  // 3. Update task status if provided
  if (task_status) {
    const taskStmt = db.prepare(`
      INSERT INTO task_items (id, title, status, priority, started, updated)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated = excluded.updated
    `);
    const today = new Date().toISOString().split('T')[0];
    taskStmt.run(task_id, task_description, task_status, 'medium', today, timestamp);
  }

  // 4. Create/update session
  const sessionId = `sess-${date}-${session_period}-${task_id}`;
  const sessionStmt = db.prepare(`
    INSERT INTO sessions (id, date, period, focus, status, content, start_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      focus = excluded.focus,
      status = excluded.status,
      content = excluded.content,
      end_time = excluded.end_time
  `);
  sessionStmt.run(sessionId, date, session_period, task_id, 'completed', session_notes, timestamp);

  // 5. Update session cache
  const cacheStmt = db.prepare(`
    INSERT INTO session_cache (session_id, status, focus, active_tasks_count, paused_tasks_count, completed_tasks_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status,
      focus = excluded.focus,
      active_tasks_count = excluded.active_tasks_count,
      paused_tasks_count = excluded.paused_tasks_count,
      completed_tasks_count = excluded.completed_tasks_count
  `);
  cacheStmt.run(sessionId, 'completed', task_id, 0, 0, 1);

  return { editId, sessionId };
}

// Record Cloudy's Phase 3 work
const cloudysWork = recordWork({
  task_id: 'T20',
  task_description: 'Phase 3: Backend API expansion — network interfaces, disk volumes, system info, battery health, disk I/O rates',
  files_modified: [
    { action: 'Modified', path: 'src/core/SystemCollector.ts', description: 'Added network interface collection, disk volume collection, system info (osInfo, cpuInfo), battery health, delta-based disk I/O rates' },
    { action: 'Modified', path: 'src/types/index.ts', description: 'Extended NetworkInterface, DiskVolume, SystemInfo, BatterySample types' },
    { action: 'Modified', path: 'src/web/server.ts', description: 'Added API endpoints: /api/network-interfaces, /api/network-connections, /api/disk-volumes' },
    { action: 'Modified', path: 'src/storage/TimeSeriesDB.ts', description: 'Updated schema for new fields' },
    { action: 'Modified', path: 'web/public/app.js', description: 'Updated renderNetworkView, renderDiskView, renderStatusView with real data tables' }
  ],
  task_status: 'completed',
  session_period: 'evening',
  session_notes: 'Cloudy push: Phase 3 complete. All detail views now show real data instead of placeholders. Network view shows interface list with RX/TX/speed/errors. Disk view shows per-mount volume table + I/O rates in MB/s. Status view shows OS, CPU model, uptime, hostname. Battery view shows time remaining, health %. Energy table removed (per-process energy not available on Apple Silicon).'
});

console.log('✅ Recorded Cloudy Phase 3 work:', cloudysWork);

// Record Sage's work
const sagesWork = recordWork({
  task_id: 'T20',
  task_description: 'Phase 3b: Apple Silicon battery temperature, frontend API integration, temperature investigation',
  files_modified: [
    { action: 'Modified', path: 'src/core/SystemCollector.ts', description: 'Added ioreg-based battery temperature reading for Apple Silicon (30.33°C confirmed working)' },
    { action: 'Modified', path: 'web/public/app.js', description: 'renderNetworkView now fetches /api/network-interfaces and /api/network-connections. renderStatusView shows battery temp, uptime, system info. Fixed API response wrapping (data.interfaces, data.connections)' },
    { action: 'Created', path: 'vendor/osx-cpu-temp/', description: 'Investigated osx-cpu-temp for Apple Silicon. Returns 0°C for CPU/GPU. Apple Silicon uses AppleARMPMUTempSensor IOService with HID events — requires full HID consumer implementation' }
  ],
  task_status: 'completed',
  session_period: 'afternoon',
  session_notes: 'Sage session: Pulled Cloudy changes, investigated temperature sensors on Apple Silicon. systeminformation.cpuTemperature() returns null on M-series. osx-cpu-temp (Intel SMC tool) returns 0°C. ioreg confirmed AppleARMPMUTempSensor services exist but expose data via HID events not registry properties. Battery temperature works via ioreg AppleSmartBattery (3033 = 30.33°C). Updated frontend to consume all new APIs. Servers restarted. Committed and pushed to origin/main.'
});

console.log('✅ Recorded Sage work:', sagesWork);

// Record temperature investigation as separate learning
const tempWork = recordWork({
  task_id: 'T20',
  task_description: 'Investigation: Apple Silicon temperature sensor architecture',
  files_modified: [
    { action: 'Created', path: 'vendor/osx-cpu-temp/arm_probe.c', description: 'IORegistry probe of AppleARMPMUTempSensor services — shows PMU tcal, tdev1-3 products but no direct temperature values in properties' },
    { action: 'Created', path: 'vendor/osx-cpu-temp/arm_temp.c', description: 'IOHIDManager-based temperature reader — non-functional, HID reports not decoded' }
  ],
  session_period: 'afternoon',
  session_notes: 'Temperature sensor investigation: Apple Silicon (M2) does not use Intel SMC keys (TC0P, TG0P, etc.). Temperature sensors are AppleARMPMUTempSensor IOService instances that deliver data via HID event reports. Reading actual values requires: (1) IOHIDManager with matching dictionaries, (2) report callback parsing, (3) scale factor application. Alternative: sudo powermetrics --samplers smc (inconsistent output, may need TTY). Third-party tools: Stats.app (open source), TG Pro (commercial).'
});

console.log('✅ Recorded temperature investigation:', tempWork);

db.close();
console.log('\n🎉 All work recorded successfully!');
