import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

const BASE = "https://app.example/login";

/** Where a browser would actually go: the WHATWG URL parser strips tabs and newlines first. */
const resolvesOffSite = (path: string) => new URL(path, BASE).origin !== new URL(BASE).origin;

describe("safeNextPath: browser URL clean-up", () => {
  // Each payload passes a naive prefix check but becomes //evil.com once the browser
  // removes the tab or newline, sending the user to another site after login.
  const payloads = ["/\t/evil.com", "/\n/evil.com", "/\r\n/evil.com", "/\t\t/evil.com", " //evil.com"];

  it.each(payloads)("%j really is an off-site URL in a browser", (payload) => {
    expect(resolvesOffSite(payload)).toBe(true); // proves each case is a real attack, not a guess
  });

  it.each(payloads)("rejects %j", (payload) => {
    expect(safeNextPath(payload)).toBe("/dashboard");
  });

  it.each(["/projects/abc", "/projects/abc?tab=tasks#t1", "/projects/a%20b", "/%09/evil.com"])(
    "still allows the same-site path %j",
    (path) => {
      expect(resolvesOffSite(path)).toBe(false);
      expect(safeNextPath(path)).toBe(path);
    },
  );
});
