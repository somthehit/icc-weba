import { NextResponse } from 'next/server';
import { asc, eq, sql as raw } from 'drizzle-orm';

import { db } from '@/db';
import { customRoles, staffRoleAssignments } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { impliedReads, normalizeMatrix, slugifyRole } from '@/lib/permissions/modules';
import { parseJson } from '@/lib/validation/parse';
import { createRoleSchema } from '@/lib/validation/roles';

/**
 * Access roles.
 *
 * Admin-only: the ability to define who can do what is itself the most sensitive
 * permission in the console, so this is not delegated to other staff roles.
 */

/**
 * System roles first, then custom ones alphabetically — the seeded five are the
 * reference the operator compares their own roles against, so they belong at the
 * top rather than interleaved by id.
 */
export const GET = withRole(['admin'], async () => {
  try {
    const rows = await db
      .select({
        id: customRoles.id,
        roleName: customRoles.roleName,
        roleSlug: customRoles.roleSlug,
        description: customRoles.description,
        icon: customRoles.icon,
        permissions: customRoles.permissions,
        isSystem: customRoles.isSystem,
        isActive: customRoles.isActive,
        createdAt: customRoles.createdAt,
        // Drives the delete guard in the UI, so the button can be disabled with a
        // reason instead of the user discovering the 409 by clicking it.
        assignedCount: raw<number>`(
          select count(*)::int from ${staffRoleAssignments}
          where ${staffRoleAssignments.customRoleId} = ${customRoles.id}
        )`,
      })
      .from(customRoles)
      .orderBy(raw`${customRoles.isSystem} desc`, asc(customRoles.roleName));

    return NextResponse.json({
      // Normalised on the way out so a row stored before a module was added still
      // yields a complete matrix for the form.
      roles: rows.map((row) => ({ ...row, permissions: normalizeMatrix(row.permissions) })),
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
});

export const POST = withRole(['admin'], async (request, { user }) => {
  try {
    const parsed = await parseJson(request, createRoleSchema);
    if (!parsed.ok) return parsed.response;

    const { roleName, description, icon, permissions } = parsed.data;
    const roleSlug = slugifyRole(roleName);

    // Checked before insert so the response can name the conflict; the unique index
    // is still the authority, and the 23505 catch below covers the race.
    const [clash] = await db
      .select({ id: customRoles.id, roleName: customRoles.roleName })
      .from(customRoles)
      .where(eq(customRoles.roleSlug, roleSlug))
      .limit(1);

    if (clash) {
      return NextResponse.json(
        { error: `"${clash.roleName}" already uses that name.` },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(customRoles)
      .values({
        roleName,
        roleSlug,
        description: description || null,
        icon,
        // `write`/`delete` without `read` is incoherent, so the read is implied
        // rather than stored as an unreachable grant.
        permissions: impliedReads(permissions),
        isSystem: false,
        createdBy: user.userId,
      })
      .returning();

    return NextResponse.json(
      { success: true, role: { ...created, permissions: normalizeMatrix(created.permissions), assignedCount: 0 } },
      { status: 201 },
    );
  } catch (error) {
    // Two admins creating the same name at once: the pre-check passes for both and
    // the index rejects the loser.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'That role name is already taken.' }, { status: 409 });
    }
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
});
