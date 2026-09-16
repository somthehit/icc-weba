import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { customRoles, staffRoleAssignments } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { impliedReads, normalizeMatrix, slugifyRole } from '@/lib/permissions/modules';
import { parseJson } from '@/lib/validation/parse';
import { roleIdParamSchema, updateRoleSchema } from '@/lib/validation/roles';

type RouteContext = { params: Promise<{ id: string }> };

const parseId = async (context: RouteContext) => {
  const { id } = await context.params;
  const parsed = roleIdParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
};

/**
 * Updates a role's metadata or its permission matrix.
 *
 * A system role is read-only. Its real behaviour is compiled into `middleware.ts`
 * and the `withRole` guards, so an editable row could only ever disagree with what
 * the server actually enforces — which is worse than not offering the edit.
 */
export const PUT = withRole<RouteContext>(['admin'], async (request, _auth, context) => {
  try {
    const id = await parseId(context);
    if (id === null) {
      return NextResponse.json({ error: 'Invalid role id' }, { status: 400 });
    }

    const parsed = await parseJson(request, updateRoleSchema);
    if (!parsed.ok) return parsed.response;

    const [existing] = await db
      .select({ id: customRoles.id, isSystem: customRoles.isSystem, roleName: customRoles.roleName })
      .from(customRoles)
      .where(eq(customRoles.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: `"${existing.roleName}" is a built-in role and cannot be edited.` },
        { status: 403 },
      );
    }

    const { roleName, description, icon, permissions, isActive } = parsed.data;

    // Renaming re-derives the slug, which has to stay unique against every *other*
    // row — hence the `ne(id)`, so saving a role without renaming it does not
    // collide with itself.
    let roleSlug: string | undefined;
    if (roleName) {
      roleSlug = slugifyRole(roleName);
      const [clash] = await db
        .select({ id: customRoles.id })
        .from(customRoles)
        .where(and(eq(customRoles.roleSlug, roleSlug), ne(customRoles.id, id)))
        .limit(1);

      if (clash) {
        return NextResponse.json({ error: 'That role name is already taken.' }, { status: 409 });
      }
    }

    const [updated] = await db
      .update(customRoles)
      .set({
        ...(roleName ? { roleName, roleSlug } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(icon ? { icon } : {}),
        ...(permissions ? { permissions: impliedReads(permissions) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(customRoles.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      role: { ...updated, permissions: normalizeMatrix(updated.permissions) },
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'That role name is already taken.' }, { status: 409 });
    }
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
});

/**
 * Deletes a custom role.
 *
 * Refused while any staff member still holds it. The FK is `ON DELETE RESTRICT`
 * as a backstop, but the count is checked first so the caller gets a 409 naming
 * how many assignments are in the way rather than a raw constraint error.
 */
export const DELETE = withRole<RouteContext>(['admin'], async (_request, _auth, context) => {
  try {
    const id = await parseId(context);
    if (id === null) {
      return NextResponse.json({ error: 'Invalid role id' }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: customRoles.id, isSystem: customRoles.isSystem, roleName: customRoles.roleName })
      .from(customRoles)
      .where(eq(customRoles.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: `"${existing.roleName}" is a built-in role and cannot be deleted.` },
        { status: 403 },
      );
    }

    const assignments = await db
      .select({ userId: staffRoleAssignments.userId })
      .from(staffRoleAssignments)
      .where(eq(staffRoleAssignments.customRoleId, id));

    if (assignments.length > 0) {
      return NextResponse.json(
        {
          error: `"${existing.roleName}" is assigned to ${assignments.length} staff member${
            assignments.length === 1 ? '' : 's'
          }. Reassign them before deleting it.`,
          assignedCount: assignments.length,
        },
        { status: 409 },
      );
    }

    await db.delete(customRoles).where(eq(customRoles.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    // 23503: something still references the row despite the check above.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503') {
      return NextResponse.json(
        { error: 'That role is still in use and cannot be deleted.' },
        { status: 409 },
      );
    }
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
});
