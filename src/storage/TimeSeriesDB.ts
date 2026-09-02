import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  BatterySample,
  ProcessSnapshot,
  SystemSnapshot,
  ProcessSpike,
  BatteryImpactEvent,
  DrainEvent,
  WatchdogAlert,
} from '../types/index.js';
import { safeExecutableName } from '../core/WatchdogEvidence.js';

/**
 * SQLite storage for time-series system snapshots and drain events.
 * Provides efficient querying for history and trend analysis.
 */
export class TimeSeriesDB {
  public db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = '~/.procmon/monitor.db') {
    this.dbPath = dbPath.replace(/^~/, process.env.HOME || '');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
    this.migrateSchema();
  }

  private tableHasColumn(table: string, column: string): boolean {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    return cols.some(c => c.name === column);
  }

  private migrateSchema(): void {
    // Migrate snapshots table: add new columns if missing
    const snapshotCols = [
      { name: 'cpu_user', type: 'REAL' },
      { name: 'cpu_system', type: 'REAL' },
      { name: 'cpu_idle', type: 'REAL' },
      { name: 'memory_used_mb', type: 'REAL' },
      { name: 'memory_free_mb', type: 'REAL' },
      { name: 'swap_used_mb', type: 'REAL' },
      { name: 'swap_total_mb', type: 'REAL' },
      { name: 'load_avg', type: 'REAL' },
      { name: 'disk_read_io', type: 'REAL' },
      { name: 'disk_write_io', type: 'REAL' },
      { name: 'disk_total_io', type: 'REAL' },
      { name: 'net_rx_bytes', type: 'REAL' },
      { name: 'net_tx_bytes', type: 'REAL' },
      { name: 'fs_used_percent', type: 'REAL' },
      { name: 'cpu_temp', type: 'REAL' },
      { name: 'timestamp_utc', type: 'TEXT' },
      { name: 'timestamp_ist', type: 'TEXT' },
      { name: 'memory_pressure', type: 'TEXT' },
      { name: 'memory_pressure_percent', type: 'REAL' },
      { name: 'swap_usage_total_mb', type: 'REAL' },
      { name: 'swap_usage_used_mb', type: 'REAL' },
      { name: 'swap_usage_free_mb', type: 'REAL' },
      { name: 'swap_usage_percent', type: 'REAL' },
      { name: 'vm_page_size_bytes', type: 'INTEGER' },
      { name: 'vm_pages_free', type: 'INTEGER' },
      { name: 'vm_pages_active', type: 'INTEGER' },
      { name: 'vm_pages_inactive', type: 'INTEGER' },
      { name: 'vm_pages_wired', type: 'INTEGER' },
      { name: 'vm_pages_compressed', type: 'INTEGER' },
      { name: 'vm_pages_purged', type: 'INTEGER' },
      { name: 'vm_pageins', type: 'INTEGER' },
      { name: 'vm_pageouts', type: 'INTEGER' },
      { name: 'vm_swapins', type: 'INTEGER' },
      { name: 'vm_swapouts', type: 'INTEGER' },
      { name: 'vm_compressor_bytes', type: 'INTEGER' },
      { name: 'available_memory_mb', type: 'REAL' },
      { name: 'process_count', type: 'INTEGER' },
      { name: 'relevant_process_count', type: 'INTEGER' },
      { name: 'unique_pid_count', type: 'INTEGER' },
      { name: 'pid_churn_percent', type: 'REAL' },
      { name: 'sample_gap_seconds', type: 'REAL' },
    ];
    for (const col of snapshotCols) {
      if (!this.tableHasColumn('snapshots', col.name)) {
        this.db.exec(`ALTER TABLE snapshots ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    // Migrate process_samples table: add new columns if missing
    const processCols = [
      { name: 'cpu_user_percent', type: 'REAL' },
      { name: 'cpu_system_percent', type: 'REAL' },
      { name: 'nice', type: 'INTEGER' },
      { name: 'state', type: 'TEXT' },
      { name: 'energy_mj', type: 'REAL' },
      { name: 'ppid', type: 'INTEGER' },
      { name: 'user_name', type: 'TEXT' },
      { name: 'executable', type: 'TEXT' },
      { name: 'process_group', type: 'TEXT' },
      { name: 'safe_identifier', type: 'TEXT' },
      { name: 'elapsed', type: 'TEXT' },
    ];
    for (const col of processCols) {
      if (!this.tableHasColumn('process_samples', col.name)) {
        this.db.exec(`ALTER TABLE process_samples ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  }

  private initTables(): void {
    // System snapshots - time series data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        battery_percent REAL NOT NULL,
        is_charging INTEGER NOT NULL,
        cpu_total REAL,
        cpu_user REAL,
        cpu_system REAL,
        cpu_idle REAL,
        memory_total REAL,
        memory_used_mb REAL,
        memory_free_mb REAL,
        swap_used_mb REAL,
        swap_total_mb REAL,
        load_avg REAL,
        disk_read_io REAL,
        disk_write_io REAL,
        disk_total_io REAL,
        net_rx_bytes REAL,
        net_tx_bytes REAL,
        fs_used_percent REAL,
        cpu_temp REAL
        ,timestamp_utc TEXT
        ,timestamp_ist TEXT
        ,memory_pressure TEXT
        ,memory_pressure_percent REAL
        ,swap_usage_total_mb REAL
        ,swap_usage_used_mb REAL
        ,swap_usage_free_mb REAL
        ,swap_usage_percent REAL
        ,vm_page_size_bytes INTEGER
        ,vm_pages_free INTEGER
        ,vm_pages_active INTEGER
        ,vm_pages_inactive INTEGER
        ,vm_pages_wired INTEGER
        ,vm_pages_compressed INTEGER
        ,vm_pages_purged INTEGER
        ,vm_pageins INTEGER
        ,vm_pageouts INTEGER
        ,vm_swapins INTEGER
        ,vm_swapouts INTEGER
        ,vm_compressor_bytes INTEGER
        ,available_memory_mb REAL
        ,process_count INTEGER
        ,relevant_process_count INTEGER
        ,unique_pid_count INTEGER
        ,pid_churn_percent REAL
        ,sample_gap_seconds REAL
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_time ON snapshots(timestamp);
    `);

    // Process data per snapshot (denormalized for query speed)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        pid INTEGER NOT NULL,
        name TEXT NOT NULL,
        cpu_percent REAL NOT NULL,
        cpu_user_percent REAL,
        cpu_system_percent REAL,
        memory_percent REAL NOT NULL,
        rss_mb REAL NOT NULL,
        nice INTEGER,
        state TEXT,
        cmdline TEXT,
        energy_mj REAL,
        ppid INTEGER,
        user_name TEXT,
        executable TEXT,
        process_group TEXT,
        safe_identifier TEXT,
        elapsed TEXT,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
      );
      CREATE INDEX IF NOT EXISTS idx_processes_snapshot ON process_samples(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_processes_name ON process_samples(name);
    `);

    // Drain events - detected incidents
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drain_events (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        start_percent REAL NOT NULL,
        end_percent REAL NOT NULL,
        drain_rate REAL NOT NULL,
        duration_minutes REAL NOT NULL,
        was_charging INTEGER NOT NULL,
        top_processes_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_drain_time ON drain_events(start_time);
    `);

    // Sleep/wake events - power state transitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sleep_wake_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL CHECK(event_type IN ('sleep', 'wake')),
        timestamp INTEGER NOT NULL,
        battery_percent REAL NOT NULL,
        is_charging INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sleep_wake_time ON sleep_wake_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sleep_wake_type ON sleep_wake_events(event_type);
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monitoring_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        processes_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // Process spikes - detected resource usage spikes
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_spikes (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        pid INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        baseline REAL NOT NULL,
        threshold REAL NOT NULL,
        snapshot_id INTEGER,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
      );
      CREATE INDEX IF NOT EXISTS idx_spikes_time ON process_spikes(timestamp);
      CREATE INDEX IF NOT EXISTS idx_spikes_process ON process_spikes(process_name);
    `);

    // Battery impact - accumulated per-process battery drain scores
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS battery_impact (
        process_name TEXT PRIMARY KEY,
        total_impact_score REAL NOT NULL DEFAULT 0,
        drain_time_minutes REAL NOT NULL DEFAULT 0,
        samples_during_drain INTEGER NOT NULL DEFAULT 0,
        avg_cpu_during_drain REAL NOT NULL DEFAULT 0,
        last_seen_timestamp INTEGER NOT NULL,
        first_seen_timestamp INTEGER NOT NULL
      );
    `);

    // Battery impact events - individual drain period details
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS battery_impact_events (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration_minutes REAL NOT NULL,
        battery_drop_percent REAL NOT NULL,
        process_impacts_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_impact_events_time ON battery_impact_events(start_time);
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watchdog_alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        observed_at INTEGER NOT NULL,
        timestamp_utc TEXT NOT NULL,
        severity TEXT NOT NULL,
        observation TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_watchdog_alerts_time ON watchdog_alerts(observed_at);
    `);
  }

  insertSnapshot(snapshot: SystemSnapshot, includeProcesses: boolean = true): number {
    const snapStmt = this.db.prepare(`
      INSERT INTO snapshots (
        timestamp, battery_percent, is_charging,
        cpu_total, cpu_user, cpu_system, cpu_idle,
        memory_total, memory_used_mb, memory_free_mb,
        swap_used_mb, swap_total_mb, load_avg,
        disk_read_io, disk_write_io, disk_total_io,
        net_rx_bytes, net_tx_bytes,
        fs_used_percent, cpu_temp,
        timestamp_utc, timestamp_ist, memory_pressure, memory_pressure_percent,
        swap_usage_total_mb, swap_usage_used_mb, swap_usage_free_mb, swap_usage_percent,
        vm_page_size_bytes, vm_pages_free, vm_pages_active, vm_pages_inactive,
        vm_pages_wired, vm_pages_compressed, vm_pages_purged, vm_pageins, vm_pageouts,
        vm_swapins, vm_swapouts, vm_compressor_bytes, available_memory_mb,
        process_count, relevant_process_count, unique_pid_count, sample_gap_seconds
        ,pid_churn_percent
      )
      VALUES (${Array.from({ length: 46 }, () => '?').join(', ')})
    `);
    const host = snapshot.hostEvidence;
    const vm = host?.vmStat;
    const swap = host?.swapUsage;
    const insert = this.db.transaction(() => {
      const result = snapStmt.run(
        snapshot.timestamp, snapshot.battery.percent, snapshot.battery.isCharging ? 1 : 0,
        snapshot.cpuTotal, snapshot.cpuUser, snapshot.cpuSystem, snapshot.cpuIdle,
        snapshot.memoryTotal, snapshot.memoryUsedMB, snapshot.memoryFreeMB,
        snapshot.swapUsedMB, snapshot.swapTotalMB, snapshot.loadAvg,
        snapshot.diskReadIO, snapshot.diskWriteIO, snapshot.diskTotalIO,
        snapshot.netRxBytes, snapshot.netTxBytes, snapshot.fsUsedPercent, snapshot.cpuTemp,
        host?.timestampUtc ?? new Date(snapshot.timestamp).toISOString(), host?.timestampIst ?? null,
        host?.memoryPressure ?? null, host?.memoryPressurePercent ?? null,
        swap?.totalBytes != null ? swap.totalBytes / 1024 / 1024 : null,
        swap?.usedBytes != null ? swap.usedBytes / 1024 / 1024 : null,
        swap?.freeBytes != null ? swap.freeBytes / 1024 / 1024 : null,
        swap?.usedPercent ?? null,
        vm?.pageSizeBytes ?? null, vm?.pagesFree ?? null, vm?.pagesActive ?? null,
        vm?.pagesInactive ?? null, vm?.pagesWired ?? null, vm?.pagesCompressed ?? null,
        vm?.pagesPurged ?? null, vm?.pageins ?? null, vm?.pageouts ?? null,
        vm?.swapins ?? null, vm?.swapouts ?? null, vm?.compressorBytes ?? null,
        host?.availableMemoryMB ?? null, host?.processCount ?? snapshot.processes.length,
        host?.relevantProcessCount ?? 0, host?.uniquePidCount ?? snapshot.processes.length,
        host?.sampleGapSeconds ?? null,
        host?.pidChurnPercent ?? null,
      );
      const snapshotId = result.lastInsertRowid as number;

      if (includeProcesses) {
        const procStmt = this.db.prepare(`
          INSERT INTO process_samples (
            snapshot_id, pid, name, cpu_percent, cpu_user_percent, cpu_system_percent,
            memory_percent, rss_mb, nice, state, cmdline, energy_mj,
            ppid, user_name, executable, process_group, safe_identifier, elapsed
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const proc of snapshot.processes) {
          procStmt.run(
            snapshotId, proc.pid, proc.name, proc.cpuPercent, proc.cpuUserPercent, proc.cpuSystemPercent,
            proc.memoryPercent, proc.rssMB, proc.nice, proc.state, proc.executable || proc.name,
            proc.energyMJ ?? null, proc.ppid ?? null, proc.user || 'unknown', proc.executable || proc.name,
            proc.processGroup || 'other', proc.safeIdentifier ?? null, proc.elapsed ?? null,
          );
        }
      }
      return snapshotId;
    });
    return insert();
  }

  insertDrainEvent(event: DrainEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO drain_events (id, start_time, end_time, start_percent, end_percent, drain_rate, duration_minutes, was_charging, top_processes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.id,
      event.startTime,
      event.endTime,
      event.startPercent,
      event.endPercent,
      event.drainRate,
      event.durationMinutes,
      event.wasCharging ? 1 : 0,
      JSON.stringify(event.topProcesses)
    );
  }

  getRecentSnapshots(minutes: number = 60): any[] {
    const safeMinutes = Math.min(Math.max(Number.isFinite(minutes) ? minutes : 60, 1), 60);
    const cutoff = Date.now() - safeMinutes * 60000;
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots WHERE timestamp > ? ORDER BY timestamp DESC
    `);
    return stmt.all(cutoff).slice(0, 240);
  }

  /**
   * Returns raw snapshot rows (newest first) for the dashboard API.
   * Includes all columns directly from the DB - no type reconstruction.
   */
  getRecentSnapshotsRaw(minutes: number = 60): any[] {
    const safeMinutes = Math.min(Math.max(Number.isFinite(minutes) ? minutes : 60, 1), 60);
    const cutoff = Date.now() - safeMinutes * 60000;
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots WHERE timestamp > ? ORDER BY timestamp DESC
    `);
    return stmt.all(cutoff).slice(0, 240);
  }

  insertWatchdogAlert(alert: WatchdogAlert): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO watchdog_alerts
        (id, type, observed_at, timestamp_utc, severity, observation, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET active = excluded.active
    `).run(alert.id, alert.type, alert.observedAt, alert.timestampUtc, alert.severity, alert.observation, alert.active ? 1 : 0);
  }

  getWatchdogAlert(id: string): any | null {
    const row = this.db.prepare(`
      SELECT id, type, observed_at AS observedAt, timestamp_utc AS timestampUtc,
             severity, observation, active
      FROM watchdog_alerts WHERE id = ?
    `).get(id) as any;
    return row ? { ...row, active: Boolean(row.active) } : null;
  }

  getWatchdogAlerts(minutes: number = 60, limit: number = 100): any[] {
    const safeMinutes = Math.min(Math.max(Number.isFinite(minutes) ? minutes : 60, 1), 60);
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 100, 1), 100);
    const rows = this.db.prepare(`
      SELECT id, type, observed_at AS observedAt, timestamp_utc AS timestampUtc,
             severity, observation, active
      FROM watchdog_alerts WHERE observed_at > ?
      ORDER BY observed_at DESC LIMIT ?
    `).all(Date.now() - safeMinutes * 60000, safeLimit) as any[];
    return rows.map(row => ({ ...row, active: Boolean(row.active) }));
  }

  /** Write a bounded, sanitized incident bundle atomically for later review. */
  createIncidentBundle(reason: string, observedAt: number = Date.now(), alertId: string | null = null): string | null {
    try {
      const incidentDir = path.join(path.dirname(this.dbPath), 'incidents');
      fs.mkdirSync(incidentDir, { recursive: true, mode: 0o700 });
      const stamp = new Date(observedAt).toISOString().replace(/[:.]/g, '-');
      const target = path.join(incidentDir, `incident-${stamp}.json`);
      const temp = `${target}.${process.pid}.tmp`;
      const payload = {
        schemaVersion: 1,
        kind: 'process-monitor-watchdog-evidence',
        observedAt,
        timestampUtc: new Date(observedAt).toISOString(),
        reason: reason.slice(0, 500),
        alertId,
        history: this.getRecentSnapshotsRaw(60),
        latestProcesses: this.getLatestProcesses(100),
        alerts: this.getWatchdogAlerts(60, 100),
        privacy: 'No credentials, environment variables, prompt contents, or unrestricted command lines are collected.',
      };
      fs.writeFileSync(temp, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temp, target);
      return target;
    } catch (err) {
      console.error('[TimeSeriesDB] Incident bundle failed:', (err as Error).message);
      return null;
    }
  }

  listIncidentBundles(limit: number = 50): any[] {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 100);
    const incidentDir = path.join(path.dirname(this.dbPath), 'incidents');
    if (!fs.existsSync(incidentDir)) return [];
    return fs.readdirSync(incidentDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && /^incident-[A-Za-z0-9_.-]+\.json$/.test(entry.name))
      .map(entry => {
        const filePath = path.join(incidentDir, entry.name);
        const stats = fs.statSync(filePath);
        return {
          name: entry.name,
          size: stats.size,
          sizeMB: Number((stats.size / (1024 * 1024)).toFixed(2)),
          modifiedAt: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, safeLimit);
  }

  getIncidentBundlePath(name: string): string | null {
    if (!/^incident-[A-Za-z0-9_.-]+\.json$/.test(name)) return null;
    const filePath = path.join(path.dirname(this.dbPath), 'incidents', name);
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null;
  }

  /**
   * Returns the most recent process samples from the latest snapshot.
   */
  getLatestProcesses(limit: number = 20): any[] {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 20, 1), 100);
    const latest = this.db.prepare(`
      SELECT id FROM snapshots ORDER BY timestamp DESC LIMIT 1
    `).get() as { id: number } | undefined;
    if (!latest) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM process_samples
      WHERE snapshot_id = ?
      ORDER BY cpu_percent DESC
      LIMIT ?
    `);
    return (stmt.all(latest.id, safeLimit) as any[]).map(row => ({
      ...row,
      cmdline: safeExecutableName(String(row.executable || row.name || row.cmdline || 'unknown')),
    }));
  }

  getDrainEvents(since?: number): DrainEvent[] {
    let sql = 'SELECT * FROM drain_events';
    const params: any[] = [];
    if (since) {
      sql += ' WHERE start_time > ?';
      params.push(since);
    }
    sql += ' ORDER BY start_time DESC LIMIT 100';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(r => ({
      ...r,
      wasCharging: !!r.was_charging,
      topProcesses: JSON.parse(r.top_processes_json),
    }));
  }

  cleanupOldSamples(retentionDays: number, maxSizeMB?: number): void {
    const cutoff = Date.now() - retentionDays * 86400000;

    // Delete child rows first (foreign keys to snapshots)
    this.db.prepare(`
      DELETE FROM process_samples WHERE snapshot_id IN (
        SELECT id FROM snapshots WHERE timestamp < ?
      )
    `).run(cutoff);

    this.db.prepare(`
      DELETE FROM process_spikes WHERE snapshot_id IN (
        SELECT id FROM snapshots WHERE timestamp < ?
      )
    `).run(cutoff);

    // Delete old snapshots
    this.db.prepare('DELETE FROM snapshots WHERE timestamp < ?').run(cutoff);
    this.db.prepare('DELETE FROM watchdog_alerts WHERE observed_at < ?').run(cutoff);

    // ─── Size-based cleanup (if maxSizeMB provided) ───
    if (maxSizeMB && maxSizeMB > 0) {
      const targetBytes = maxSizeMB * 1024 * 1024;
      let iterations = 0;
      const maxIterations = 100; // safety limit

      while (iterations < maxIterations) {
        const stats = this.getStats();
        if (stats.dbSizeBytes <= targetBytes) break;

        // Delete oldest batch of snapshots (500 at a time)
        const oldestIds = this.db.prepare(`
          SELECT id FROM snapshots ORDER BY timestamp ASC LIMIT 500
        `).all() as any[];

        if (oldestIds.length === 0) break;

        const ids = oldestIds.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');

        this.db.prepare(`
          DELETE FROM process_samples WHERE snapshot_id IN (${placeholders})
        `).run(...ids);

        this.db.prepare(`
          DELETE FROM process_spikes WHERE snapshot_id IN (${placeholders})
        `).run(...ids);

        this.db.prepare(`
          DELETE FROM snapshots WHERE id IN (${placeholders})
        `).run(...ids);

        iterations++;
      }

      // Reclaim freed disk space
      this.db.prepare('VACUUM').run();
    }
  }

  getStats(): { totalSnapshots: number; totalEvents: number; oldestSnapshot: number | null; dbSizeBytes: number } {
    const snapshots = this.db.prepare('SELECT COUNT(*) as count, MIN(timestamp) as oldest FROM snapshots').get() as any;
    const events = this.db.prepare('SELECT COUNT(*) as count FROM drain_events').get() as any;

    // Get DB file size
    let dbSizeBytes = 0;
    try {
      const stat = fs.statSync(this.dbPath);
      dbSizeBytes = stat.size;
    } catch {
      // Ignore if file not accessible
    }

    return {
      totalSnapshots: snapshots.count,
      totalEvents: events.count,
      oldestSnapshot: snapshots.oldest,
      dbSizeBytes,
    };
  }

  getLatestSnapshot(): SystemSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1
    `);
    const row = stmt.get() as any;
    if (!row) return null;

    // Get processes for this snapshot
    const procStmt = this.db.prepare(`
      SELECT * FROM process_samples WHERE snapshot_id = ? ORDER BY cpu_percent DESC
    `);
    const processes = procStmt.all(row.id) as any[];

    return {
      timestamp: row.timestamp,
      battery: {
        timestamp: row.timestamp,
        percent: row.battery_percent,
        isCharging: !!row.is_charging,
        isPlugged: !!row.is_charging,
        timeRemaining: null,
        cycleCount: null,
        temperature: null,
        health: null,
      },
      processes: processes.map(p => ({
        pid: p.pid,
        name: p.name,
        cpuPercent: p.cpu_percent,
        cpuUserPercent: p.cpu_user_percent ?? 0,
        cpuSystemPercent: p.cpu_system_percent ?? 0,
        memoryPercent: p.memory_percent,
        rssMB: p.rss_mb,
        vmsMB: 0,
        nice: p.nice ?? 0,
        state: p.state ?? 'unknown',
        cmdline: safeExecutableName(String(p.executable || p.name || p.cmdline || 'unknown')),
        energyMJ: p.energy_mj ?? null,
      })),
      cpuTotal: row.cpu_total,
      cpuUser: row.cpu_user ?? 0,
      cpuSystem: row.cpu_system ?? 0,
      cpuIdle: row.cpu_idle ?? 0,
      memoryTotal: row.memory_total,
      memoryUsedMB: row.memory_used_mb ?? 0,
      memoryFreeMB: row.memory_free_mb ?? 0,
      swapUsedMB: row.swap_used_mb ?? 0,
      swapTotalMB: row.swap_total_mb ?? 0,
      loadAvg: row.load_avg ?? 0,
      diskReadIO: row.disk_read_io ?? null,
      diskWriteIO: row.disk_write_io ?? null,
      diskTotalIO: row.disk_total_io ?? null,
      netRxBytes: row.net_rx_bytes ?? null,
      netTxBytes: row.net_tx_bytes ?? null,
      fsUsedPercent: row.fs_used_percent ?? null,
      cpuTemp: row.cpu_temp ?? null,
      diskReadRate: null,
      diskWriteRate: null,
      networkInterfaces: [],
      diskVolumes: [],
      systemInfo: {
        platform: 'unknown',
        distro: 'unknown',
        release: 'unknown',
        arch: 'unknown',
        hostname: 'unknown',
        uptime: 0,
        bootTime: 0,
        cpuModel: 'unknown',
        cpuCores: 0,
        cpuThreads: 0,
      },
    };
  }

  getSnapshotHistory(minutes: number = 60): any[] {
    const safeMinutes = Math.min(Math.max(Number.isFinite(minutes) ? minutes : 60, 1), 60);
    const cutoff = Date.now() - safeMinutes * 60000;
    const stmt = this.db.prepare(`
      SELECT timestamp, timestamp_utc AS timestampUtc, timestamp_ist AS timestampIst,
             battery_percent AS batteryPercent, cpu_total AS cpuTotal, memory_total AS memoryTotal,
             memory_used_mb AS memoryUsedMB, memory_free_mb AS memoryFreeMB,
             available_memory_mb AS availableMemoryMB, memory_pressure AS memoryPressure,
             memory_pressure_percent AS memoryPressurePercent,
             swap_used_mb AS swapUsedMB, swap_total_mb AS swapTotalMB,
             swap_usage_total_mb AS swapUsageTotalMB, swap_usage_used_mb AS swapUsageUsedMB,
             swap_usage_free_mb AS swapUsageFreeMB, swap_usage_percent AS swapUsagePercent,
             vm_page_size_bytes AS vmPageSizeBytes, vm_pages_free AS vmPagesFree,
             vm_pages_active AS vmPagesActive, vm_pages_inactive AS vmPagesInactive,
             vm_pages_wired AS vmPagesWired, vm_pages_compressed AS vmPagesCompressed,
             vm_pages_purged AS vmPagesPurged, vm_compressor_bytes AS vmCompressorBytes,
             vm_pageins AS vmPageins, vm_pageouts AS vmPageouts,
             vm_swapins AS vmSwapins, vm_swapouts AS vmSwapouts,
             process_count AS processCount, relevant_process_count AS relevantProcessCount,
             unique_pid_count AS uniquePidCount, pid_churn_percent AS pidChurnPercent,
             sample_gap_seconds AS sampleGapSeconds,
             load_avg AS loadAvg, disk_total_io AS diskTotalIO,
             net_rx_bytes AS netRxBytes, net_tx_bytes AS netTxBytes, fs_used_percent AS fsUsedPercent
      FROM snapshots
      WHERE timestamp > ?
      ORDER BY timestamp ASC
      LIMIT 240
    `);
    return stmt.all(cutoff) as any[];
  }

  // ─── Process-centric queries (T3) ───

  getProcessHistory(name: string, sinceTimestamp: number): any[] {
    const stmt = this.db.prepare(`
      SELECT ps.*, s.timestamp
      FROM process_samples ps
      JOIN snapshots s ON ps.snapshot_id = s.id
      WHERE ps.name LIKE ? AND s.timestamp > ?
      ORDER BY s.timestamp ASC
      LIMIT 1000
    `);
    return (stmt.all(`%${name}%`, sinceTimestamp) as any[]).map(row => ({
      ...row,
      cmdline: safeExecutableName(String(row.executable || row.name || row.cmdline || 'unknown')),
    }));
  }

  getProcessStats(name: string, sinceTimestamp: number): { avgCpu: number; peakCpu: number; avgMem: number; peakMem: number; samples: number } | null {
    const stmt = this.db.prepare(`
      SELECT
        AVG(ps.cpu_percent) as avg_cpu,
        MAX(ps.cpu_percent) as peak_cpu,
        AVG(ps.memory_percent) as avg_mem,
        MAX(ps.memory_percent) as peak_mem,
        COUNT(*) as samples
      FROM process_samples ps
      JOIN snapshots s ON ps.snapshot_id = s.id
      WHERE ps.name LIKE ? AND s.timestamp > ?
    `);
    return stmt.get(`%${name}%`, sinceTimestamp) as any || null;
  }

  getTopProcesses(metric: 'cpu' | 'mem', limit: number, sinceTimestamp: number): any[] {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 10, 1), 100);
    const avgCol = metric === 'cpu' ? 'AVG(cpu_percent)' : 'AVG(memory_percent)';
    const peakCol = metric === 'cpu' ? 'MAX(cpu_percent)' : 'MAX(memory_percent)';

    const stmt = this.db.prepare(`
      SELECT
        name,
        ${avgCol} as avg_${metric},
        ${peakCol} as peak_${metric},
        COUNT(*) as samples,
        GROUP_CONCAT(cpu_percent) as cpu_values
      FROM process_samples ps
      JOIN snapshots s ON ps.snapshot_id = s.id
      WHERE s.timestamp > ?
      GROUP BY name
      ORDER BY avg_${metric} DESC
      LIMIT ?
    `);
    const rows = stmt.all(sinceTimestamp, safeLimit) as any[];
    return rows.map(r => ({
      ...r,
      values: r.cpu_values ? r.cpu_values.split(',').map(Number) : [],
    }));
  }

  // ─── Process Spike Methods ───

  insertProcessSpike(spike: ProcessSpike): void {
    const stmt = this.db.prepare(`
      INSERT INTO process_spikes (id, timestamp, process_name, pid, metric_type, value, baseline, threshold, snapshot_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      spike.id,
      spike.timestamp,
      spike.processName,
      spike.pid,
      spike.metricType,
      spike.value,
      spike.baseline,
      spike.threshold,
      spike.snapshotId
    );
  }

  getRecentSpikes(processName?: string, minutes: number = 60): any[] {
    const cutoff = Date.now() - minutes * 60000;
    let sql = 'SELECT * FROM process_spikes WHERE timestamp > ?';
    const params: any[] = [cutoff];
    if (processName) {
      sql += ' AND process_name LIKE ?';
      params.push(`%${processName}%`);
    }
    sql += ' ORDER BY timestamp DESC';
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as any[];
  }

  getSpikeStats(sinceTimestamp: number): any[] {
    const stmt = this.db.prepare(`
      SELECT
        process_name,
        metric_type,
        COUNT(*) as spike_count,
        AVG(value) as avg_value,
        MAX(value) as peak_value,
        AVG(threshold) as avg_threshold
      FROM process_spikes
      WHERE timestamp > ?
      GROUP BY process_name, metric_type
      ORDER BY spike_count DESC
    `);
    return stmt.all(sinceTimestamp) as any[];
  }

  // ─── Battery Impact Methods ───

  insertBatteryImpactEvent(event: BatteryImpactEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO battery_impact_events (id, start_time, end_time, duration_minutes, battery_drop_percent, process_impacts_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.id,
      event.startTime,
      event.endTime,
      event.durationMinutes,
      event.batteryDropPercent,
      JSON.stringify(event.processImpacts)
    );

    // Also update accumulated impact scores
    const updateStmt = this.db.prepare(`
      INSERT INTO battery_impact (process_name, total_impact_score, drain_time_minutes, samples_during_drain, avg_cpu_during_drain, last_seen_timestamp, first_seen_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(process_name) DO UPDATE SET
        total_impact_score = total_impact_score + excluded.total_impact_score,
        drain_time_minutes = drain_time_minutes + excluded.drain_time_minutes,
        samples_during_drain = samples_during_drain + excluded.samples_during_drain,
        avg_cpu_during_drain = (avg_cpu_during_drain * samples_during_drain + excluded.avg_cpu_during_drain * excluded.samples_during_drain) / (samples_during_drain + excluded.samples_during_drain),
        last_seen_timestamp = excluded.last_seen_timestamp
    `);

    for (const proc of event.processImpacts) {
      updateStmt.run(
        proc.processName,
        proc.impactScore,
        event.durationMinutes,
        proc.samples,
        proc.avgCpuPercent,
        event.endTime,
        event.startTime
      );
    }
  }

  getBatteryImpactRankings(limit: number = 20): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM battery_impact
      ORDER BY total_impact_score DESC
      LIMIT ?
    `);
    return stmt.all(limit) as any[];
  }

  getBatteryImpactEvents(sinceTimestamp?: number): any[] {
    let sql = 'SELECT * FROM battery_impact_events';
    const params: any[] = [];
    if (sinceTimestamp) {
      sql += ' WHERE start_time > ?';
      params.push(sinceTimestamp);
    }
    sql += ' ORDER BY start_time DESC';
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as any[];
  }

  getBatteryImpactForProcess(processName: string): any {
    const stmt = this.db.prepare('SELECT * FROM battery_impact WHERE process_name = ?');
    return stmt.get(processName) as any || null;
  }

  // ─── Sleep/Wake Event Methods ───

  insertSleepWakeEvent(event: { eventType: 'sleep' | 'wake'; timestamp: number; batteryPercent: number; isCharging: boolean }): void {
    const stmt = this.db.prepare(`
      INSERT INTO sleep_wake_events (event_type, timestamp, battery_percent, is_charging)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      event.eventType,
      event.timestamp,
      event.batteryPercent,
      event.isCharging ? 1 : 0
    );
  }

  getSleepWakeEvents(since?: number, until?: number): any[] {
    let sql = 'SELECT * FROM sleep_wake_events WHERE 1=1';
    const params: any[] = [];
    if (since) {
      sql += ' AND timestamp >= ?';
      params.push(since);
    }
    if (until) {
      sql += ' AND timestamp <= ?';
      params.push(until);
    }
    sql += ' ORDER BY timestamp DESC';
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as any[];
  }

  getRecentSleepWakeEvents(days: number = 7): any[] {
    const since = Date.now() - days * 86400000;
    return this.getSleepWakeEvents(since);
  }

  // ─── Monitoring Profiles ───

  getProfiles(): any[] {
    const stmt = this.db.prepare('SELECT * FROM monitoring_profiles ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      processes: JSON.parse(r.processes_json),
      createdAt: r.created_at,
    }));
  }

  saveProfile(profile: { id: string; name: string; color?: string; processes: any[] }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO monitoring_profiles (id, name, color, processes_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      profile.id,
      profile.name,
      profile.color || '#3b82f6',
      JSON.stringify(profile.processes),
      Date.now()
    );
  }

  deleteProfile(id: string): void {
    const stmt = this.db.prepare('DELETE FROM monitoring_profiles WHERE id = ?');
    stmt.run(id);
  }

  // ─── Date-Range Queries (for ReportGenerator) ───

  getSnapshotsForDateRange(start: number, end: number): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots
      WHERE timestamp >= ? AND timestamp < ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(start, end) as any[];
  }

  getDrainEventsForDateRange(start: number, end: number): DrainEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM drain_events
      WHERE start_time >= ? AND start_time < ?
      ORDER BY start_time DESC
    `);
    const rows = stmt.all(start, end) as any[];
    return rows.map(r => ({
      ...r,
      wasCharging: !!r.was_charging,
      topProcesses: JSON.parse(r.top_processes_json),
    }));
  }

  getProcessSamplesForSnapshotIds(snapshotIds: number[]): any[] {
    if (snapshotIds.length === 0) return [];
    const placeholders = snapshotIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT s.timestamp, ps.pid, ps.name, ps.cpu_percent, ps.memory_percent, ps.rss_mb, ps.energy_mj
      FROM process_samples ps
      JOIN snapshots s ON ps.snapshot_id = s.id
      WHERE s.id IN (${placeholders})
      ORDER BY s.timestamp ASC, ps.cpu_percent DESC
    `);
    return stmt.all(...snapshotIds);
  }

  getTopProcessesForDateRange(start: number, end: number, metric: 'cpu' | 'mem', limit: number): any[] {
    const avgCol = metric === 'cpu' ? 'AVG(cpu_percent)' : 'AVG(memory_percent)';
    const peakCol = metric === 'cpu' ? 'MAX(cpu_percent)' : 'MAX(memory_percent)';

    const stmt = this.db.prepare(`
      SELECT
        name,
        ${avgCol} as avg_${metric},
        ${peakCol} as peak_${metric},
        COUNT(*) as samples,
        GROUP_CONCAT(cpu_percent) as cpu_values
      FROM process_samples ps
      JOIN snapshots s ON ps.snapshot_id = s.id
      WHERE s.timestamp >= ? AND s.timestamp < ?
      GROUP BY name
      ORDER BY avg_${metric} DESC
      LIMIT ?
    `);
    const rows = stmt.all(start, end, limit) as any[];
    return rows.map(r => ({
      ...r,
      values: r.cpu_values ? r.cpu_values.split(',').map(Number) : [],
    }));
  }

  getBatteryImpactEventsForDateRange(start: number, end: number): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM battery_impact_events
      WHERE start_time >= ? AND start_time < ?
      ORDER BY start_time DESC
    `);
    return stmt.all(start, end) as any[];
  }

  close(): void {
    this.db.close();
  }
}
