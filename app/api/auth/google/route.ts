import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth/utils';
import { AUTH_COOKIE, JWT_MAX_AGE_SECONDS } from '@/lib/auth/jwt';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

const googleAuthSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  email: z.string().email('A valid email is required'),
  avatarUrl: z.string().url().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJson(request, googleAuthSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, avatarUrl } = parsed.data;

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

    let user: { id: number; name: string; email: string; phone: string | null; role: string; avatarUrl: string | null; isActive: boolean };

    if (existingUser) {
      // Update avatar if Google provides one and the user doesn't have one yet
      if (avatarUrl && !existingUser.avatarUrl) {
        await db
          .update(users)
          .set({ avatarUrl, updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
        existingUser.avatarUrl = avatarUrl;
      }
      user = existingUser;
    } else {
      // Create a new customer account (passwordless — social login)
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          avatarUrl: avatarUrl || null,
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
