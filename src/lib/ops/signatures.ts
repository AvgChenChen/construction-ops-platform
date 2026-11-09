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

export type WebhookVerification =
  | { ok: true; event: { id: string; provider: string; accountId: string; payload: unknown } }
  | { ok: false; reason: 'bad_signature' | 'stale' | 'malformed' | 'duplicate' | 'wrong_account' };

/**
 * Replay/duplicate guard keyed by provider, account and event id.
 * shortcut: in-memory and single-process; move to a unique-indexed table when the first live provider is enabled.
 */
export class ReplayGuard {
  private seen = new Map<string, number>();
  constructor(private ttlMs = 24 * 60 * 60 * 1000) {}
  /** Returns true the first time an event key is seen inside the TTL window. */
  claim(key: string, now = Date.now()) {
    for (const [k, expires] of this.seen) if (expires < now) this.seen.delete(k);
    if (this.seen.has(key)) return false;
    this.seen.set(key, now + this.ttlMs);
    return true;
  }
}

/**
 * Verify a provider webhook before parsing it: HMAC over `${timestamp}.${rawBody}`, a fresh timestamp,
 * the expected Mills account, and first-seen event id. Any failure is a rejection with no side effects.
 */
export function verifyWebhook(input: { provider: string; accountId: string; rawBody: string; signature: string | null; timestamp: string | null; secret: string | undefined; guard: ReplayGuard; now?: number }): WebhookVerification {
  const now = input.now ?? Date.now();
  if (!verifyHmacSignature(`${input.timestamp}.${input.rawBody}`, input.signature, input.secret)) return { ok: false, reason: 'bad_signature' };
  if (!isFreshWebhookTimestamp(input.timestamp, now)) return { ok: false, reason: 'stale' };
  let parsed: { id?: unknown; accountId?: unknown };
  try { parsed = JSON.parse(input.rawBody); } catch { return { ok: false, reason: 'malformed' }; }
  if (typeof parsed?.id !== 'string' || !parsed.id || parsed.id.length > 200) return { ok: false, reason: 'malformed' };
  if (parsed.accountId !== input.accountId) return { ok: false, reason: 'wrong_account' };
  if (!input.guard.claim(`${input.provider}:${input.accountId}:${parsed.id}`, now)) return { ok: false, reason: 'duplicate' };
  return { ok: true, event: { id: parsed.id, provider: input.provider, accountId: input.accountId, payload: parsed } };
}
