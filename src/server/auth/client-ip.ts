/**
 * The client's IP address, for rate limiting only.
 *
 * Proxy headers are trivial to forge, so they're used only when TRUST_PROXY=true, meaning
 * the app runs behind a proxy you control that overwrites them. Otherwise this returns
 * null and IP-based limits are skipped (see rate-limit.ts).
 */
export function clientIp(headers: Headers, trustProxy = process.env.TRUST_PROXY === "true"): string | null {
  if (!trustProxy) return null;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : null;
}
