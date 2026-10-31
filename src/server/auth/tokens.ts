import { createHash, randomBytes } from "node:crypto";

/** 256 bits of randomness, URL-safe. This is what goes in the cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 of the token is stored, so a database leak does not leak live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
