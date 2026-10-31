import path from "node:path";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch {
  // CI provides environment variables directly.
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          env: { DATABASE_URL: testDatabaseUrl },
          globalSetup: ["tests/integration/global-setup.ts"],
          // Files share one database, so run them one at a time.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
