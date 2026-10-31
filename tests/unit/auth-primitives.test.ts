import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { generateSessionToken, hashSessionToken } from "@/server/auth/tokens";
import { clearLoginFailures, isLoginThrottled, recordLoginFailure } from "@/server/auth/rate-limit";
import { safeNextPath } from "@/lib/safe-redirect";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });

  it("salts each hash and rejects malformed stored values", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are random, URL-safe, and hashed deterministically", () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(generateSessionToken());
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).toHaveLength(64);
  });
});

describe("login throttle", () => {
  it("blocks after 5 failures and resets after the window", () => {
    const key = "someone@example.com";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) recordLoginFailure(key, t0);
    expect(isLoginThrottled(key, t0 + 1000)).toBe(true);
    expect(isLoginThrottled(key, t0 + 16 * 60 * 1000)).toBe(false);
    clearLoginFailures(key);
    expect(isLoginThrottled(key, t0)).toBe(false);
  });
});

describe("post-login redirect", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/projects/abc")).toBe("/projects/abc");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});
