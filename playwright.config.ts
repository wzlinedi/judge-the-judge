import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets the tests run beside a preview that is already open on 4173 (reuseExistingServer would otherwise test its older build).
const port = process.env['E2E_PORT'] ?? '4173';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    // PW_CHANNEL=chrome runs the chromium project in an installed Google Chrome instead of the downloaded Chromium.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env['PW_CHANNEL'] || undefined } },
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ],
});
