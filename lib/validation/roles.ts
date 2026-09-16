import { z } from 'zod';

import {
  MODULE_KEYS,
  PERMISSION_ACTIONS,
  ROLE_ICONS,
  type PermissionMatrix,
} from '@/lib/permissions/modules';

const actionsSchema = z.object({
  read: z.boolean(),
  write: z.boolean(),
  delete: z.boolean(),
});

/**
 * The matrix, keyed by module.
 *
 * Every module is required rather than optional so a partial body cannot leave a
 * module undefined in storage — that is what produces uncontrolled checkboxes when
 * the role is edited later. Unknown keys are stripped by `z.object`, so a client
 * inventing `{ billing: {...} }` cannot smuggle a module the UI does not render.
 */
export const permissionMatrixSchema = z.object(
  Object.fromEntries(MODULE_KEYS.map((key) => [key, actionsSchema])) as Record<
    (typeof MODULE_KEYS)[number],
    typeof actionsSchema
  >,
);

/** Rejects an all-false matrix: a role that grants nothing is a configuration mistake. */
const hasAnyGrant = (matrix: PermissionMatrix) =>
  MODULE_KEYS.some((key) => PERMISSION_ACTIONS.some((action) => matrix[key][action]));

const roleNameSchema = z
  .string()
  .trim()
  .min(3, 'Role title must be at least 3 characters')
  .max(80, 'Role title is too long')
  // Blocks a name that slugifies to nothing ("!!!"), which would otherwise hit the
  // unique index as an empty string and collide with the next such name.
  .refine((value) => /[a-z0-9]/i.test(value), {
    message: 'Role title needs at least one letter or number',
  });

export const createRoleSchema = z
  .object({
    roleName: roleNameSchema,
    description: z.string().trim().max(500).optional().or(z.literal('')),
    icon: z.enum(ROLE_ICONS).default('🛡️'),
    permissions: permissionMatrixSchema,
  })
  .refine((data) => hasAnyGrant(data.permissions as PermissionMatrix), {
    message: 'Grant at least one permission',
    path: ['permissions'],
  });

export const updateRoleSchema = z
  .object({
    roleName: roleNameSchema.optional(),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    icon: z.enum(ROLE_ICONS).optional(),
    permissions: permissionMatrixSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(
    (data) => !data.permissions || hasAnyGrant(data.permissions as PermissionMatrix),
    { message: 'Grant at least one permission', path: ['permissions'] },
  );

export const roleIdParamSchema = z.coerce.number().int().positive();
