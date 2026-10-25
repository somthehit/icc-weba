import * as crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Server-side pepper stored in secure environment or secret manager
const PEPPER = process.env.POS_AUTH_PEPPER || 'pos_secure_default_pepper_change_in_prod';

/**
 * Pre-hashes the plain credential with the server pepper using HMAC-SHA256.
 * Returns a 64-character hex string (valid ASCII/UTF-8) to guarantee uniform input
 * length to Argon2, eliminate buffer truncation / invalid UTF-8 byte errors, and defend
 * against DB leaks without leaking password-length side-channels.
 */
export function applyPepper(value: string): string {
  return crypto.createHmac('sha256', PEPPER).update(value).digest('hex');
}

/**
 * Hashes a password or PIN using Argon2id with server-side pepper.
 */
export async function hashCredential(value: string): Promise<string> {
  const peppered = applyPepper(value);
  return hash(peppered, {
    memoryCost: 65536, // 64 MiB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  });
}

/**
 * Verifies a plain credential against an Argon2id hash with server-side pepper.
 */
export async function verifyCredential(storedHash: string, value: string): Promise<boolean> {
  try {
    const peppered = applyPepper(value);
    return await verify(storedHash, peppered);
  } catch {
    return false;
  }
}

/**
 * Pre-computed dummy hash cached in memory at server startup.
 * When a staff code does not exist, executing a verification against this hash ensures
 * identical response timing (~300-400ms), completely preventing username enumeration attacks.
 */
const STATIC_DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$YC1n+cmuh4u8yVTTzohLkw$7qZkNkd1LqdR0IQf3+7iPOy9yVC+VW+bj/q6Z392FNI';

export async function dummyVerify(value: string): Promise<void> {
  await verifyCredential(STATIC_DUMMY_HASH, value);
}
