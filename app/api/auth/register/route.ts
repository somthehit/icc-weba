import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, signToken } from '@/lib/auth/utils';
import { AUTH_COOKIE, JWT_MAX_AGE_SECONDS } from '@/lib/auth/jwt';
import { parseJson } from '@/lib/validation/parse';
import { registerSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    // `registerSchema` has no `role` field, so a request asking for
    // `role: 'admin'` gets a customer account like everyone else. Staff accounts
    // are created from the admin console, never from this public endpoint.
    const parsed = await parseJson(request, registerSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, password, phone } = parsed.data;

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        phone,
        passwordHash,
        role: 'customer',
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
      });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({ success: true, user }, { status: 201 });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
