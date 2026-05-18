import { SystemCollector } from './core/SystemCollector.js';

async function showData() {
  const c = new SystemCollector();
  const s = await c.getSystemSnapshot();
  
  console.log('=== SYSTEM SNAPSHOT ===');
  console.log('Time:', new Date(s.timestamp).toLocaleString());
  console.log('Battery:', s.battery.percent + '%', s.battery.isCharging ? '(charging)' : '(on battery)');
  console.log('Time remaining:', s.battery.timeRemaining, 'min');
  console.log('Cycle count:', s.battery.cycleCount);
  console.log('CPU total:', s.cpuTotal.toFixed(1) + '%');
  console.log('Memory total:', s.memoryTotal.toFixed(1) + '%');
  console.log();
  console.log('=== TOP 10 PROCESSES BY CPU ===');
  for (const p of s.processes.slice(0, 10)) {
    console.log(`${p.name.padEnd(20)} PID:${p.pid.toString().padStart(6)}  CPU:${p.cpuPercent.toFixed(1).padStart(6)}%  MEM:${p.memoryPercent.toFixed(1).padStart(5)}%  RSS:${p.rssMB.toFixed(0).padStart(4)}MB`);
  }
}

showData().catch(console.error);
