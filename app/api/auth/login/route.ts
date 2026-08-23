import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { comparePassword, signToken } from '@/lib/auth/utils';
import { AUTH_COOKIE, JWT_MAX_AGE_SECONDS } from '@/lib/auth/jwt';
import { parseJson } from '@/lib/validation/parse';
import { loginSchema } from '@/lib/validation/schemas';

/** Same wording for every failure, so the response can't be used to enumerate accounts. */
const INVALID_CREDENTIALS = 'Invalid email or password';

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJson(request, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // A missing account, a passwordless account and a wrong password all answer
    // identically: telling them apart tells an attacker which emails are real.
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // Checked after the password so a deactivated account isn't discoverable
    // without knowing its password.
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

    // The token goes out only as an httpOnly cookie. Returning it in the body as
    // well would put it somewhere JavaScript — and therefore any XSS — can read.
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
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
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
