export const maxJsonBodyBytes = 16 * 1024;

export class RequestBodyError extends Error {
  constructor(readonly code: 'PAYLOAD_TOO_LARGE' | 'INVALID_JSON', readonly status: 413 | 400) { super(code); }
}

/** Read a JSON body with a hard byte cap, checked on the declared length and on the bytes actually read. */
export async function readJsonBody(req: Request, maxBytes = maxJsonBodyBytes): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new RequestBodyError('PAYLOAD_TOO_LARGE', 413);
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new RequestBodyError('PAYLOAD_TOO_LARGE', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RequestBodyError('INVALID_JSON', 400); }
}
