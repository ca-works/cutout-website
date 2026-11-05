import { defineConfig, devices } from '@playwright/test';
import { SITE_BASE } from './site.config.mjs';

// SITE_URL=https://ca-works.github.io/cutout-website/ npm test  → test the live site instead.
const live = process.env.SITE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: live ?? `http://127.0.0.1:4321${SITE_BASE}`,
    trace: 'retain-on-failure',
  },
  webServer: live
    ? undefined
    : {
        command: 'node scripts/serve.mjs',
        url: `http://127.0.0.1:4321${SITE_BASE}`,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
});
