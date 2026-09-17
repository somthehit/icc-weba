import { NextResponse } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

/**
 * Send a 6-digit OTP to a phone number for verification.
 *
 * POST /api/auth/otp/send
 * Body: { phone: string }
 *
 * The OTP is stored in the database with a 5-minute expiry.
 * In production, integrate with Sparrow SMS or similar to actually deliver the code.
 * For now, the code is returned in the response for development/testing.
 */

const sendOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+?977)/, ''))
    .refine((v) => /^9[678]\d{8}$/.test(v), {
      message: 'Enter a valid 10-digit Nepali mobile number',
    }),
});

// Rate limit: max 3 OTPs per phone per 10 minutes
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_OTPS_PER_WINDOW = 3;

export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, sendOtpSchema);
    if (!parsed.ok) return parsed.response;

    const phone = parsed.data.phone;

    // Rate limit check: count recent OTPs for this phone
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const countResult = await db
      .select({ count: otpCodes.id })
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, phone),
          eq(otpCodes.purpose, 'phone_verify'),
          eq(otpCodes.used, false),
          gt(otpCodes.createdAt, windowStart),
        ),
      );

    if (countResult.length >= MAX_OTPS_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes before trying again.' },
        { status: 429 },
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database
    await db.insert(otpCodes).values({
      phone,
      code,
      purpose: 'phone_verify',
      expiresAt,
    });

    // TODO: In production, send SMS via Sparrow/Aakash SMS gateway
    // For now, log the code for development
    console.log(`[OTP] Phone: ${phone}, Code: ${code}, Expires: ${expiresAt.toISOString()}`);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to +977 ${phone}`,
      // Include code in dev mode only — remove in production
      ...(process.env.NODE_ENV === 'development' && { devCode: code }),
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
});
