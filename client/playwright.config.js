import { defineConfig, devices } from '@playwright/test';

/**
 * E2E chạy trên API thật + MongoDB replica set TRONG BỘ NHỚ (server/test/e2e/testServer.mjs).
 * Không bao giờ chạm cluster trong server/.env.
 */
const API_PORT = 5055;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'vi-VN',
    permissions: [],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../server/test/e2e/testServer.mjs',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { E2E_SERVER_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { VITE_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
