import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile();
} catch {
  // CI sets variables directly.
}

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests run against a production build (`npm run build` first) and the
 * seeded demo database. Headless Chromium, one worker, to stay light on small machines.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    headless: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
