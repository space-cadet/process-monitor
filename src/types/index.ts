// Battery sample - single point-in-time measurement
export interface BatterySample {
  timestamp: number;        // Unix epoch ms
  percent: number;          // 0-100
  isCharging: boolean;
  isPlugged: boolean;
  timeRemaining: number | null;  // minutes (null if charging)
  cycleCount: number | null;
  temperature: number | null;    // °C if available
}

// Process snapshot - CPU/memory for one process
export interface ProcessSnapshot {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryPercent: number;
  rssMB: number;
  vmsMB: number;
  cmdline: string;
}

// System snapshot - everything at one timestamp
export interface SystemSnapshot {
  timestamp: number;
  battery: BatterySample;
  processes: ProcessSnapshot[];
  cpuTotal: number;       // aggregate CPU %
  memoryTotal: number;    // aggregate memory %
}

// Drain event - detected rapid battery drop
export interface DrainEvent {
  id: string;             // UUID
  startTime: number;
  endTime: number;
  startPercent: number;
  endPercent: number;
  drainRate: number;      // % per minute
  durationMinutes: number;
  topProcesses: ProcessSnapshot[];  // highest CPU during event
  wasCharging: boolean;
}

// Alert configuration
export interface AlertConfig {
  enabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  drainThreshold: number;     // % per minute to trigger alert
  minDuration: number;        // minutes of drain before alerting
  cooldownMinutes: number;    // minutes between alerts
}

// Monitor configuration
export interface MonitorConfig {
  sampleIntervalSeconds: number;   // how often to sample (default: 30)
  dbPath: string;
  retentionDays: number;
  alert: AlertConfig;
}