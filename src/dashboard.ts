import { DashboardServer } from './dashboard/server.js';

/**
 * Standalone dashboard entry point.
 * Usage: npx tsx src/dashboard.ts [port] [dbPath]
 */

const port = parseInt(process.argv[2] ?? '3456', 10);
const dbPath = process.argv[3] ?? '~/.procmon/monitor.db';

const server = new DashboardServer({ port, dbPath });
server.start();

process.on('SIGINT', () => {
  console.log('\nShutting down dashboard...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.stop();
  process.exit(0);
});
