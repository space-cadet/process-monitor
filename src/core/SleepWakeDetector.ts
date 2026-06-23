import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemSnapshot } from '../types/index.js';

const execAsync = promisify(exec);

export interface SleepWakeEvent {
  eventType: 'sleep' | 'wake';
  timestamp: number;
  batteryPercent: number;
  isCharging: boolean;
}

export interface SleepWakeDetectorOptions {
  pollIntervalMs?: number;
  onEvent?: (event: SleepWakeEvent) => void;
  onBatteryChange?: (snapshot: SystemSnapshot) => void;
}

/**
 * Detects macOS sleep/wake events via pmset and ioreg polling.
 * 
 * On macOS, we poll the power state every 5 seconds using `ioreg` to detect
 * transitions between awake → sleep and sleep → awake.
 * 
 * When a transition is detected, we capture the current battery level and
 * emit a SleepWakeEvent.
 * 
 * Limitations:
 * - macOS only (uses ioreg/pmset)
 * - Polling-based, not event-driven (avoids native IOKit module)
 * - May miss very brief sleeps (<5s)
 */
export class SleepWakeDetector {
  private options: SleepWakeDetectorOptions;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastPowerState: 'awake' | 'sleep' | null = null;
  private lastBatterySnapshot: { percent: number; isCharging: boolean } | null = null;
  private pollIntervalMs: number;

  constructor(options: SleepWakeDetectorOptions = {}) {
    this.options = options;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[SleepWakeDetector] Starting — polling every', this.pollIntervalMs, 'ms');
    
    // Initial check to establish baseline
    this.checkPowerState().catch(err =>
      console.error('[SleepWakeDetector] Initial check failed:', err)
    );

    this.timer = setInterval(() => {
      this.checkPowerState().catch(err =>
        console.error('[SleepWakeDetector] Poll error:', err)
      );
    }, this.pollIntervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[SleepWakeDetector] Stopped');
  }

  private async checkPowerState(): Promise<void> {
    try {
      // Use ioreg to check if system is sleeping
      // IOPowerManagement::CurrentPowerState = 2 (awake), 0 (sleep)
      const { stdout } = await execAsync(
        'ioreg -n IORoot | grep -E "CurrentPowerState|SleepTimer" || true'
      );

      const isSleeping = this.parseSleepState(stdout);
      const currentState: 'awake' | 'sleep' = isSleeping ? 'sleep' : 'awake';

      // Get current battery info
      const batteryInfo = await this.getBatteryInfo();
      this.lastBatterySnapshot = batteryInfo;

      // Detect transitions
      if (this.lastPowerState !== null && this.lastPowerState !== currentState) {
        const eventType = currentState === 'sleep' ? 'sleep' : 'wake';
        const event: SleepWakeEvent = {
          eventType,
          timestamp: Date.now(),
          batteryPercent: batteryInfo.percent,
          isCharging: batteryInfo.isCharging,
        };

        console.log(`[SleepWakeDetector] ${eventType.toUpperCase()} detected at ${new Date().toISOString()} (battery: ${batteryInfo.percent}%)`);

        if (this.options.onEvent) {
          this.options.onEvent(event);
        }
      }

      this.lastPowerState = currentState;

      // Also notify on battery changes (optional)
      if (this.options.onBatteryChange && batteryInfo.snapshot) {
        this.options.onBatteryChange(batteryInfo.snapshot);
      }
    } catch (err) {
      console.error('[SleepWakeDetector] checkPowerState error:', err);
    }
  }

  private parseSleepState(ioregOutput: string): boolean {
    // Check for sleep indicators in ioreg output
    // On macOS, sleep state can be detected via:
    // 1. CurrentPowerState = 0 (sleeping) vs 2 (awake)
    // 2. Presence of "SleepTimer" or sleep-related assertions
    
    if (ioregOutput.includes('CurrentPowerState = 0')) {
      return true; // sleeping
    }
    if (ioregOutput.includes('CurrentPowerState = 2')) {
      return false; // awake
    }
    
    // Fallback: if we can't determine, assume awake (safer)
    return false;
  }

  private async getBatteryInfo(): Promise<{ percent: number; isCharging: boolean; snapshot?: SystemSnapshot }> {
    try {
      // Use pmset to get battery info quickly
      const { stdout } = await execAsync('pmset -g batt');
      
      // Parse: "Now drawing from 'Battery Power' -InternalBattery-0 87%; discharging at 12.50 W"
      // or: "Now drawing from 'AC Power' -InternalBattery-0 100%; charging; 0:00 remaining"
      const percentMatch = stdout.match(/(\d+)%/);
      const percent = percentMatch ? parseInt(percentMatch[1], 10) : 0;
      
      const isCharging = stdout.includes('AC Power') || stdout.includes('charging');
      
      return { percent, isCharging };
    } catch (err) {
      console.error('[SleepWakeDetector] getBatteryInfo error:', err);
      return { percent: 0, isCharging: false };
    }
  }

  getLastState(): 'awake' | 'sleep' | null {
    return this.lastPowerState;
  }

  getLastBatterySnapshot(): { percent: number; isCharging: boolean } | null {
    return this.lastBatterySnapshot;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
