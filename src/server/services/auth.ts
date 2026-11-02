import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, getDummyHash } from "../auth/password";
import { generateSessionToken, hashSessionToken } from "../auth/tokens";
import { clearLoginFailures, isLoginThrottled, recordLoginFailure, signUpLimiter } from "../auth/rate-limit";
import { AppError, conflict, isUniqueViolation } from "./errors";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sign-up says plainly when an email is taken. That lets someone check whether an email
 * has an account (issue #3). A real product would show a neutral message and email the
 * address instead; this prototype sends no email, so it keeps the clear message, limits
 * attempts per IP when the IP is known, and documents the trade-off in the README.
 */
export async function signUp(
  input: { organizationName: string; name: string; email: string; password: string },
  ip: string | null = null,
) {
  if (ip && signUpLimiter.isLimited(ip)) {
    throw new AppError("RATE_LIMITED", "Too many sign-up attempts. Try again later.");
  }
  if (ip) signUpLimiter.hit(ip);
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: input.organizationName } });
      return tx.user.create({
        data: { organizationId: org.id, name: input.name, email: input.email, passwordHash, role: "OWNER" },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("An account with this email already exists");
    throw error;
  }
}

/** Returns the user on success, null on bad credentials. Throws when throttled. */
export async function authenticate(email: string, password: string, ip: string | null = null) {
  if (isLoginThrottled(email, ip)) {
    throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again in 15 minutes.");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  // Always run one scrypt comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) {
    recordLoginFailure(email, ip);
    return null;
  }
  clearLoginFailures(email, ip);
  return user;
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { organization: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session;
}

export async function invalidateSession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}
