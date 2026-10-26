import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, addresses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromRequest } from '@/lib/auth/utils';

export async function GET(request: NextRequest) {
  try {
    const payload = await getUserFromRequest(request);

    if (!payload) {
      return NextResponse.json({ user: null });
    }

    const userIdStr = String(payload.userId || '');

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userIdStr))
      .limit(1);

    if (user) {
      if (!user.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 403 },
        );
      }

      let needsProfileSetup = false;
      if (user.role === 'customer') {
        const hasPhone = Boolean(user.phone && user.phone.trim().length >= 10);
        const [addr] = await db
          .select({ id: addresses.id })
          .from(addresses)
          .where(eq(addresses.userId, user.id))
          .limit(1);
        needsProfileSetup = !hasPhone || !addr;
      }

      return NextResponse.json({
        user: {
          ...user,
          needsProfileSetup,
        },
        needsProfileSetup,
      });
    }

    // Otherwise, check if it is a staff UUID from pos-enterprise
    const { staff } = await import('@/db/schema/pos-enterprise');
    const [staffMember] = await db
      .select({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        active: staff.active,
        createdAt: staff.createdAt,
      })
      .from(staff)
      .where(eq(staff.id, userIdStr))
      .limit(1);

    if (staffMember) {
      if (!staffMember.active) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 403 },
        );
      }

      return NextResponse.json({
        user: {
          id: staffMember.id,
          name: staffMember.name,
          email: staffMember.email,
          phone: staffMember.phone,
          role: staffMember.role,
          avatarUrl: null,
          isActive: staffMember.active,
          createdAt: staffMember.createdAt,
        },
      });
    }

    return NextResponse.json({ user: null });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 },
    );
  }
}
