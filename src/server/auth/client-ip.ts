/**
 * The client's IP address, for rate limiting only.
 *
 * Proxy headers are trivial to forge, so they're used only when TRUST_PROXY=true, meaning
 * the app runs behind a proxy you control. Otherwise this returns null and IP-based limits
 * are skipped (see rate-limit.ts).
 *
 * Proxies such as nginx ($proxy_add_x_forwarded_for) *append* the address they saw to the
 * X-Forwarded-For header the client sent. Everything to the left of what your own proxies
 * added is whatever the client typed, so the client's address is the entry TRUST_PROXY_HOPS
 * places from the right (1 = a single proxy in front of the app).
 */
export function clientIp(
  headers: Headers,
  trustProxy = process.env.TRUST_PROXY === "true",
  hops = parseProxyHops(process.env.TRUST_PROXY_HOPS),
): string | null {
  if (!trustProxy) return null;
  const forwardedHeader = headers.get("x-forwarded-for");
  let candidate: string;
  if (forwardedHeader !== null) {
    const entries = forwardedHeader.split(",").map((part) => part.trim());
    if (entries.length < hops) return null; // the request didn't pass through every trusted proxy
    candidate = entries[entries.length - hops] ?? "";
  } else {
    candidate = headers.get("x-real-ip")?.trim() ?? "";
  }
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : null;
}

/**
 * TRUST_PROXY_HOPS: how many proxies you control sit in front of the app. Defaults to 1.
 * Anything that isn't a whole number from 1 to 10 also means 1, since the last entry is always
 * written by the nearest proxy and so can't be forged by the client.
 */
export function parseProxyHops(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value.trim())) return 1;
  const hops = Number(value.trim());
  return hops >= 1 && hops <= 10 ? hops : 1;
}
