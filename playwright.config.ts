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
    screenshot: "only-on-failure",
    headless: true,
    // Opt-in: point at a preinstalled Chromium when the pinned Playwright browser isn't downloaded
    // (e.g. a sandbox without `npx playwright install`). CI leaves this unset.
    launchOptions: process.env.PW_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.mobile\.spec\.ts$/ },
    // Phone-sized check of the core coordination workflow only; the full suite is not multiplied.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
