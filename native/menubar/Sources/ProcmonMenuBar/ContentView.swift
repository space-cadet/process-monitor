import SwiftUI

struct ContentView: View {
    @StateObject private var dbReader = DBReader.shared
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header / Battery Status
            batteryHeader
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 8)
            
            Divider()
                .padding(.horizontal, 8)
            
            // Top CPU Processes
            processesSection
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            
            Divider()
                .padding(.horizontal, 8)
            
            // Recent Drain Events
            drainEventsSection
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            
            Divider()
                .padding(.horizontal, 8)
            
            // Footer Buttons
            footerButtons
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
        }
        .frame(width: 320)
        .onAppear {
            notificationManager.requestAuthorization()
            notificationManager.setupNotificationCategories()
        }
    }
    
    // MARK: - Battery Header
    
    private var batteryHeader: some View {
        HStack(spacing: 12) {
            // Battery Icon
            ZStack {
                RoundedRectangle(cornerRadius: 4)
                    .stroke(batteryColor, lineWidth: 2)
                    .frame(width: 36, height: 20)
                
                RoundedRectangle(cornerRadius: 2)
                    .fill(batteryColor)
                    .frame(width: max(4, 30 * CGFloat(dbReader.latestSnapshot?.batteryPercent ?? 0) / 100), height: 14)
                    .offset(x: -1)
                
                // Battery nub
                RoundedRectangle(cornerRadius: 1)
                    .fill(batteryColor)
                    .frame(width: 3, height: 8)
                    .offset(x: 19)
            }
            .frame(width: 40, height: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: "%.0f%%", dbReader.latestSnapshot?.batteryPercent ?? 0))
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                
                HStack(spacing: 4) {
                    Image(systemName: chargingIcon)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(chargingStatus)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // System stats mini
            VStack(alignment: .trailing, spacing: 2) {
                if let cpu = dbReader.latestSnapshot?.cpuTotal {
                    Text(String(format: "CPU %.1f%%", cpu))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                if let mem = dbReader.latestSnapshot?.memoryUsedMB {
                    Text(String(format: "Mem %.0f MB", mem))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
        }
    }
    
    private var batteryColor: Color {
        guard let snapshot = dbReader.latestSnapshot else { return .gray }
        switch snapshot.batteryColor {
        case "green": return .green
        case "yellow": return .yellow
        case "red": return .red
        default: return .gray
        }
    }
    
    private var chargingIcon: String {
        guard let snapshot = dbReader.latestSnapshot else { return "battery.0" }
        if snapshot.isCharging { return "bolt.fill" }
        return "battery.100"
    }
    
    private var chargingStatus: String {
        guard let snapshot = dbReader.latestSnapshot else { return "Unknown" }
        if snapshot.isCharging { return "Charging" }
        return "On Battery"
    }
    
    // MARK: - Top Processes
    
    private var processesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Top CPU Processes")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if let snapshot = dbReader.latestSnapshot {
                    Text("Updated \(timeAgo(snapshot.timestamp))")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
            }
            
            if dbReader.topProcesses.isEmpty {
                Text("No process data available")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(dbReader.topProcesses) { process in
                    ProcessRow(process: process)
                }
            }
        }
    }
    
    // MARK: - Drain Events
    
    private var drainEventsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent Drain Events (24h)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("\(dbReader.recentDrainEvents.count)")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(8)
            }
            
            if dbReader.recentDrainEvents.isEmpty {
                Text("No drain events in the last 24 hours")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(dbReader.recentDrainEvents.prefix(3)) { event in
                    DrainEventRow(event: event)
                }
            }
        }
    }
    
    // MARK: - Footer Buttons
    
    private var footerButtons: some View {
        HStack(spacing: 8) {
            Button("Open Dashboard") {
                NSWorkspace.shared.open(URL(string: "http://localhost:8080")!)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            
            Button("Settings") {
                NSWorkspace.shared.open(URL(fileURLWithPath: DBReader.shared.dbPath))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            
            Spacer()
            
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.borderless)
            .controlSize(.small)
            .foregroundColor(.secondary)
        }
    }
    
    // MARK: - Helpers
    
    private func timeAgo(_ date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        return "\(Int(interval / 3600))h ago"
    }
}

// MARK: - Process Row

struct ProcessRow: View {
    let process: ProcessInfo
    
    var body: some View {
        HStack(spacing: 8) {
            Text(process.name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
            
            Spacer()
            
            Text(String(format: "%.1f%%", process.cpuPercent))
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(cpuColor)
            
            Text(String(format: "%.0f MB", process.rssMB))
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary)
                .frame(minWidth: 50, alignment: .trailing)
        }
        .padding(.vertical, 2)
        .help(process.cmdline ?? process.name)
    }
    
    private var cpuColor: Color {
        if process.cpuPercent > 50 { return .red }
        if process.cpuPercent > 20 { return .orange }
        return .primary
    }
}

// MARK: - Drain Event Row

struct DrainEventRow: View {
    let event: DrainEvent
    
    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(Int(event.batteryDrop))% drop")
                    .font(.system(size: 11, weight: .semibold))
                
                Text("\(timeString(event.startTime)) · \(Int(event.durationMinutes)) min")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(String(format: "%.1f%%/min", event.drainRate))
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }
    
    private func timeString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Preview

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
