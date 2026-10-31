/**
 * Fixed-window counters kept in process memory.
 *
 * Bounded (issue #1): expired windows are swept, and the table never holds more than
 * `maxEntries` keys. When it's full after a sweep, the oldest keys are evicted first.
 * Eviction can reset a counter early; the cap is set well above normal traffic, and the
 * per-IP limit below still applies.
 *
 * Limitation (documented): each app instance keeps its own counters. A multi-instance
 * deployment needs a shared store such as Redis or Postgres.
 */
export class FixedWindowLimiter {
  private readonly entries = new Map<string, { count: number; windowStart: number }>();

  constructor(
    readonly max: number,
    readonly windowMs: number,
    readonly maxEntries = 10_000,
  ) {}

  isLimited(key: string, now = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (now - entry.windowStart > this.windowMs) {
      this.entries.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  hit(key: string, now = Date.now()): void {
    const entry = this.entries.get(key);
    if (!entry || now - entry.windowStart > this.windowMs) {
      this.entries.delete(key); // re-insert so insertion order tracks age
      this.entries.set(key, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
    if (this.entries.size > this.maxEntries) this.evict(now);
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }

  /** Remove expired windows, then the oldest keys if still over the cap. */
  private evict(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > this.windowMs) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Login throttling (issue #2). Keyed by email alone, anyone could lock out any user with
 * five wrong passwords. Now:
 * - IP + account: 5 failures. Stops guessing one password from one place without
 *   affecting the real user elsewhere.
 * - IP: 30 failures across all accounts. Stops password spraying from one place.
 * - Account: 20 failures from anywhere. A backstop against distributed guessing. Someone
 *   determined can still trigger it from many IPs; that residual risk is documented.
 * When the client IP is unknown (no trusted proxy), only the account limit applies.
 */
export const loginLimiters = {
  ipAccount: new FixedWindowLimiter(5, FIFTEEN_MINUTES),
  ip: new FixedWindowLimiter(30, FIFTEEN_MINUTES),
  account: new FixedWindowLimiter(20, FIFTEEN_MINUTES),
};

/** Sign-up attempts per IP (issue #3: slows probing for which emails have accounts). */
export const signUpLimiter = new FixedWindowLimiter(10, 60 * 60 * 1000);

function loginKeys(email: string, ip: string | null) {
  const keys: [FixedWindowLimiter, string][] = [[loginLimiters.account, email]];
  if (ip) keys.push([loginLimiters.ipAccount, `${ip}|${email}`], [loginLimiters.ip, ip]);
  return keys;
}

export function isLoginThrottled(email: string, ip: string | null, now = Date.now()): boolean {
  return loginKeys(email, ip).some(([limiter, key]) => limiter.isLimited(key, now));
}

export function recordLoginFailure(email: string, ip: string | null, now = Date.now()): void {
  for (const [limiter, key] of loginKeys(email, ip)) limiter.hit(key, now);
}

export function clearLoginFailures(email: string, ip: string | null): void {
  loginLimiters.account.clear(email);
  if (ip) loginLimiters.ipAccount.clear(`${ip}|${email}`);
}
