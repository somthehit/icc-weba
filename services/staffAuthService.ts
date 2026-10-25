import { eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { db as defaultDb } from '@/db';
import { staff, type Staff } from '@/db/schema/pos-enterprise';
import { hashCredential, verifyCredential, dummyVerify } from '@/lib/security/crypto';

// Security Parameters
export const MAX_PASSWORD_ATTEMPTS = 5;
export const PASSWORD_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export const MAX_PIN_ATTEMPTS = 3;
export const PIN_LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

// Uniform error message to prevent staffCode / username enumeration
export const INVALID_CREDENTIALS_MSG = 'Invalid staff code or password.';

export type DatabaseClient = PgDatabase<any>;

export interface StaffSession {
  id: string;
  name: string;
  staffCode: string;
  role: Staff['role'];
  mustChangePassword: boolean;
  mustChangePin: boolean;
  hasPin: boolean;
}

export interface LoginResult {
  success: true;
  staff: StaffSession;
  message?: string;
}

export interface PinVerifyResult {
  success: boolean;
  staff?: {
    id: string;
    name: string;
    staffCode: string;
    role: Staff['role'];
  };
  error?: string;
  canFallbackToPassword?: boolean;
}

/**
 * Standard typed authentication errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'INACTIVE' | 'PIN_LOCKED' | 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * 1. Login with Staff Code & Password
 * -------------------------------------------------------------------------
 * - Constant-time check on missing staff (neutralizes timing attacks).
 * - Pessimistic row locking (FOR UPDATE) prevents race-condition brute forcing.
 * - Enforces account active status and progressive 15-minute lockout.
 * - Resets failed attempts upon successful password verification.
 */
export async function loginWithPassword(
  staffCode: string,
  password: string,
  customDb?: DatabaseClient
): Promise<LoginResult> {
  const db = customDb || defaultDb;
  const normalizedCode = staffCode.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    // Pessimistic Row Lock (FOR UPDATE) ensures atomic concurrency control
    const [row] = await tx
      .select()
      .from(staff)
      .where(eq(staff.staffCode, normalizedCode))
      .for('update')
      .limit(1);

    // Timing-attack defense: If staff code is not found, execute dummy Argon2 verify
    if (!row) {
      await dummyVerify(password);
      throw new AuthError(INVALID_CREDENTIALS_MSG, 'INVALID_CREDENTIALS');
    }

    // Check if account has been deactivated
    if (!row.active) {
      throw new AuthError('Staff account has been deactivated. Please contact your manager.', 'INACTIVE');
    }

    // Check password lockout
    const now = Date.now();
    if (row.lockedUntil && row.lockedUntil.getTime() > now) {
      const waitMinutes = Math.ceil((row.lockedUntil.getTime() - now) / 60000);
      throw new AuthError(
        `Account is temporarily locked due to repeated failed logins. Please try again in ${waitMinutes} minute(s).`,
        'ACCOUNT_LOCKED'
      );
    }

    // Verify credential with Argon2id + pepper
    const isPasswordValid = await verifyCredential(row.passwordHash, password);

    if (!isPasswordValid) {
      const nextFailures = row.failedAttempts + 1;
      const willLock = nextFailures >= MAX_PASSWORD_ATTEMPTS;

      await tx
        .update(staff)
        .set({
          failedAttempts: sql`${staff.failedAttempts} + 1`,
          lockedUntil: willLock ? new Date(now + PASSWORD_LOCKOUT_MS) : row.lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, row.id));

      throw new AuthError(INVALID_CREDENTIALS_MSG, 'INVALID_CREDENTIALS');
    }

    // Reset failed attempts on success
    await tx
      .update(staff)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, row.id));

    return {
      success: true,
      staff: {
        id: row.id,
        name: row.name,
        staffCode: row.staffCode,
        role: row.role,
        mustChangePassword: row.mustChangePassword,
        mustChangePin: row.mustChangePin,
        hasPin: Boolean(row.pinHash),
      },
      message: row.mustChangePassword
        ? 'Login successful. You must update your temporary password before proceeding.'
        : 'Login successful.',
    };
  });
}

/**
 * 2. Verify Staff Fast-Action PIN (Till Unlock / Supervisor Override)
 * -------------------------------------------------------------------------
 * - Validates 4-6 digit numeric PIN.
 * - Pessimistic row lock prevents concurrent brute-force attempts on till.
 * - Isolated PIN lockout (3 failures -> 10 minute lock) with password fallback.
 * - Optional role-based permission verification (e.g. ['supervisor', 'manager', 'admin']).
 */
export async function verifyStaffPin(
  staffId: string,
  pin: string,
  options?: {
    requiredRoles?: Staff['role'][];
    customDb?: DatabaseClient;
  }
): Promise<PinVerifyResult> {
  const db = options?.customDb || defaultDb;
  const cleanPin = pin.trim();

  // Validate format
  if (!/^\d{4,6}$/.test(cleanPin)) {
    return {
      success: false,
      error: 'PIN must be between 4 and 6 numeric digits.',
    };
  }

  return await db.transaction(async (tx) => {
    // Pessimistic Row Lock
    const [row] = await tx
      .select()
      .from(staff)
      .where(eq(staff.id, staffId))
      .for('update')
      .limit(1);

    if (!row || !row.active) {
      return {
        success: false,
        error: 'Staff account not found or deactivated.',
      };
    }

    // Role check if required
    if (options?.requiredRoles && !options.requiredRoles.includes(row.role)) {
      return {
        success: false,
        error: `Action requires supervisor authorization. User has role: ${row.role}.`,
      };
    }

    // Ensure user has enrolled a PIN
    if (!row.pinHash) {
      return {
        success: false,
        error: 'No quick-action PIN is configured for this staff member.',
      };
    }

    // Check PIN lockout
    const now = Date.now();
    if (row.pinLockedUntil && row.pinLockedUntil.getTime() > now) {
      const waitMinutes = Math.ceil((row.pinLockedUntil.getTime() - now) / 60000);
      return {
        success: false,
        error: `PIN entry is locked due to ${MAX_PIN_ATTEMPTS} incorrect attempts. Please retry in ${waitMinutes} minute(s) or use account password.`,
        canFallbackToPassword: true,
      };
    }

    // Verify PIN with Argon2id + pepper
    const isPinValid = await verifyCredential(row.pinHash, cleanPin);

    if (!isPinValid) {
      const nextFailures = row.failedPinAttempts + 1;
      const willLock = nextFailures >= MAX_PIN_ATTEMPTS;

      await tx
        .update(staff)
        .set({
          failedPinAttempts: sql`${staff.failedPinAttempts} + 1`,
          pinLockedUntil: willLock ? new Date(now + PIN_LOCKOUT_MS) : row.pinLockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, row.id));

      return {
        success: false,
        error: willLock
          ? `PIN locked for 10 minutes due to ${MAX_PIN_ATTEMPTS} incorrect attempts.`
          : `Invalid PIN entered. Attempts remaining: ${MAX_PIN_ATTEMPTS - nextFailures}.`,
        canFallbackToPassword: true,
      };
    }

    // Reset failed PIN attempts on success
    if (row.failedPinAttempts > 0 || row.pinLockedUntil !== null) {
      await tx
        .update(staff)
        .set({
          failedPinAttempts: 0,
          pinLockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, row.id));
    }

    return {
      success: true,
      staff: {
        id: row.id,
        name: row.name,
        staffCode: row.staffCode,
        role: row.role,
      },
    };
  });
}

/**
 * 3. Update Staff Password
 */
export async function updateStaffPassword(
  staffId: string,
  newPassword: string,
  customDb?: DatabaseClient
): Promise<{ success: boolean; message: string }> {
  const db = customDb || defaultDb;

  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const hashedPassword = await hashCredential(newPassword);

  await db
    .update(staff)
    .set({
      passwordHash: hashedPassword,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(staff.id, staffId));

  return { success: true, message: 'Password updated successfully.' };
}

/**
 * 4. Enroll or Update Fast-Action PIN
 */
export async function setStaffPin(
  staffId: string,
  newPin: string,
  customDb?: DatabaseClient
): Promise<{ success: boolean; message: string }> {
  const db = customDb || defaultDb;
  const cleanPin = newPin.trim();

  if (!/^\d{4,6}$/.test(cleanPin)) {
    throw new Error('PIN must be 4 to 6 numeric digits.');
  }

  const hashedPin = await hashCredential(cleanPin);

  await db
    .update(staff)
    .set({
      pinHash: hashedPin,
      mustChangePin: false,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(staff.id, staffId));

  return { success: true, message: 'PIN updated successfully.' };
}
