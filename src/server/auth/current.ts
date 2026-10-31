import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { validateSessionToken } from "../services/auth";
import type { Ctx } from "../services/context";
import { AppError } from "../services/errors";

export const SESSION_COOKIE = "session";

function cookieSecure() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript, which limits the damage of an XSS bug
    sameSite: "lax", // not sent on cross-site POSTs (CSRF defence, alongside Next's Origin check)
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Validated once per request (React cache) no matter how many components ask. */
export const getCurrentSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export type CurrentUser = Ctx & { name: string; email: string; organizationName: string };

/** Every protected page and server action starts here. Redirects to /login if signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return {
    userId: session.user.id,
    orgId: session.user.organizationId,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    organizationName: session.user.organization.name,
  };
}

/** For server components: turn a service-layer NOT_FOUND into Next's 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
