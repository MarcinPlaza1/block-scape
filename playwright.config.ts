import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:9000',
  },
  webServer: {
    command: 'npm run dev',
    port: 9000,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});


