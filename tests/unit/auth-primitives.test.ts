import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { generateSessionToken, hashSessionToken } from "@/server/auth/tokens";
import { FixedWindowLimiter, isLoginThrottled, recordLoginFailure } from "@/server/auth/rate-limit";
import { clientIp } from "@/server/auth/client-ip";
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

describe("FixedWindowLimiter", () => {
  it("limits at the threshold and resets after the window", () => {
    const l = new FixedWindowLimiter(5, 1000);
    for (let i = 0; i < 5; i++) l.hit("k", 0);
    expect(l.isLimited("k", 500)).toBe(true);
    expect(l.isLimited("k", 1500)).toBe(false);
  });

  it("sweeps expired windows once it is over the cap (issue #1)", () => {
    const l = new FixedWindowLimiter(5, 1000, 3);
    ["a", "b", "c"].forEach((k) => l.hit(k, 0));
    l.hit("d", 5000); // over the cap: a, b, c have expired and are removed
    expect(l.size).toBe(1);
  });

  it("never grows past its cap, even when nothing has expired (issue #1)", () => {
    const l = new FixedWindowLimiter(5, 60_000, 1000);
    for (let i = 0; i < 50_000; i++) l.hit(`spray-${i}@example.com`, 0);
    expect(l.size).toBeLessThanOrEqual(1000);
    expect(l.isLimited("spray-0@example.com", 0)).toBe(false); // oldest evicted
  });
});

describe("login throttle (issue #2)", () => {
  const t0 = 10_000_000;

  it("blocks the attacker's IP without locking the real user out elsewhere", () => {
    const email = "victim-a@example.com";
    for (let i = 0; i < 5; i++) recordLoginFailure(email, "203.0.113.7", t0);
    expect(isLoginThrottled(email, "203.0.113.7", t0)).toBe(true);
    expect(isLoginThrottled(email, "198.51.100.2", t0)).toBe(false);
  });

  it("still has an account-wide backstop against distributed guessing", () => {
    const email = "victim-b@example.com";
    for (let i = 0; i < 20; i++) recordLoginFailure(email, `192.0.2.${i}`, t0);
    expect(isLoginThrottled(email, "198.51.100.99", t0)).toBe(true);
  });

  it("stops one IP spraying many accounts", () => {
    for (let i = 0; i < 30; i++) recordLoginFailure(`spray-target-${i}@example.com`, "203.0.113.50", t0);
    expect(isLoginThrottled("someone-new@example.com", "203.0.113.50", t0)).toBe(true);
  });

  it("falls back to the account limit when the IP is unknown", () => {
    const email = "no-ip@example.com";
    for (let i = 0; i < 5; i++) recordLoginFailure(email, null, t0);
    expect(isLoginThrottled(email, null, t0)).toBe(false);
    for (let i = 0; i < 15; i++) recordLoginFailure(email, null, t0);
    expect(isLoginThrottled(email, null, t0)).toBe(true);
  });
});

describe("clientIp", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("ignores proxy headers unless the proxy is trusted", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7" }), false)).toBeNull();
    // With one trusted proxy, the last entry is the one it added; the leftmost could be forged.
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), true, 1)).toBe("10.0.0.1");
    expect(clientIp(h({ "x-real-ip": "2001:db8::1" }), true)).toBe("2001:db8::1");
    expect(clientIp(h({ "x-forwarded-for": "not an ip; drop table" }), true)).toBeNull();
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
