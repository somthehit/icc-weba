// lib/auth/jwt.ts
//
// Token signing/verification on `jose` rather than `jsonwebtoken`, because the
// middleware runs on the Edge runtime where Node's `crypto` module is not
// available. Everything here is Web Crypto only, so the same helpers work in
// middleware, route handlers and scripts.

import { jwtVerify, SignJWT } from 'jose';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

const JWT_ISSUER = 'ice-computers';
const JWT_AUDIENCE = 'ice-computers-web';
export const JWT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Cookie the browser stores the session token in. */
export const AUTH_COOKIE = 'auth-token';

/**
 * The signing key. Deliberately throws instead of falling back to a baked-in
 * default: a shipped default secret lets anyone mint an admin token, so a
 * missing JWT_SECRET has to be a hard startup failure rather than a warning.
 */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short. Set a random value of at least 32 characters ' +
        '(e.g. `openssl rand -base64 48`) in your environment before starting the app.',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${JWT_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** Returns the payload, or null for any malformed/expired/foreign token. */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
    const { userId, email, role } = payload as unknown as JWTPayload;
    // A token that verifies but lacks identity claims is not usable.
    if (typeof userId !== 'number' || typeof email !== 'string' || typeof role !== 'string') {
      return null;
    }
    return { userId, email, role };
  } catch {
    return null;
  }
}
