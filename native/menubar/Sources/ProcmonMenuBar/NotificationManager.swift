import Foundation
import AppKit
import UserNotifications

class NotificationManager: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    
    @Published var isAuthorized = false
    
    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }
    
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                self.isAuthorized = granted
                if let error = error {
                    print("[NotificationManager] Authorization error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    func checkAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.isAuthorized = settings.authorizationStatus == .authorized
            }
        }
    }
    
    // MARK: - Battery Drain Alert
    
    func sendBatteryDrainAlert(startPercent: Double, endPercent: Double, duration: Double, drainRate: Double) {
        guard isAuthorized else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "Battery Drain Detected"
        content.body = String(format: "Battery dropped from %.0f%% to %.0f%% over %.0f min (%.1f%%/min)", startPercent, endPercent, duration, drainRate)
        content.sound = .default
        content.categoryIdentifier = "BATTERY_DRAIN"
        content.userInfo = ["url": "http://localhost:8080"]
        
        let request = UNNotificationRequest(
            identifier: "battery-drain-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[NotificationManager] Failed to send notification: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Low Battery Alert
    
    func sendLowBatteryAlert(percent: Double) {
        guard isAuthorized else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "Low Battery"
        content.body = String(format: "Battery at %.0f%% - consider plugging in", percent)
        content.sound = .default
        content.categoryIdentifier = "LOW_BATTERY"
        content.userInfo = ["url": "http://localhost:8080"]
        
        let request = UNNotificationRequest(
            identifier: "low-battery-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[NotificationManager] Failed to send notification: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Setup Categories
    
    func setupNotificationCategories() {
        let openAction = UNNotificationAction(
            identifier: "OPEN_DASHBOARD",
            title: "Open Dashboard",
            options: .foreground
        )
        
        let dismissAction = UNNotificationAction(
            identifier: "DISMISS",
            title: "Dismiss",
            options: .destructive
        )
        
        let drainCategory = UNNotificationCategory(
            identifier: "BATTERY_DRAIN",
            actions: [openAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )
        
        let lowBatteryCategory = UNNotificationCategory(
            identifier: "LOW_BATTERY",
            actions: [openAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([drainCategory, lowBatteryCategory])
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        switch response.actionIdentifier {
        case "OPEN_DASHBOARD", UNNotificationDefaultActionIdentifier:
            if let url = response.notification.request.content.userInfo["url"] as? String {
                NSWorkspace.shared.open(URL(string: url)!)
            }
        default:
            break
        }
        completionHandler()
    }
}
