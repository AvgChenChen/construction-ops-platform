export type AppErrorCode = "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "UNAUTHENTICATED" | "RATE_LIMITED";

/** Errors the UI is allowed to show. Anything else is logged and shown as a generic failure. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Another organization's records are reported as "not found", never "forbidden",
// so a caller cannot learn that an id exists in someone else's account.
export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = (message: string) => new AppError("FORBIDDEN", message);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const invalid = (message: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("VALIDATION", message, fieldErrors);

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}
