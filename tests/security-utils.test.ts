import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { redactSensitiveText } from '../src/lib/ops/redaction';
import { isFreshWebhookTimestamp, verifyHmacSignature } from '../src/lib/ops/signatures';
import { maxUploadBytes, validateUpload } from '../src/lib/security/file-validation';

describe('log redaction', () => {
  it('removes credentials and email addresses from log details', () => {
    const result = redactSensitiveText('email=owner@example.com authorization=Bearer abc123 password=secret');
    expect(result).not.toContain('owner@example.com');
    expect(result).not.toContain('abc123');
    expect(result).not.toContain('secret');
    expect(result).toContain('[REDACTED_EMAIL]');
  });
});

describe('webhook signatures', () => {
  it('accepts a valid HMAC signature and rejects altered payloads', () => {
    const payload = '{"event":"approved"}';
    const secret = 'test-secret';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyHmacSignature(payload, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyHmacSignature(`${payload}x`, signature, secret)).toBe(false);
    expect(verifyHmacSignature(payload, 'not-a-signature', secret)).toBe(false);
  });

  it('requires a fresh numeric timestamp', () => {
    const now = Date.now();
    expect(isFreshWebhookTimestamp(String(Math.floor(now / 1000)), now)).toBe(true);
    expect(isFreshWebhookTimestamp(String(Math.floor((now - 10 * 60 * 1000) / 1000)), now)).toBe(false);
    expect(isFreshWebhookTimestamp('invalid', now)).toBe(false);
  });
});

describe('upload validation', () => {
  it('accepts a PDF only when the magic bytes match', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nresume');
    expect(validateUpload(pdf, 'application/pdf')).toEqual({ ok: true, type: 'application/pdf', size: pdf.length });
    expect(validateUpload(pdf, 'image/png')).toEqual({ ok: false, reason: 'mismatched_type' });
  });

  it('rejects empty, oversized, and binary-unknown uploads', () => {
    expect(validateUpload(new Uint8Array())).toEqual({ ok: false, reason: 'empty' });
    expect(validateUpload(new Uint8Array(maxUploadBytes + 1))).toEqual({ ok: false, reason: 'too_large' });
    expect(validateUpload(new Uint8Array([0, 1, 2, 3]))).toEqual({ ok: false, reason: 'unsupported_type' });
  });
});
