import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, addresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth/utils';
import { AUTH_COOKIE, JWT_MAX_AGE_SECONDS } from '@/lib/auth/jwt';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

const googleAuthSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  email: z.string().email('A valid email is required'),
  avatarUrl: z.string().max(1000).optional().nullable().or(z.literal('')),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJson(request, googleAuthSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, avatarUrl } = parsed.data;

    const cleanedAvatar = avatarUrl && avatarUrl.trim() ? avatarUrl.trim().slice(0, 500) : null;

    // Look for an existing user with this email
    const [existingUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let user: { id: string; name: string; email: string; phone: string | null; role: string; avatarUrl: string | null; isActive: boolean };

    if (existingUser) {
      // Always update avatar if Google provides a new one or existing has none
      if (cleanedAvatar && existingUser.avatarUrl !== cleanedAvatar) {
        await db
          .update(users)
          .set({ avatarUrl: cleanedAvatar, updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
        existingUser.avatarUrl = cleanedAvatar;
      }
      user = existingUser;
    } else {
      // Create a new customer account (passwordless — social login)
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          avatarUrl: cleanedAvatar,
          role: 'customer',
          emailVerifiedAt: new Date(),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          avatarUrl: users.avatarUrl,
          isActive: users.isActive,
        });
      user = newUser;
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'This account has been deactivated. Please contact the store.' },
        { status: 403 },
      );
    }

    // Check if customer already has a phone number and at least one delivery address
    const hasPhone = Boolean(user.phone && user.phone.trim().length >= 10);
    const [userAddress] = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .limit(1);
    const hasAddress = Boolean(userAddress);
    const needsProfileSetup = !hasPhone || !hasAddress;

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      needsProfileSetup,
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error with Google auth:', error);
    return NextResponse.json({ error: 'Failed to authenticate with Google' }, { status: 500 });
  }
}
