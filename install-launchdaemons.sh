#!/bin/bash
# Install corrected LaunchDaemons for process-monitor
# Run with: sudo bash install-launchdaemons.sh

set -e

echo "Installing process-monitor LaunchDaemons..."

# Stop old services if running
launchctl bootout system/ai.openclaw.procmon.monitor 2>/dev/null || true
launchctl bootout system/ai.openclaw.procmon.dashboard 2>/dev/null || true

# Remove old plist files
rm -f /Library/LaunchDaemons/ai.openclaw.procmon.monitor.plist
rm -f /Library/LaunchDaemons/ai.openclaw.procmon.dashboard.plist

# Copy new plist files
cp "$(dirname "$0")/ai.openclaw.procmon.monitor.plist" /Library/LaunchDaemons/
cp "$(dirname "$0")/ai.openclaw.procmon.dashboard.plist" /Library/LaunchDaemons/

# Set permissions
chown root:wheel /Library/LaunchDaemons/ai.openclaw.procmon.monitor.plist
chown root:wheel /Library/LaunchDaemons/ai.openclaw.procmon.dashboard.plist
chmod 644 /Library/LaunchDaemons/ai.openclaw.procmon.monitor.plist
chmod 644 /Library/LaunchDaemons/ai.openclaw.procmon.dashboard.plist

# Load and start
launchctl bootstrap system /Library/LaunchDaemons/ai.openclaw.procmon.monitor.plist
launchctl bootstrap system /Library/LaunchDaemons/ai.openclaw.procmon.dashboard.plist

echo "Done! Checking status..."
sleep 2
launchctl print system/ai.openclaw.procmon.monitor | head -5
launchctl print system/ai.openclaw.procmon.dashboard | head -5
