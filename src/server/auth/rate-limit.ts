/**
 * Fixed-window login throttle, kept in process memory.
 *
 * Limitation (documented): with several app instances each one keeps its own
 * counters. A shared store such as Redis would be needed in a multi-instance deployment.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, { count: number; windowStart: number }>();

export function isLoginThrottled(key: string, now = Date.now()): boolean {
  const entry = failures.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) return false;
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) failures.set(key, { count: 1, windowStart: now });
  else entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
