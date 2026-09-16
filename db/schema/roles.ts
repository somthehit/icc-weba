// db/schema/roles.ts
//
// Dynamic access roles.
//
// `users.role` is a fixed pg enum (`user_role`) that the JWT carries and that
// `withRole`/middleware check. That enum cannot grow at runtime, so anything the
// shop wants to define itself — "Logistics Lead", "Front Desk" — lives here
// instead, as a row with a permission matrix.
//
// See the note on `permissions` about what this table does and does not yet do.

import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql as raw } from 'drizzle-orm';

import type { PermissionMatrix } from '@/lib/permissions/modules';
import { users } from './users';

export const customRoles = pgTable(
  'custom_roles',
  {
    id: serial('id').primaryKey(),
    roleName: varchar('role_name', { length: 80 }).notNull(),
    /** Derived from `roleName`; the uniqueness key, so "Store Lead" and "store-lead" collide. */
    roleSlug: varchar('role_slug', { length: 60 }).notNull(),
    description: text('description'),
    /** A single emoji. Wide enough for a multi-codepoint glyph plus a variation selector. */
    icon: varchar('icon', { length: 16 }).notNull().default('🛡️'),
    /**
     * `{ catalog: { read, write, delete }, ... }` keyed by `ModuleKey`.
     *
     * IMPORTANT: this is a *definition*, not an enforcement point. Authorisation
     * today is driven by the `user_role` enum in the JWT, checked by
     * `middleware.ts` and the `withRole` guards. Nothing reads this column when a
     * request is authorised, so granting a permission here does not by itself let
     * anyone through. Wiring it up means resolving a user's matrix in the auth
     * layer and replacing the role checks with permission checks.
     */
    permissions: jsonb('permissions')
      .$type<PermissionMatrix>()
      .notNull()
      // Raw SQL rather than `.default({})`: an empty object is not a complete
      // `PermissionMatrix`, and this mirrors the column default the migration
      // actually created. Rows are passed through `normalizeMatrix` on read, which
      // is what makes a sparse stored value safe.
      .default(raw`'{}'::jsonb`),
    /**
     * True for the five roles that mirror `staff_role`. They are shown so the
     * matrix reads as a complete picture, but cannot be edited or deleted — their
     * real behaviour is compiled into the middleware, so letting someone edit the
     * row would only make it lie.
     */
    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('custom_roles_slug_idx').on(t.roleSlug),
    systemIdx: index('custom_roles_system_idx').on(t.isSystem),
  }),
);

export const customRolesRelations = relations(customRoles, ({ one, many }) => ({
  author: one(users, { fields: [customRoles.createdBy], references: [users.id] }),
  assignments: many(staffRoleAssignments),
}));

/**
 * Which staff member holds which custom role.
 *
 * A join table rather than a `custom_role_id` column on `staff_profiles` for two
 * reasons: it keeps both foreign keys in this file, avoiding a circular import
 * between `users.ts` and `roles.ts` that would need a lazy `AnyPgColumn`
 * reference to resolve; and `DELETE /api/v1/roles/:id` has to refuse when a role
 * is still assigned, which is a single count here.
 *
 * `userIdx` is unique, so a staff member holds at most one custom role — the same
 * semantics a column would have given.
 */
export const staffRoleAssignments = pgTable(
  'staff_role_assignments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    customRoleId: integer('custom_role_id')
      .notNull()
      .references(() => customRoles.id, { onDelete: 'restrict' }),
    assignedBy: integer('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: uniqueIndex('staff_role_assignments_user_idx').on(t.userId),
    roleIdx: index('staff_role_assignments_role_idx').on(t.customRoleId),
  }),
);

export const staffRoleAssignmentsRelations = relations(staffRoleAssignments, ({ one }) => ({
  role: one(customRoles, {
    fields: [staffRoleAssignments.customRoleId],
    references: [customRoles.id],
  }),
  user: one(users, { fields: [staffRoleAssignments.userId], references: [users.id] }),
}));
