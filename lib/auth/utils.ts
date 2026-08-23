// lib/auth/utils.ts
//
// Node-runtime auth helpers. Password hashing lives here because bcrypt needs
// Node; token signing/verification is re-exported from ./jwt so route handlers
// and the Edge middleware share exactly one implementation.

import bcrypt from 'bcryptjs';

import { AUTH_COOKIE, JWTPayload, signToken, verifyToken } from './jwt';

export type { JWTPayload };
export { AUTH_COOKIE, signToken, verifyToken };

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/** @deprecated use `signToken` — kept so older call sites keep compiling. */
export const generateToken = signToken;

/**
 * Pulls the session token out of a request. The httpOnly cookie is the primary
 * channel (set by /api/auth/login); the Authorization header is accepted so
 * scripts and tests can authenticate without a cookie jar.
 */
export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7).trim() || null;
  }

  // Parsed by hand rather than via NextRequest.cookies so this also works for a
  // plain `Request` (route handlers, tests, server actions).
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === AUTH_COOKIE) {
        const value = decodeURIComponent(rest.join('='));
        return value || null;
      }
    }
  }

  return null;
}

/**
 * Verifies the caller's token and returns their claims.
 *
 * Deliberately re-verifies the signature instead of reading the `x-user-*`
 * headers the middleware injects: those headers are indistinguishable from ones
 * a client sent, so trusting them would let anyone claim any identity on a
 * route the middleware treats as public.
 */
export async function getUserFromRequest(request: Request): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}
