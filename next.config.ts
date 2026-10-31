import type { NextConfig } from "next";
import path from "node:path";

// Content-Security-Policy for production builds. Next.js inlines small bootstrap scripts,
// so script-src needs 'unsafe-inline' without a nonce setup; the other directives still
// block framing, foreign form targets, <base> hijacking, and loading code from other origins.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // The Docker build sets NEXT_OUTPUT=standalone to get a minimal server bundle.
  // Local `next start` needs the default output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Pin the tracing root to this repo so a parent folder's lockfile is never picked up.
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Dev mode needs eval for hot reload, so the policy only applies to production builds.
          ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
