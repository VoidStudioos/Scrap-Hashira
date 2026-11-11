import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  webServer: {
    command: 'node tests/fixtures/server.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    launchOptions: {
      executablePath: process.env.HASHIRA_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-gpu'],
    },
  },
});
