import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';

const PORT = Number(execSync('bash scripts/port.sh').toString().trim()) || 8000;

export default defineConfig({
  testDir: './e2e',
  // Many specs play the game in real time (stroke speeds, the bugs' 1.5 s
  // warning). Playwright's default (half the cores: 16 here) runs that many
  // browsers at once and starves them, which shows up as timing flakes.
  // A handful of workers keeps each page close to real time.
  workers: 4,
  webServer: {
    command: `python3 -m http.server ${PORT} --directory game`,
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
