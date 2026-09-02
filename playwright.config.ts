import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for dashboard E2E tests.
 */
export default defineConfig({
  testDir: './src/dashboard/test',
  // The suite owns one shared dashboard server and SQLite database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${process.env.DASHBOARD_TEST_PORT || '3456'}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
