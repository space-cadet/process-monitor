# ProcmonMenuBar

A native macOS menu bar app that monitors your system battery and processes by reading from the `process-monitor` SQLite database.

## Features

- **Live battery indicator** in the macOS menu bar with color-coded levels (green >50%, yellow 20-50%, red <20%)
- **Charging status** shown with a bolt icon overlay
- **Top 5 CPU processes** from the latest snapshot
- **Recent battery drain events** (last 24 hours)
- **Notification alerts** for battery drain and low battery
- **Open Dashboard** button to launch `http://localhost:8080`
- **Auto-refresh** every 30 seconds

## Requirements

- macOS 13.0+ (Ventura)
- Swift 5.9+
- Xcode 15+ (or Swift Package Manager)

## Build

### Using Swift Package Manager (Command Line)

```bash
cd ~/.openclaw/workspace/code/process-monitor/native/menubar
swift build
```

### Run

```bash
swift run ProcmonMenuBar
```

### Using Xcode

1. Open `Package.swift` in Xcode (File → Open → Select `Package.swift`)
2. Wait for package resolution
3. Select the `ProcmonMenuBar` scheme
4. Build and run (Cmd+R)

### Build Release Binary

```bash
swift build -c release
# Binary will be at:
# .build/release/ProcmonMenuBar
```

You can copy it to `/Applications` or `~/Applications`:

```bash
cp -R .build/release/ProcmonMenuBar /Applications/ProcmonMenuBar.app
```

> Note: Since this is a command-line tool using `@main`, it produces a plain binary. To bundle as a `.app`, you can wrap it or use Xcode's Product → Archive.

## Configuration

### Database Path

By default, the app reads from:

```
~/.procmon/monitor.db
```

To use a custom path, set the environment variable before launching:

```bash
PROCMON_DB_PATH=/path/to/your/monitor.db swift run ProcmonMenuBar
```

Or in Xcode: **Product → Scheme → Edit Scheme → Arguments → Environment Variables**.

## Notifications

The app requests notification permission on first launch. It sends:

- **Battery drain alerts** when a drain event is detected
- **Low battery alerts** when battery drops below 20%

Notification actions include:
- **Open Dashboard** — opens the web dashboard at `http://localhost:8080`
- **Dismiss** — closes the notification

## Architecture

| File | Purpose |
|------|---------|
| `ProcmonMenuBar.swift` | App entry point, `NSStatusBar` setup, `NSPopover`, timer |
| `ContentView.swift` | SwiftUI dropdown menu UI |
| `DBReader.swift` | SQLite database reader using `SQLite.swift` |
| `NotificationManager.swift` | `UNUserNotificationCenter` wrapper |
| `Package.swift` | Swift Package Manager manifest |

## Troubleshooting

### "Failed to connect to database"

- Ensure the `process-monitor` daemon is running and writing to `~/.procmon/monitor.db`
- Check file permissions: `ls -la ~/.procmon/monitor.db`
- Try setting `PROCMON_DB_PATH` explicitly

### App doesn't appear in menu bar

- The app uses `.accessory` activation policy (no dock icon). Check your menu bar — it may be hidden by the macOS menu bar overflow.
- Look for the battery icon in the menu bar. If you have many menu bar icons, it might be in the overflow menu.

### Notifications not showing

- Go to **System Settings → Notifications → ProcmonMenuBar** and enable notifications
- Ensure "Do Not Disturb" or "Focus" mode is not active

## License

Same as the parent `process-monitor` project.
