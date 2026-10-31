/**
 * Minimal structured logger: one JSON object per line on stdout/stderr.
 * Never pass passwords, tokens, or free-text user content in `fields`.
 */
type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

export function errorFields(error: unknown) {
  return error instanceof Error
    ? { error: error.name, message: error.message.slice(0, 300) }
    : { error: String(error) };
}
