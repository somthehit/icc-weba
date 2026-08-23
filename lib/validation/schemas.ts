// lib/validation/schemas.ts
//
// Shared request shapes. Kept apart from the route handlers so the same rules
// apply wherever a field is accepted — a password minimum defined in one place
// cannot drift from the one enforced somewhere else.

import { z } from 'zod';

export const USER_ROLES = [
  'customer',
  'admin',
  'sales',
  'inventory_manager',
  'service_technician',
] as const;

export const userRoleSchema = z.enum(USER_ROLES);

/**
 * Nepali mobile numbers are ten digits starting with 97/98, optionally written
 * with the +977 country code or spaces and dashes. Stored normalised so two
 * spellings of the same number don't become two customers.
 */
export const nepaliPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, '').replace(/^(\+?977)/, ''))
  .refine((value) => /^9[678]\d{8}$/.test(value), {
    message: 'Enter a 10-digit Nepali mobile number, e.g. 9851084291',
  });

export const emailSchema = z.email({ message: 'Enter a valid email address' }).trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long');

export const loginSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: an existing account may predate the current rule and
  // still needs to be able to sign in (and be told to change it).
  password: z.string().min(1, 'Password is required'),
});

/**
 * Public self-registration. `role` is deliberately absent — accepting it here is
 * what let anyone create themselves an admin account. Staff accounts are created
 * from the admin console instead.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(150),
  email: emailSchema,
  password: passwordSchema,
  phone: nepaliPhoneSchema.optional(),
});

/** Staff-created accounts, where setting a role is legitimate. */
export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(150),
  email: emailSchema,
  password: passwordSchema.optional(),
  phone: nepaliPhoneSchema.optional(),
  role: userRoleSchema.default('customer'),
  avatarUrl: z.url().max(500).optional(),
});

/**
 * Fields a customer may change on their own record. Note the absence of `role`,
 * `passwordHash`, `isActive` and `emailVerifiedAt`.
 */
export const updateOwnProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: nepaliPhoneSchema.optional(),
    avatarUrl: z.url().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

/** Everything above, plus the fields only staff may set. */
export const updateUserAsStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: nepaliPhoneSchema.optional(),
    avatarUrl: z.url().max(500).optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

/** A positive integer arriving as a string in a path or query parameter. */
export const idParamSchema = z.coerce.number().int().positive();
