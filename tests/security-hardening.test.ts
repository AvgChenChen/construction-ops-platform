import { describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonBody, maxJsonBodyBytes } from '../src/lib/security/request';
import { cookieOptions, safeRedirectPath } from '../src/lib/auth';
import { redactLogDetail } from '../src/lib/ops/redaction';
import { ReplayGuard, verifyWebhook } from '../src/lib/ops/signatures';
import { monitoringAuthorized } from '../src/lib/ops/monitoring';
import { restoreBackup, decryptBackup } from '../src/lib/ops/backup';
import { millsCommandSchema } from '../src/lib/mills/service';
import {
  downloadHeaders, noMalwareScanner, normalizeFilename, resolveStoragePath, servable,
  signDownload, storageKey, validateNamedUpload, verifyDownload,
} from '../src/lib/security/file-validation';

const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request('http://127.0.0.1:3000/api/mills', { method: 'POST', body, headers });

describe('request bodies', () => {
  it('rejects oversized bodies by declared length and by streamed bytes', async () => {
    await expect(readJsonBody(post('{}', { 'content-length': String(maxJsonBodyBytes + 1) }))).rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(post(JSON.stringify({ body: 'x'.repeat(maxJsonBodyBytes) })))).rejects.toMatchObject({ status: 413 });
  });

  it('rejects malformed JSON with a generic 400', async () => {
    await expect(readJsonBody(post('{"action":'))).rejects.toMatchObject({ status: 400, code: 'INVALID_JSON' });
    await expect(readJsonBody(post(JSON.stringify({ ok: true })))).resolves.toEqual({ ok: true });
  });

  it('treats SQL-like and script payloads as plain validated data', () => {
    const parsed = millsCommandSchema.safeParse({ action: 'addContact', name: "Robert'); DROP TABLE mills_contact;--", company: '<script>alert(1)</script>', email: '' });
    expect(parsed.success).toBe(true);
    expect(millsCommandSchema.safeParse({ action: 'updateTrade', tradeId: "1' OR '1'='1", status: 'BLOCKED' }).success).toBe(false);
  });
});

describe('cookies and redirects', () => {
  it('sets HttpOnly, SameSite=Lax, an 8 hour cap, and Secure on HTTPS origins', () => {
    const previous = process.env.APP_ORIGIN;
    try {
      process.env.APP_ORIGIN = 'http://127.0.0.1:3000';
      expect(cookieOptions()).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, maxAge: 28800, path: '/' });
      process.env.APP_ORIGIN = 'https://app.example.test';
      expect(cookieOptions().secure).toBe(true);
    } finally { process.env.APP_ORIGIN = previous; }
  });

  it('rejects encoded and scheme-based open redirects', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/mills');
    expect(safeRedirectPath('/%2F%2Fevil.example')).toBe('/mills');
    expect(safeRedirectPath('/\t/evil.example')).toBe('/mills');
  });
});

describe('XSS surface', () => {
  it('never renders raw HTML from data in application code', () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.tsx?$/.test(name)) files.push(path); } };
    walk('src');
    expect(files.filter((file) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('ships a CSP that blocks framing, plugins and foreign scripts', async () => {
    const config = (await import('../next.config')).default;
    const [{ headers }] = await config.headers!();
    const csp = headers.find((header) => header.key === 'Content-Security-Policy')!.value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/script-src 'self'/);
    expect(headers.find((header) => header.key === 'X-Content-Type-Options')?.value).toBe('nosniff');
    expect(headers.some((header) => header.key === 'Strict-Transport-Security')).toBe(false);
  });
});

describe('log redaction', () => {
  it('removes phone numbers, emails, tokens and passwords but keeps ids and timestamps', () => {
    const id = randomUUID();
    const out = redactLogDetail({ id, at: '2026-11-09T10:00:00Z', phone: '+1 647 555 0101', email: 'gc@example.com', note: 'refresh_token=abc.def password=hunter2' })!;
    expect(out).not.toMatch(/555 0101|gc@example\.com|abc\.def|hunter2/);
    expect(out).toContain(id);
    expect(out).toContain('2026-11-09T10:00:00Z');
  });
});

describe('uploads', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7\nschedule');

  it('requires bytes, declared type and extension to agree', () => {
    expect(validateNamedUpload('schedule.pdf', pdf, 'application/pdf')).toMatchObject({ ok: true, filename: 'schedule.pdf' });
    expect(validateNamedUpload('schedule.html', pdf, 'application/pdf')).toEqual({ ok: false, reason: 'mismatched_type' });
    const spoofedHtml = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    expect(validateNamedUpload('invoice.pdf', spoofedHtml, 'application/pdf')).toEqual({ ok: false, reason: 'mismatched_type' });
    expect(validateNamedUpload('notes.svg', spoofedHtml, 'text/plain')).toEqual({ ok: false, reason: 'mismatched_type' });
  });

  it('normalizes filenames and blocks path traversal', () => {
    expect(normalizeFilename('../../etc/passwd')).toBe('passwd');
    expect(normalizeFilename('..\\..\\boot.ini')).toBe('boot.ini');
    expect(normalizeFilename('.env')).toBe('env');
    expect(normalizeFilename('re"port\u0000.pdf')).toBe('re_port.pdf');
    expect(() => resolveStoragePath('/srv/mills-files', '../secrets')).toThrow('PATH_TRAVERSAL_REJECTED');
    const key = storageKey(randomUUID());
    expect(resolveStoragePath('/srv/mills-files', key)).toBe(`/srv/mills-files/${key}`);
  });

  it('keeps files quarantined until a scanner is configured and reports clean', async () => {
    expect(servable(await noMalwareScanner(pdf))).toBe(false);
  });

  it('issues expiring, tenant-scoped download links', () => {
    const accountId = randomUUID(); const other = randomUUID(); const key = storageKey(accountId); const secret = 'test-only-download-secret';
    const now = Date.now();
    const { expires, signature } = signDownload(accountId, key, secret, now);
    expect(verifyDownload(accountId, key, expires, signature, secret, now)).toBe(true);
    expect(verifyDownload(other, key, expires, signature, secret, now)).toBe(false);
    expect(verifyDownload(accountId, key, expires, signature, secret, now + 10 * 60 * 1000)).toBe(false);
  });

  it('serves files as sandboxed attachments, never inline HTML', () => {
    expect(downloadHeaders('a"b.pdf', 'application/pdf')).toMatchObject({ 'Content-Disposition': 'attachment; filename="a_b.pdf"', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  });
});

describe('webhooks', () => {
  const secret = 'test-only-webhook-secret';
  const accountId = randomUUID();
  const sign = (timestamp: string, body: string) => createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const event = (id: string, account = accountId) => JSON.stringify({ id, accountId: account, type: 'status.updated' });

  it('accepts a valid event once and rejects the replay', () => {
    const guard = new ReplayGuard(); const now = Date.now(); const ts = String(Math.floor(now / 1000)); const body = event('evt_1');
    const input = { provider: 'mock', accountId, rawBody: body, signature: sign(ts, body), timestamp: ts, secret, guard, now };
    expect(verifyWebhook(input).ok).toBe(true);
    expect(verifyWebhook(input)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rejects bad signatures, expired timestamps, other accounts and malformed bodies', () => {
    const guard = new ReplayGuard(); const now = Date.now(); const ts = String(Math.floor(now / 1000));
    const base = { provider: 'mock', accountId, timestamp: ts, secret, guard, now };
    expect(verifyWebhook({ ...base, rawBody: event('a'), signature: sign(ts, event('b')) })).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyWebhook({ ...base, rawBody: event('a'), signature: sign(ts, event('a')), secret: undefined })).toEqual({ ok: false, reason: 'bad_signature' });
    const old = String(Math.floor(now / 1000) - 3600);
    expect(verifyWebhook({ ...base, timestamp: old, rawBody: event('c'), signature: sign(old, event('c')) })).toEqual({ ok: false, reason: 'stale' });
    expect(verifyWebhook({ ...base, rawBody: event('d', randomUUID()), signature: sign(ts, event('d', randomUUID())) }).ok).toBe(false);
    const other = event('e', randomUUID());
    expect(verifyWebhook({ ...base, rawBody: other, signature: sign(ts, other) })).toEqual({ ok: false, reason: 'wrong_account' });
    expect(verifyWebhook({ ...base, rawBody: '{nope', signature: sign(ts, '{nope') })).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('operations safeguards', () => {
  it('protects metrics with a long bearer token', () => {
    const previous = process.env.MONITORING_TOKEN;
    try {
      process.env.MONITORING_TOKEN = 'short';
      expect(monitoringAuthorized(new Request('http://x', { headers: { authorization: 'Bearer short' } }))).toBe(false);
      process.env.MONITORING_TOKEN = 'x'.repeat(40);
      expect(monitoringAuthorized(new Request('http://x'))).toBe(false);
      expect(monitoringAuthorized(new Request('http://x', { headers: { authorization: `Bearer ${'x'.repeat(40)}` } }))).toBe(true);
    } finally { process.env.MONITORING_TOKEN = previous; }
  });

  it('refuses restores that are not into a separate, confirmed _restore database', async () => {
    await expect(restoreBackup('/nonexistent.enc', 'postgresql://u:p@127.0.0.1:5432/mills', 'mills')).rejects.toThrow('EMPTY_RESTORE_DATABASE_CONFIRMATION_REQUIRED');
    const previous = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5432/mills_restore';
      await expect(restoreBackup('/nonexistent.enc', 'postgresql://u:p@127.0.0.1:5432/mills_restore', 'mills_restore')).rejects.toThrow('CANNOT_RESTORE_OVER_SOURCE');
    } finally { process.env.DATABASE_URL = previous; }
  });

  it('rejects a tampered or foreign backup file', async () => {
    await expect(decryptBackup('package.json', '/tmp/should-not-exist')).rejects.toThrow('BACKUP_AUTHENTICATION_FAILED');
  });
});
