import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Fixed local DEMO target only. Never point this suite at production or a wallet.
export default defineConfig({
  testDir: '.',
  testMatch: 'customer-journey.spec.mjs',
  outputDir: '../evidence/browser-acceptance/results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  globalTimeout: 360_000,
  expect: { timeout: 15_000 },
  reporter: [['line'], ['html', { outputFolder: '../evidence/browser-acceptance/report', open: 'never' }]],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:3110',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'UTC',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3110',
    url: 'http://127.0.0.1:3110/api/runtime',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { APP_MODE: 'demo', APP_ORIGIN: 'http://127.0.0.1:3110', NEXT_TELEMETRY_DISABLED: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
