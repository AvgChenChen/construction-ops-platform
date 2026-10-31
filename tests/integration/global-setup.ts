import { execSync } from "node:child_process";

/** Applies migrations to the dedicated test database before any integration test runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. Copy .env.example to .env.");
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL must point at a database whose name contains 'test'.",
    );
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
