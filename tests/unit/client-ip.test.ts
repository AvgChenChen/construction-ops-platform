import { describe, expect, it } from "vitest";
import { clientIp, parseProxyHops } from "@/server/auth/client-ip";

const h = (xff: string) => new Headers({ "x-forwarded-for": xff });

// A proxy like nginx ($proxy_add_x_forwarded_for) *appends* the address it saw to whatever the
// client sent. So with one proxy, "X-Forwarded-For: <anything the client typed>, <real IP>":
// everything left of the last entry is attacker-controlled.
describe("clientIp: X-Forwarded-For hops", () => {
  it("ignores a forged leftmost value with one trusted proxy", () => {
    expect(clientIp(h("1.2.3.4, 198.51.100.9"), true, 1)).toBe("198.51.100.9");
    // Rotating the forged value must not change the IP the limiter sees.
    expect(clientIp(h("5.6.7.8, 198.51.100.9"), true, 1)).toBe("198.51.100.9");
  });

  it("counts from the right for two trusted proxies (e.g. CDN, then nginx)", () => {
    // client-forged, real client (added by the CDN), CDN address (added by nginx)
    expect(clientIp(h("1.2.3.4, 198.51.100.9, 203.0.113.50"), true, 2)).toBe("198.51.100.9");
  });

  it("returns null when there are fewer entries than trusted hops", () => {
    expect(clientIp(h("198.51.100.9"), true, 2)).toBeNull();
  });

  it("still rejects values that aren't IP addresses", () => {
    expect(clientIp(h("1.2.3.4, not-an-ip"), true, 1)).toBeNull();
  });
});

describe("parseProxyHops", () => {
  it("defaults to 1 and falls back to 1 for invalid values", () => {
    expect(parseProxyHops(undefined)).toBe(1);
    expect(parseProxyHops("")).toBe(1);
    expect(parseProxyHops("2")).toBe(2);
    for (const bad of ["0", "-1", "abc", "1.5", "99"]) expect(parseProxyHops(bad)).toBe(1);
  });
});
