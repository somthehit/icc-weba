// lib/permissions/modules.ts
//
// The permission vocabulary, shared by the API and the admin UI.
//
// Deliberately framework-free (no `server-only`, no React) so the route handler
// that validates a matrix and the form that renders one cannot drift apart — the
// module list existing in two places was how the spec's draft would have let the
// UI offer a module the server silently dropped.

export const SYSTEM_MODULES = [
  {
    key: 'catalog',
    label: 'Products & Inventory',
    desc: 'SKUs, pricing, stock management',
  },
  {
    key: 'orders',
    label: 'Sales & Orders',
    desc: 'Customer orders, invoices, refunds',
  },
  {
    key: 'inquiries',
    label: 'Customer Inquiries / Messages',
    desc: 'Direct messages, leads, WhatsApp',
  },
  {
    key: 'services',
    label: 'Repair & Service Tickets',
    desc: 'Hardware repairs, diagnostics, status',
  },
  {
    key: 'content',
    label: 'Site Content & CMS',
    desc: 'Banners, layout builder, custom pages',
  },
  {
    key: 'users',
    label: 'Staff & User Management',
    desc: 'Managing accounts, roles & audit log',
  },
] as const;

export type ModuleKey = (typeof SYSTEM_MODULES)[number]['key'];

export const MODULE_KEYS = SYSTEM_MODULES.map((m) => m.key) as ModuleKey[];

export const PERMISSION_ACTIONS = ['read', 'write', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type ModulePermissions = Record<PermissionAction, boolean>;
export type PermissionMatrix = Record<ModuleKey, ModulePermissions>;

export const emptyMatrix = (): PermissionMatrix =>
  Object.fromEntries(
    MODULE_KEYS.map((key) => [key, { read: false, write: false, delete: false }]),
  ) as PermissionMatrix;

/**
 * Fills in every module and action from an arbitrary stored object.
 *
 * A matrix read back from `jsonb` predates any module added since it was saved,
 * so indexing it directly yields `undefined` and an uncontrolled checkbox. This
 * makes the shape total before it reaches React.
 */
export const normalizeMatrix = (value: unknown): PermissionMatrix => {
  const source = (value ?? {}) as Record<string, Partial<ModulePermissions>>;
  return Object.fromEntries(
    MODULE_KEYS.map((key) => [
      key,
      {
        read: Boolean(source[key]?.read),
        write: Boolean(source[key]?.write),
        delete: Boolean(source[key]?.delete),
      },
    ]),
  ) as PermissionMatrix;
};

/** Total granted checkboxes — used for the "N of 18" summary on a role card. */
export const countGranted = (matrix: PermissionMatrix): number =>
  MODULE_KEYS.reduce(
    (total, key) => total + PERMISSION_ACTIONS.filter((a) => matrix[key][a]).length,
    0,
  );

export const TOTAL_PERMISSIONS = MODULE_KEYS.length * PERMISSION_ACTIONS.length;

/**
 * `write` and `delete` without `read` is not a coherent grant — every screen that
 * edits a module first lists it. Rather than reject it, the server implies the
 * read so a saved role cannot describe access the UI can't produce.
 */
export const impliedReads = (matrix: PermissionMatrix): PermissionMatrix => {
  const next = normalizeMatrix(matrix);
  for (const key of MODULE_KEYS) {
    if (next[key].write || next[key].delete) next[key].read = true;
  }
  return next;
};

/** URL-safe slug, matching the `^[a-z0-9]+(?:-[a-z0-9]+)*$` shape used elsewhere. */
export const slugifyRole = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const ROLE_ICONS = ['🛡️', '🚚', '🛠️', '💼', '📦', '🧾', '🎧', '🏷️'] as const;
