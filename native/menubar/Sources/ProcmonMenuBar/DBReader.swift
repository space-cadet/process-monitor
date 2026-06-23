import Foundation
import SQLite

// MARK: - Data Models

struct Snapshot: Identifiable, Equatable {
    let id: Int64
    let timestamp: Date
    let batteryPercent: Double
    let isCharging: Bool
    let cpuTotal: Double?
    let memoryTotal: Double?
    let memoryUsedMB: Double?
    let loadAvg: Double?
    
    var batteryColor: String {
        if batteryPercent > 50 { return "green" }
        if batteryPercent >= 20 { return "yellow" }
        return "red"
    }
}

struct ProcessInfo: Identifiable, Equatable {
    let id = UUID()
    let pid: Int64
    let name: String
    let cpuPercent: Double
    let memoryPercent: Double
    let rssMB: Double
    let cmdline: String?
}

struct DrainEvent: Identifiable, Equatable {
    let id: String
    let startTime: Date
    let endTime: Date
    let startPercent: Double
    let endPercent: Double
    let drainRate: Double
    let durationMinutes: Double
    let wasCharging: Bool
    let topProcessesJSON: String
    
    var batteryDrop: Double {
        startPercent - endPercent
    }
}

// MARK: - Database Reader

class DBReader: ObservableObject {
    static let shared = DBReader()
    
    @Published var latestSnapshot: Snapshot?
    @Published var topProcesses: [ProcessInfo] = []
    @Published var recentDrainEvents: [DrainEvent] = []
    @Published var errorMessage: String?
    
    var dbPath: String {
        let configPath = Foundation.ProcessInfo.processInfo.environment["PROCMON_DB_PATH"]
        return configPath ?? "\(NSHomeDirectory())/.procmon/monitor.db"
    }
    
    private var db: Connection?
    
    init() {
        connect()
    }
    
    func connect() {
        do {
            db = try Connection(dbPath)
            db?.busyTimeout = 5
            errorMessage = nil
            refresh()
        } catch {
            errorMessage = "Failed to connect to database: \(error.localizedDescription)"
            print("[DBReader] Error: \(error)")
        }
    }
    
    func refresh() {
        guard db != nil else {
            connect()
            return
        }
        
        do {
            latestSnapshot = try fetchLatestSnapshot()
            if let snapshot = latestSnapshot {
                topProcesses = try fetchTopProcesses(snapshotId: snapshot.id)
            }
            recentDrainEvents = try fetchRecentDrainEvents()
            errorMessage = nil
        } catch {
            errorMessage = "Failed to read data: \(error.localizedDescription)"
            print("[DBReader] Refresh error: \(error)")
        }
    }
    
    // MARK: - Queries
    
    private func fetchLatestSnapshot() throws -> Snapshot? {
        guard let db = db else { return nil }
        
        let snapshots = Table("snapshots")
        let id = Expression<Int64>("id")
        let timestamp = Expression<Int64>("timestamp")
        let batteryPercent = Expression<Double>("battery_percent")
        let isCharging = Expression<Int64>("is_charging")
        let cpuTotal = Expression<Double?>("cpu_total")
        let memoryTotal = Expression<Double?>("memory_total")
        let memoryUsedMB = Expression<Double?>("memory_used_mb")
        let loadAvg = Expression<Double?>("load_avg")
        
        let query = snapshots.order(timestamp.desc).limit(1)
        
        guard let row = try db.pluck(query) else { return nil }
        
        return Snapshot(
            id: row[id],
            timestamp: Date(timeIntervalSince1970: Double(row[timestamp])),
            batteryPercent: row[batteryPercent],
            isCharging: row[isCharging] == 1,
            cpuTotal: row[cpuTotal],
            memoryTotal: row[memoryTotal],
            memoryUsedMB: row[memoryUsedMB],
            loadAvg: row[loadAvg]
        )
    }
    
    private func fetchTopProcesses(snapshotId: Int64) throws -> [ProcessInfo] {
        guard let db = db else { return [] }
        
        let processSamples = Table("process_samples")
        let snapId = Expression<Int64>("snapshot_id")
        let pid = Expression<Int64>("pid")
        let name = Expression<String>("name")
        let cpuPercent = Expression<Double>("cpu_percent")
        let memoryPercent = Expression<Double>("memory_percent")
        let rssMB = Expression<Double>("rss_mb")
        let cmdline = Expression<String?>("cmdline")
        
        let query = processSamples
            .filter(snapId == snapshotId)
            .order(cpuPercent.desc)
            .limit(5)
        
        return try db.prepare(query).map { row in
            ProcessInfo(
                pid: row[pid],
                name: row[name],
                cpuPercent: row[cpuPercent],
                memoryPercent: row[memoryPercent],
                rssMB: row[rssMB],
                cmdline: row[cmdline]
            )
        }
    }
    
    private func fetchRecentDrainEvents() throws -> [DrainEvent] {
        guard let db = db else { return [] }
        
        let drainEvents = Table("drain_events")
        let id = Expression<String>("id")
        let startTime = Expression<Int64>("start_time")
        let endTime = Expression<Int64>("end_time")
        let startPercent = Expression<Double>("start_percent")
        let endPercent = Expression<Double>("end_percent")
        let drainRate = Expression<Double>("drain_rate")
        let durationMinutes = Expression<Double>("duration_minutes")
        let wasCharging = Expression<Int64>("was_charging")
        let topProcessesJSON = Expression<String>("top_processes_json")
        
        let oneDayAgo = Int64(Date().timeIntervalSince1970) - 86400
        
        let query = drainEvents
            .filter(startTime >= oneDayAgo)
            .order(startTime.desc)
            .limit(10)
        
        return try db.prepare(query).map { row in
            DrainEvent(
                id: row[id],
                startTime: Date(timeIntervalSince1970: Double(row[startTime])),
                endTime: Date(timeIntervalSince1970: Double(row[endTime])),
                startPercent: row[startPercent],
                endPercent: row[endPercent],
                drainRate: row[drainRate],
                durationMinutes: row[durationMinutes],
                wasCharging: row[wasCharging] == 1,
                topProcessesJSON: row[topProcessesJSON]
            )
        }
    }
}
