import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const ROOT = process.cwd();

let server: ChildProcess | null = null;

/**
 * Start the dashboard server as a child process for testing.
 */
function startServer(port: number = 3456, dbPath?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['src/dashboard.ts', String(port)];
    if (dbPath) args.push(dbPath);

    server = spawn('npx', ['tsx', ...args], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: false,
    });

    let output = '';
    server.stdout?.on('data', (data) => {
      output += data.toString();
      if (output.includes(`http://localhost:${port}`)) {
        resolve();
      }
    });

    server.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    server.on('error', reject);

    setTimeout(() => {
      if (!output.includes(`http://localhost:${port}`)) {
        reject(new Error('Dashboard server failed to start within 10s'));
      }
    }, 10000);
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.on('close', resolve);
    server.kill('SIGTERM');
    setTimeout(() => {
      server?.kill('SIGKILL');
      resolve();
    }, 3000);
  });
}

test.describe('Dashboard', () => {
  test.beforeAll(async () => {
    await startServer(3456);
  });

  test.afterAll(async () => {
    await stopServer();
  });

  test('page loads with title and stats bar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Process Monitor/);
    await expect(page.locator('#stats-bar')).toBeVisible();
    await expect(page.locator('#db-snapshots')).toBeVisible();
    await expect(page.locator('#db-events')).toBeVisible();
    await expect(page.locator('#last-update')).toBeVisible();
  });

  test('charts render within 5 seconds', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    const charts = ['cpu-chart', 'battery-chart', 'extras-chart', 'io-chart'];
    for (const id of charts) {
      const canvas = page.locator(`#${id}`);
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      expect(box?.width).toBeGreaterThan(100);
      expect(box?.height).toBeGreaterThan(50);
    }
  });

  test('process table renders with rows', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    const table = page.locator('#process-table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('drain events section renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    await expect(page.locator('#drain-table')).toBeVisible();

    const noDrains = page.locator('#no-drains');
    const drainRows = page.locator('#drain-table tbody tr');

    const noDrainsVisible = await noDrains.isVisible().catch(() => false);
    const rowCount = await drainRows.count();

    expect(noDrainsVisible || rowCount > 0).toBe(true);
  });

  test('screenshot captures full dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const screenshotPath = path.join(ROOT, 'dashboard-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const fs = await import('fs');
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });
});
