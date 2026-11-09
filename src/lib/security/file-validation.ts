import { createHmac, randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { verifyHmacSignature } from '../ops/signatures';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type SafeUploadType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'text/plain';

export type FileValidationResult =
  | { ok: true; type: SafeUploadType; size: number }
  | { ok: false; reason: 'too_large' | 'empty' | 'unsupported_type' | 'mismatched_type' };

function detectedType(bytes: Uint8Array): SafeUploadType | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 0 && !bytes.slice(0, Math.min(bytes.length, 4096)).some((value) => value === 0)) return 'text/plain';
  return null;
}

/** Validate uploads using size and magic bytes, never the filename alone. */
export function validateUpload(bytes: Uint8Array, declaredType?: string): FileValidationResult {
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  const type = detectedType(bytes);
  if (!type) return { ok: false, reason: 'unsupported_type' };
  if (declaredType && declaredType !== type && !(type === 'text/plain' && declaredType === 'text/plain')) return { ok: false, reason: 'mismatched_type' };
  return { ok: true, type, size: bytes.length };
}

export const maxUploadBytes = MAX_UPLOAD_BYTES;

/* Upload storage helpers. No public upload route uses these yet; they exist so the
 * first real upload feature starts from a reviewed, tested boundary. */

const allowedExtensions: Record<SafeUploadType, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'text/plain': ['txt', 'csv'],
};

export const uploadAuditActions = ['FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED', 'FILE_REJECTED'] as const;

/** Display-only name: strips paths, control characters and anything outside a conservative set. */
export function normalizeFilename(name: string): string {
  const base = name.normalize('NFKC').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return cleaned || 'upload';
}

export function extensionMatchesType(filename: string, type: SafeUploadType): boolean {
  const extension = normalizeFilename(filename).split('.').pop()?.toLowerCase() ?? '';
  return allowedExtensions[type].includes(extension);
}

/** Full check for a future upload route: bytes, declared MIME and extension must all agree. */
export function validateNamedUpload(filename: string, bytes: Uint8Array, declaredType?: string): FileValidationResult & { filename?: string } {
  const result = validateUpload(bytes, declaredType);
  if (!result.ok) return result;
  if (!extensionMatchesType(filename, result.type)) return { ok: false, reason: 'mismatched_type' };
  return { ...result, filename: normalizeFilename(filename) };
}

/** Random, tenant-prefixed storage key. The user's filename is never part of the path. */
export function storageKey(accountId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw new Error('INVALID_ACCOUNT_ID');
  return `${accountId}/${randomBytes(16).toString('hex')}`;
}

/** Resolve a storage key inside a private root; throws on any traversal attempt. */
export function resolveStoragePath(root: string, key: string): string {
  const base = resolve(root);
  const target = resolve(base, key);
  if (!target.startsWith(base + sep)) throw new Error('PATH_TRAVERSAL_REJECTED');
  return target;
}

export type MalwareScanResult = 'clean' | 'infected' | 'not_configured';
export type MalwareScanner = (bytes: Uint8Array) => Promise<MalwareScanResult>;
/** Default scanner: nothing is configured, so files stay quarantined and are never served. */
export const noMalwareScanner: MalwareScanner = async () => 'not_configured';
export function servable(scan: MalwareScanResult) { return scan === 'clean'; }

/** Short-lived download token bound to one account and one storage key. */
export function signDownload(accountId: string, key: string, secret: string, now = Date.now(), ttlMs = 5 * 60 * 1000) {
  const expires = Math.floor((now + ttlMs) / 1000);
  const signature = createHmac('sha256', secret).update(`${accountId}\n${key}\n${expires}`).digest('hex');
  return { expires, signature };
}

export function verifyDownload(accountId: string, key: string, expires: number, signature: string, secret: string, now = Date.now()) {
  if (!Number.isInteger(expires) || expires * 1000 < now || !key.startsWith(`${accountId}/`)) return false;
  return verifyHmacSignature(`${accountId}\n${key}\n${expires}`, signature, secret);
}

/** Headers for serving stored files: always a download, never rendered or sniffed as HTML/script. */
export function downloadHeaders(filename: string, type: SafeUploadType): Record<string, string> {
  return {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${normalizeFilename(filename)}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, no-store',
  };
}
