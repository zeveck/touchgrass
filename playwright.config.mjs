import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';

const PORT = Number(execSync('bash scripts/port.sh').toString().trim()) || 8000;

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile-safari', use: devices['iPhone 12'] },
  ],
});
