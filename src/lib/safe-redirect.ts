// A placeholder origin that can never be a real host (".invalid" is reserved, RFC 2606).
const SAME_SITE = "https://app.invalid";

/**
 * Only allow same-site relative paths after login, to avoid an open redirect.
 *
 * Checking the raw string isn't enough: browsers clean URLs before following them (they strip
 * tabs and newlines and treat "\" like "/"), so "/\t/evil.com" becomes "//evil.com", which is
 * another site. Instead, resolve the value with the same WHATWG URL parser browsers use and keep
 * it only if it stays on our origin. The result is the parsed path, so it's what the browser
 * would have used anyway (e.g. "/a b" comes back as "/a%20b").
 */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(value, SAME_SITE);
  } catch {
    return fallback;
  }
  if (url.origin !== SAME_SITE) return fallback;
  return url.pathname + url.search + url.hash;
}
