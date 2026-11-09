import { defineConfig, devices } from "@playwright/test";

// Browser tests run against their own backend (port 8100, throwaway database, AI off) and their own
// Next.js server (port 3200), so they never touch your dev data or whatever runs on 3000/8000.
const BACKEND_PORT = 8100;
const FRONTEND_PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  // The first visit to each page compiles it in dev mode, which can take a few seconds.
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bash e2e/start-backend.sh",
      url: `http://127.0.0.1:${BACKEND_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next dev -p ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}/login`,
      env: { BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
