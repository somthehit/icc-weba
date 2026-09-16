import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { withAuth } from '@/lib/auth/middleware';
import { comparePassword, hashPassword } from '@/lib/auth/utils';
import { parseJson } from '@/lib/validation/parse';
import { changePasswordSchema } from '@/lib/validation/schemas';

/**
 * Changes the signed-in user's password.
 *
 * Separate from `PUT /api/users/[id]` on purpose — that route's schema excludes
 * `passwordHash` precisely so a field patch can never set it. Here the current
 * password is verified first, so the write is authorised by knowledge of the
 * secret rather than by owning the session alone.
 */
export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, changePasswordSchema);
    if (!parsed.ok) return parsed.response;

    const { currentPassword, newPassword } = parsed.data;

    const [record] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // An account created through a social provider has no local password to
    // compare against, so there is nothing to "change" — it has to be set.
    if (!record.passwordHash) {
      return NextResponse.json(
        { error: 'This account has no password set. Use password reset instead.' },
        { status: 400 },
      );
    }

    const matches = await comparePassword(currentPassword, record.passwordHash);
    if (!matches) {
      // Deliberately vague, and the same shape as any other failure: a precise
      // message here is an oracle for guessing the current password.
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 },
      );
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
});
