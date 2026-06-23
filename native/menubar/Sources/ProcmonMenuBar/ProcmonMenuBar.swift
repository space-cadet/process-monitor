import SwiftUI
import AppKit

@main
struct ProcmonMenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, NSPopoverDelegate {
    var statusItem: NSStatusItem!
    var popover: NSPopover!
    var timer: Timer?
    var eventMonitor: Any?
    
    private let dbReader = DBReader.shared
    private let notificationManager = NotificationManager.shared
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide from dock
        NSApp.setActivationPolicy(.accessory)
        
        // Setup popover
        popover = NSPopover()
        popover.contentSize = NSSize(width: 320, height: 400)
        popover.behavior = .transient
        popover.delegate = self
        popover.contentViewController = NSHostingController(rootView: ContentView())
        
        // Setup status bar item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = createBatteryIcon(percent: 0, color: .systemGray)
            button.image?.size = NSSize(width: 18, height: 18)
            button.image?.isTemplate = true
            button.action = #selector(togglePopover(_:))
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
        
        // Initial data load
        dbReader.refresh()
        updateStatusIcon()
        
        // Setup timer for polling every 30 seconds
        timer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            self.dbReader.refresh()
            self.updateStatusIcon()
        }
        
        // Event monitor to close popover when clicking outside
        eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { event in
            if self.popover.isShown {
                self.popover.performClose(nil)
            }
        }
        
        // Notification auth check
        notificationManager.checkAuthorizationStatus()
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        timer?.invalidate()
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
        }
    }
    
    // MARK: - Popover Toggle
    
    @objc func togglePopover(_ sender: AnyObject?) {
        guard let button = statusItem.button else { return }
        
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            // Refresh data when opening
            dbReader.refresh()
            updateStatusIcon()
        }
    }
    
    // MARK: - Status Icon Update
    
    func updateStatusIcon() {
        guard let button = statusItem.button else { return }
        
        let percent = dbReader.latestSnapshot?.batteryPercent ?? 0
        let isCharging = dbReader.latestSnapshot?.isCharging ?? false
        let color = batteryColor(for: percent)
        
        let icon = createBatteryIcon(percent: percent, color: color, isCharging: isCharging)
        button.image = icon
        button.image?.size = NSSize(width: 18, height: 18)
        button.image?.isTemplate = false
    }
    
    private func batteryColor(for percent: Double) -> NSColor {
        if percent > 50 { return .systemGreen }
        if percent >= 20 { return .systemYellow }
        return .systemRed
    }
    
    // MARK: - Battery Icon Generator
    
    func createBatteryIcon(percent: Double, color: NSColor, isCharging: Bool = false) -> NSImage {
        let size = NSSize(width: 22, height: 14)
        let image = NSImage(size: size)
        
        image.lockFocus()
        
        let ctx = NSGraphicsContext.current!.cgContext
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(1.5)
        
        // Battery body
        let bodyRect = CGRect(x: 1, y: 2, width: 17, height: 10)
        let bodyPath = CGPath(roundedRect: bodyRect, cornerWidth: 1.5, cornerHeight: 1.5, transform: nil)
        ctx.addPath(bodyPath)
        ctx.strokePath()
        
        // Battery fill
        let fillWidth = max(2, 14 * CGFloat(percent) / 100)
        let fillRect = CGRect(x: 2.5, y: 3.5, width: fillWidth, height: 7)
        let fillPath = CGPath(roundedRect: fillRect, cornerWidth: 1, cornerHeight: 1, transform: nil)
        ctx.addPath(fillPath)
        ctx.setFillColor(color.cgColor)
        ctx.fillPath()
        
        // Battery nub
        let nubRect = CGRect(x: 19, y: 5, width: 2, height: 4)
        ctx.fill(nubRect)
        
        // Charging bolt
        if isCharging {
            ctx.setFillColor(NSColor.white.cgColor)
            let boltPath = CGMutablePath()
            boltPath.move(to: CGPoint(x: 10, y: 2))
            boltPath.addLine(to: CGPoint(x: 7, y: 6))
            boltPath.addLine(to: CGPoint(x: 10, y: 6))
            boltPath.addLine(to: CGPoint(x: 9, y: 10))
            boltPath.addLine(to: CGPoint(x: 12, y: 6))
            boltPath.addLine(to: CGPoint(x: 9, y: 6))
            boltPath.closeSubpath()
            ctx.addPath(boltPath)
            ctx.fillPath()
        }
        
        image.unlockFocus()
        return image
    }
    
    // MARK: - NSPopoverDelegate
    
    func popoverDidClose(_ notification: Notification) {
        // Optional: handle close if needed
    }
}
