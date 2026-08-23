import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, addresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, STAFF_ROLES, type UserRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import {
  idParamSchema,
  updateOwnProfileSchema,
  updateUserAsStaffSchema,
} from '@/lib/validation/schemas';

const publicUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  avatarUrl: users.avatarUrl,
  isActive: users.isActive,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

type RouteContext = { params: Promise<{ id: string }> };

const isStaff = (role: string) => STAFF_ROLES.includes(role as UserRole);

/**
 * A signed-in caller may read their own record; staff may read anyone's. The
 * middleware only checks that the session exists, so the ownership rule has to
 * live here, where the row's owner is known.
 */
export const GET = withAuth<RouteContext>(async (_request, { user }, context) => {
  try {
    const { id } = await context.params;
    const parsedId = idParamSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const userId = parsedId.data;

    if (userId !== user.userId && !isStaff(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [record] = await db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId));

    return NextResponse.json({ ...record, addresses: userAddresses });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
});

/**
 * The previous version spread the whole body into `update`, so a customer could
 * PUT `{ role: 'admin' }` — or a new `passwordHash` — onto their own record. The
 * schema is now chosen by the caller's role and only ever contains fields that
 * role is allowed to set.
 */
export const PUT = withAuth<RouteContext>(async (request, { user }, context) => {
  try {
    const { id } = await context.params;
    const parsedId = idParamSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const userId = parsedId.data;

    const callerIsStaff = isStaff(user.role);
    if (userId !== user.userId && !callerIsStaff) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Only a full admin may hand out roles or deactivate accounts; other staff
    // editing a record get the same field set as a customer.
    const schema = user.role === 'admin' ? updateUserAsStaffSchema : updateOwnProfileSchema;
    const parsed = await parseJson(request, schema);
    if (!parsed.ok) return parsed.response;

    // An admin demoting themselves would lock the console for everyone if they
    // were the last one, so that has to go through another admin.
    if ('role' in parsed.data && parsed.data.role && userId === user.userId) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(publicUserColumns);

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
});

/** Soft delete. Admin-only: deactivating an account is not a self-service action. */
export const DELETE = withAuth<RouteContext>(async (_request, { user }, context) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await context.params;
    const parsedId = idParamSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const userId = parsedId.data;

    if (userId === user.userId) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 },
      );
    }

    const [deleted] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
});
