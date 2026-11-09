import { createHmac, timingSafeEqual } from 'node:crypto';

function decodeSignature(value: string): Buffer | null {
  const normalized = value.trim().replace(/^sha256=/i, '');
  if (!/^[a-f0-9]+$/i.test(normalized) || normalized.length % 2 !== 0) return null;
  return Buffer.from(normalized, 'hex');
}

/** Verify an HMAC-SHA256 signature without leaking timing information. */
export function verifyHmacSignature(payload: string | Buffer, signature: string | null | undefined, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const provided = decodeSignature(signature);
  if (!provided) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function isFreshWebhookTimestamp(timestamp: string | null | undefined, now = Date.now(), maxAgeMs = 5 * 60 * 1000): boolean {
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  const value = Number(timestamp) * 1000;
  return Number.isFinite(value) && Math.abs(now - value) <= maxAgeMs;
}
