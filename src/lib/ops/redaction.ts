const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PHONE_PATTERN = /(?<![\w-])\+?\d[\d\s().-]{8,}\d(?![\w-])/g;
const SECRET_KEY_PATTERN = /\b(password|passwd|secret|token|authorization|cookie|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^,\s;]+)/gi;

/**
 * Redacts common credentials and contact identifiers before a value is written
 * to application logs. This is intentionally conservative: structured audit
 * records should store IDs and state transitions, never raw message bodies.
 */
export function redactSensitiveText(value: string): string {
  return value
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_TOKEN]')
    .replace(SECRET_KEY_PATTERN, '$1=[REDACTED]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]');
}

export function redactLogDetail(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Error) return redactSensitiveText(value.name);
  if (typeof value === 'string') return redactSensitiveText(value).slice(0, 500);
  try { return redactSensitiveText(JSON.stringify(value)).slice(0, 500); } catch { return '[REDACTED_UNSERIALIZABLE]'; }
}
