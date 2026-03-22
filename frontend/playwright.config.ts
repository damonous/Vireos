import { defineConfig } from 'playwright/test';
import { fileURLToPath } from 'node:url';

const configDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    cwd: configDir,
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
