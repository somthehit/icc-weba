import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, addresses } from '@/db/schema';
import { eq, desc, ilike, sql, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { withRole } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/utils';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { createUserSchema, userRoleSchema } from '@/lib/validation/schemas';

/**
 * Explicit projection. `select()` used to return the whole row, which meant an
 * unauthenticated `GET /api/users` handed out every customer's bcrypt hash — so
 * the column list is now the contract, and `passwordHash` is not in it.
 */
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

const listQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  email: z.string().trim().toLowerCase().optional(),
  search: z.string().trim().max(100).optional(),
  role: userRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Staff-only directory. Customers read their own record via /api/users/[id]. */
export const GET = withRole(['admin'], async (request: NextRequest) => {
  try {
    const parsed = parseQuery(request.url, listQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { id, email, search, role, limit, offset } = parsed.data;

    if (id) {
      const [user] = await db
        .select(publicUserColumns)
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const userAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, user.id));

      return NextResponse.json({ ...user, addresses: userAddresses });
    }

    if (email) {
      const [user] = await db
        .select(publicUserColumns)
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json(user);
    }

    // Search and role compose instead of shadowing each other, which is what the
    // previous nested ternary did.
    const conditions: SQL[] = [];
    if (search) conditions.push(ilike(users.name, `%${search}%`));
    if (role) conditions.push(eq(users.role, role));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select(publicUserColumns)
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Counted with the same filter, so paging maths reflects the filtered set.
    const [stats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where);

    return NextResponse.json({
      users: results,
      total: stats?.count ?? results.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
});

/**
 * Staff account creation. Takes a plaintext `password` and hashes it here; the
 * route used to accept a `passwordHash` straight from the body, which let a
 * caller install a hash they already knew the password for.
 */
export const POST = withRole(['admin'], async (request: NextRequest) => {
  try {
    const parsed = await parseJson(request, createUserSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, password, phone, role, avatarUrl } = parsed.data;

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Staff need a password to sign in; a customer record created on someone's
    // behalf may legitimately have none until they set one.
    if (!password && role !== 'customer') {
      return NextResponse.json(
        { error: 'A password is required for staff accounts' },
        { status: 400 },
      );
    }

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        phone,
        passwordHash: password ? await hashPassword(password) : null,
        role,
        avatarUrl,
      })
      .returning(publicUserColumns);

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
});
