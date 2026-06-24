import { exec } from 'child_process';
import { promisify } from 'util';
import type { DrainEvent, ProcessSpike, BatteryImpactEvent, AlertConfig } from '../types/index.js';

const execAsync = promisify(exec);

/**
 * Sends alerts via Telegram and/or macOS native notifications.
 */
export class AlertSender {
  private config: AlertConfig;
  private lastAlertTime: number = 0;
  private lastSpikeAlertTime: Map<string, number> = new Map();

  constructor(config: AlertConfig) {
    this.config = config;
  }

  /**
   * Send a drain alert.
   */
  async sendDrainAlert(event: DrainEvent): Promise<void> {
    const now = Date.now();
    const cooldownMs = (this.config.cooldownMinutes || 10) * 60 * 1000;
    if (now - this.lastAlertTime < cooldownMs) {
      console.log(`[Alert] Skipped: cooldown active (${((cooldownMs - (now - this.lastAlertTime)) / 1000).toFixed(0)}s remaining)`);
      return;
    }
    this.lastAlertTime = now;

    const message = this.formatDrainMessage(event);
    const title = `⚠️ Rapid Battery Drain`;

    await Promise.all([
      this.sendTelegram(title, message),
      this.sendMacOSNotification(title, this.formatDrainShort(event)),
    ]);
  }

  /**
   * Send a spike alert (throttled per-process).
   */
  async sendSpikeAlert(spike: ProcessSpike): Promise<void> {
    const key = `${spike.processName}-${spike.metricType}`;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000; // 5 min between spike alerts for same process
    const last = this.lastSpikeAlertTime.get(key) || 0;
    if (now - last < cooldownMs) return;
    this.lastSpikeAlertTime.set(key, now);

    const title = `🔥 ${spike.processName} ${spike.metricType.toUpperCase()} Spike`;
    const message = `${spike.processName} (PID ${spike.pid})\n${spike.metricType.toUpperCase()}: ${spike.value.toFixed(1)}% (baseline: ${spike.baseline.toFixed(1)}%)`;

    await Promise.all([
      this.sendTelegram(title, message),
      this.sendMacOSNotification(title, `${spike.metricType.toUpperCase()}: ${spike.value.toFixed(1)}%`),
    ]);
  }

  /**
   * Send battery impact alert.
   */
  async sendBatteryImpactAlert(event: BatteryImpactEvent): Promise<void> {
    const title = `🔋 Battery Impact Period`;
    const top = event.processImpacts.slice(0, 3)
      .map(p => `• ${p.processName}: ${p.impactScore.toFixed(1)} score`)
      .join('\n');
    const message = `Drop: ${event.batteryDropPercent.toFixed(1)}% over ${event.durationMinutes.toFixed(0)} min\n\nTop impacts:\n${top}`;

    await Promise.all([
      this.sendTelegram(title, message),
      this.sendMacOSNotification(title, `${event.batteryDropPercent.toFixed(1)}% drop, ${event.processImpacts.length} processes affected`),
    ]);
  }

  /**
   * Send Telegram message via Bot API.
   */
  private async sendTelegram(title: string, text: string): Promise<void> {
    const token = this.config.telegramBotToken;
    const chatId = this.config.telegramChatId;
    if (!token || !chatId) {
      console.log('[Alert] Telegram not configured (no token/chatId)');
      return;
    }

    const message = `<b>${title}</b>\n\n${text}`;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_notification: false,
        }),
      });
      const data = await res.json() as { ok: boolean; description?: string };
      if (!data.ok) {
        console.error(`[Alert] Telegram error: ${data.description}`);
      } else {
        console.log('[Alert] Telegram message sent');
      }
    } catch (err) {
      console.error('[Alert] Telegram send failed:', (err as Error).message);
    }
  }

  /**
   * Send macOS native notification via osascript.
   */
  private async sendMacOSNotification(title: string, body: string): Promise<void> {
    if (process.platform !== 'darwin') return;

    // Escape quotes for osascript
    const safeTitle = title.replace(/"/g, '\\"');
    const safeBody = body.replace(/"/g, '\\"');
    const script = `display notification "${safeBody}" with title "${safeTitle}" sound name "Funk"`;

    try {
      await execAsync(`osascript -e '${script}'`);
      console.log('[Alert] macOS notification sent');
    } catch (err) {
      console.error('[Alert] macOS notification failed:', (err as Error).message);
    }
  }

  private formatDrainMessage(event: DrainEvent): string {
    const lines = [
      `Battery: ${event.startPercent}% → ${event.endPercent}%`,
      `Rate: ${event.drainRate.toFixed(2)}% per minute`,
      `Duration: ${event.durationMinutes.toFixed(1)} minutes`,
      ``,
      `Top CPU processes during drain:`,
      ...event.topProcesses.map(p => `  • ${p.name} (PID ${p.pid}): ${p.cpuPercent.toFixed(1)}% CPU`),
    ];
    return lines.join('\n');
  }

  private formatDrainShort(event: DrainEvent): string {
    const top = event.topProcesses[0];
    return `${event.startPercent}% → ${event.endPercent}% in ${event.durationMinutes.toFixed(0)} min. Top: ${top?.name || 'unknown'}`;
  }
}
