import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run dev',
    port: 8080,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});


