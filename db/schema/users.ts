import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
  text,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRoleEnum, provinceEnum, staffRoleEnum, shiftStatusEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 200 }).notNull(),
    phone: varchar('phone', { length: 15 }), // Nepali format e.g. 98XXXXXXXX — validate at app layer
    passwordHash: varchar('password_hash', { length: 255 }),
    role: userRoleEnum('role').notNull().default('customer'),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    emailVerifiedAt: timestamp('email_verified_at'),
    invitedBy: integer('invited_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    phoneIdx: index('users_phone_idx').on(t.phone),
    roleIdx: index('users_role_idx').on(t.role),
  }),
);

export const addresses = pgTable(
  'addresses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 50 }).default('Home'), // Home / Office / Other
    fullName: varchar('full_name', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 15 }).notNull(),
    province: provinceEnum('province').notNull(),
    district: varchar('district', { length: 100 }).notNull(),
    municipality: varchar('municipality', { length: 150 }).notNull(),
    wardNo: varchar('ward_no', { length: 10 }).notNull(),
    streetAddress: varchar('street_address', { length: 255 }),
    landmark: varchar('landmark', { length: 255 }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('addresses_user_idx').on(t.userId),
  }),
);

export const staffProfiles = pgTable(
  'staff_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
    staffRole: staffRoleEnum('staff_role').notNull(),
    department: varchar('department', { length: 120 }),
    skills: text('skills').array().notNull().default([]),
    specialization: varchar('specialization', { length: 180 }),
    vehicleNumber: varchar('vehicle_number', { length: 40 }),
    drivingLicenseNo: varchar('driving_license_no', { length: 60 }),
    shiftStatus: shiftStatusEnum('shift_status').notNull().default('OFF_DUTY'),
    assignedCount: integer('assigned_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({ roleIdx: index('staff_profiles_role_idx').on(t.staffRole) }),
);

export const usersRelations = relations(users, ({ many, one }) => ({
  addresses: many(addresses),
  staffProfile: one(staffProfiles, { fields: [users.id], references: [staffProfiles.userId] }),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
  user: one(users, { fields: [staffProfiles.userId], references: [users.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));
