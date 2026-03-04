import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for FOODSHI frontend.
 *
 * Prerequisites before running:
 *   1. A test PostgreSQL database is running and DATABASE_URL in .env points to it.
 *   2. `npx playwright install chromium` has been run once.
 *
 * Run:
 *   npm run test:e2e           — headless CI run
 *   npm run test:e2e:ui        — interactive UI mode
 *   npm run test:e2e:debug     — pause on each step
 */
export default defineConfig({
  testDir: './e2e',

  // Run tests sequentially — they share a real backend + DB, so parallelism
  // would cause inter-test data races without additional isolation.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['line'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Grant geolocation globally; individual tests override coordinates.
        permissions: ['geolocation'],
      },
    },
  ],

  // Starts/stops the backend process if not already running.
  globalSetup: './e2e/global-setup.ts',

  // Starts the Next.js dev server and waits until it is reachable.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Reuse an already-running dev server in local development;
    // always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
