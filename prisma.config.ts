import { defineConfig } from "prisma/config";

// When a config file exists, the Prisma CLI no longer reads .env on its own.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment (CI, Docker).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
