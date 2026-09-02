import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const ROOT = process.cwd();
const TEST_PORT = Number(process.env.DASHBOARD_TEST_PORT || '3456');

let server: ChildProcess | null = null;

/**
 * Start the dashboard server as a child process for testing.
 */
function startServer(port: number = TEST_PORT): Promise<void> {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['dist/web/server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
      stdio: 'pipe',
      shell: false,
    });

    let output = '';
    server.stdout?.on('data', (data) => {
      output += data.toString();
      if (output.includes(`:${port}`)) {
        resolve();
      }
    });

    server.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    server.on('error', reject);

    setTimeout(() => {
      if (!output.includes(`:${port}`)) {
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
    await startServer(TEST_PORT);
  });

  test.afterAll(async () => {
    await stopServer();
  });

  test('page loads with title and KPI cards', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Process Monitor/);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('.kpi-grid')).toBeVisible();
    await expect(page.locator('#batteryValue')).toBeVisible();
    await expect(page.locator('#cpuValue')).toBeVisible();
    await expect(page.locator('#liveText')).toContainText('Live');
  });

  test('charts render within 5 seconds', async ({ page }) => {
    await page.goto('/');
    const chart = page.locator('#historyChart');
    await expect(chart).toBeVisible();
    const box = await chart.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(50);
  });

  test('process table renders with rows', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    const table = page.locator('#processTable');
    await expect(table).toBeVisible();
    const rows = table.locator('tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('drain events section renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);

    const drainList = page.locator('#drainList');
    await expect(drainList).toBeVisible();
    const noDrains = drainList.getByText('No drain events recorded');
    const drainRows = drainList.locator('.drain-item');

    const noDrainsVisible = await noDrains.isVisible().catch(() => false);
    const rowCount = await drainRows.count();

    expect(noDrainsVisible || rowCount > 0).toBe(true);
  });

  test('screenshot captures full dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const screenshotPath = process.env.DASHBOARD_SCREENSHOT_PATH || path.join(ROOT, 'dashboard-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const fs = await import('fs');
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });
});
