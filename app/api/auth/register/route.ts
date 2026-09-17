import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, addresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, signToken } from '@/lib/auth/utils';
import { AUTH_COOKIE, JWT_MAX_AGE_SECONDS } from '@/lib/auth/jwt';
import { parseJson } from '@/lib/validation/parse';
import { registerSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJson(request, registerSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, password, phone, address } = parsed.data;

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
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

      if (address) {
        await tx.insert(addresses).values({
          userId: user.id,
          label: 'Home',
          fullName: name,
          phone: phone || '',
          province: address.province,
          district: address.district,
          municipality: address.municipality,
          wardNo: address.wardNo,
          tole: address.tole || null,
          houseNumber: address.houseNumber || null,
          isDefault: true,
        });
      }

      return user;
    });

    const token = await signToken({
      userId: result.id,
      email: result.email,
      role: result.role,
    });

    const response = NextResponse.json({ success: true, user: result }, { status: 201 });

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
