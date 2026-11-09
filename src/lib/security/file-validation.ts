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
