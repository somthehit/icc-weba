import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

/**
 * Self-service profile update.
 *
 * PUT /api/users/me
 * Body: { name?: string, phone?: string }
 *
 * Customers can update their own name and phone number.
 * Phone updates require prior OTP verification (checked client-side).
 */

const updateMeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150).optional(),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+?977)/, ''))
    .refine((v) => v === '' || /^9[678]\d{8}$/.test(v), {
      message: 'Enter a valid 10-digit Nepali mobile number',
    })
    .optional()
    .or(z.literal('')),
});

export const PUT = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, updateMeSchema);
    if (!parsed.ok) return parsed.response;

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }

    if (parsed.data.phone !== undefined) {
      // Allow clearing phone with empty string
      updates.phone = parsed.data.phone || null;
    }

    // Only update if there's something to update
    if (Object.keys(updates).length <= 1) {
      // Only updatedAt
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      });

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
});
