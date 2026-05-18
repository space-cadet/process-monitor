import si from 'systeminformation';

async function test() {
  console.log('[Test] Collecting battery...');
  const battery = await si.battery();
  console.log('[Test] Battery:', JSON.stringify(battery, null, 2));

  console.log('[Test] Collecting processes...');
  const procs = await si.processes();
  console.log('[Test] Process count:', procs.list.length);
  console.log('[Test] Top 3 by CPU:', procs.list.slice(0, 3).map(p => ({ name: p.name, cpu: p.cpu })));

  console.log('[Test] Collecting memory...');
  const mem = await si.mem();
  console.log('[Test] Memory used:', (mem.used / 1024 / 1024).toFixed(0), 'MB /', (mem.total / 1024 / 1024).toFixed(0), 'MB');

  console.log('[Test] All checks passed!');
}

test().catch(err => {
  console.error('[Test] Error:', err);
  process.exit(1);
});
