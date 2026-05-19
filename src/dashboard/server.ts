import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TimeSeriesDB } from '../storage/TimeSeriesDB.js';

/**
 * Lightweight HTTP dashboard server.
 * Serves static files from public/ and JSON API endpoints.
 * Uses native Node.js http — no Express dependency.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export interface DashboardConfig {
  port: number;
  dbPath: string;
}

export class DashboardServer {
  private server: http.Server | null = null;
  private db: TimeSeriesDB;
  private config: DashboardConfig;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      port: config.port ?? 3456,
      dbPath: config.dbPath ?? '~/.procmon/monitor.db',
    };
    this.db = new TimeSeriesDB(this.config.dbPath);
  }

  start(): void {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.config.port, () => {
      console.log(`🌐 Dashboard running at http://localhost:${this.config.port}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.db.close();
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.config.port}`);
    const pathname = url.pathname;

    // API routes
    if (pathname.startsWith('/api/')) {
      this.handleApi(req, res, pathname, url.searchParams);
      return;
    }

    // Static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(PUBLIC_DIR, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      res.end(data);
    });
  }

  private handleApi(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    params: URLSearchParams
  ): void {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      if (pathname === '/api/snapshots') {
        const minutes = parseInt(params.get('minutes') ?? '60', 10);
        const rows = this.db.getRecentSnapshotsRaw(minutes);
        res.writeHead(200).end(JSON.stringify(rows));
        return;
      }

      if (pathname === '/api/processes') {
        const limit = parseInt(params.get('limit') ?? '20', 10);
        const rows = this.db.getLatestProcesses(limit);
        res.writeHead(200).end(JSON.stringify(rows));
        return;
      }

      if (pathname === '/api/drain-events') {
        const events = this.db.getDrainEvents();
        res.writeHead(200).end(JSON.stringify(events));
        return;
      }

      if (pathname === '/api/stats') {
        const stats = this.db.getStats();
        res.writeHead(200).end(JSON.stringify(stats));
        return;
      }

      res.writeHead(404).end(JSON.stringify({ error: 'Unknown endpoint' }));
    } catch (err) {
      console.error('API error:', err);
      res.writeHead(500).end(JSON.stringify({ error: String(err) }));
    }
  }
}
