import { NextResponse } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

/**
 * Verify a 6-digit OTP code for phone number verification.
 *
 * POST /api/auth/otp/verify
 * Body: { phone: string, code: string }
 *
 * Checks the latest unused, unexpired code for the given phone.
 * On success, marks the OTP as used so it cannot be reused.
 */

const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+?977)/, ''))
    .refine((v) => /^9[678]\d{8}$/.test(v), {
      message: 'Enter a valid 10-digit Nepali mobile number',
    }),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, verifyOtpSchema);
    if (!parsed.ok) return parsed.response;

    const { phone, code } = parsed.data;

    // Find the latest unused, unexpired OTP for this phone
    const now = new Date();
    const [otpRow] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, phone),
          eq(otpCodes.code, code),
          eq(otpCodes.used, false),
          eq(otpCodes.purpose, 'phone_verify'),
          gt(otpCodes.expiresAt, now),
        ),
      )
      .orderBy(otpCodes.id)
      .limit(1);

    if (!otpRow) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a new one.' },
        { status: 400 },
      );
    }

    // Mark OTP as used
    await db
      .update(otpCodes)
      .set({ used: true })
      .where(eq(otpCodes.id, otpRow.id));

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
});
