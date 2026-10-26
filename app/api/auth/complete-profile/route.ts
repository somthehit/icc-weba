import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, addresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { nepaliPhoneSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

const completeProfileSchema = z.object({
  phone: nepaliPhoneSchema,
  address: z.object({
    label: z.string().trim().min(1).max(50).default('Home'),
    province: z.enum([
      'koshi',
      'madhesh',
      'bagmati',
      'gandaki',
      'lumbini',
      'karnali',
      'sudurpashchim',
    ] as const),
    district: z.string().trim().min(2, 'District is required').max(100),
    municipality: z.string().trim().min(2, 'Municipality is required').max(150),
    wardNo: z.string().trim().min(1, 'Ward number is required').max(10),
    tole: z.string().trim().max(255).optional(),
    streetAddress: z.string().trim().max(255).optional(),
    houseNumber: z.string().trim().max(50).optional(),
    landmark: z.string().trim().max(255).optional(),
  }),
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, completeProfileSchema);
    if (!parsed.ok) return parsed.response;
    const { phone, address } = parsed.data;

    const result = await db.transaction(async (tx) => {
      // 1. Update user phone number
      const [updatedUser] = await tx
        .update(users)
        .set({
          phone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          avatarUrl: users.avatarUrl,
        });

      if (!updatedUser) {
        return null;
      }

      // 2. Check if user already has an address saved
      const [existingAddr] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, user.userId))
        .limit(1);

      if (existingAddr) {
        await tx
          .update(addresses)
          .set({
            fullName: updatedUser.name,
            phone,
            province: address.province,
            district: address.district,
            municipality: address.municipality,
            wardNo: address.wardNo,
            tole: address.tole || null,
            streetAddress: address.streetAddress || null,
            houseNumber: address.houseNumber || null,
            landmark: address.landmark || null,
            isDefault: true,
          })
          .where(eq(addresses.id, existingAddr.id));
      } else {
        await tx.insert(addresses).values({
          userId: user.userId,
          label: address.label || 'Home',
          fullName: updatedUser.name,
          phone,
          province: address.province,
          district: address.district,
          municipality: address.municipality,
          wardNo: address.wardNo,
          tole: address.tole || null,
          streetAddress: address.streetAddress || null,
          houseNumber: address.houseNumber || null,
          landmark: address.landmark || null,
          isDefault: true,
        });
      }

      return updatedUser;
    });

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: result,
      needsProfileSetup: false,
    });
  } catch (error) {
    console.error('Error completing customer profile:', error);
    return NextResponse.json(
      { error: 'Failed to complete profile' },
      { status: 500 },
    );
  }
});
