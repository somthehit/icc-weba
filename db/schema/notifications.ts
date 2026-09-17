import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Customer-facing notification inbox.
 *
 * Notifications are created server-side when meaningful events happen
 * (order status changes, warranty registrations, price drops, etc.).
 * Customers can mark individual notifications as read or mark all as read.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 50 }).notNull().default('info'),
    // order_update, warranty, price_drop, promotion, system, etc.
    relatedOrderId: integer('related_order_id'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId),
    userReadIdx: index('notifications_user_read_idx').on(t.userId, t.read),
  }),
);

/**
 * OTP codes for phone verification.
 *
 * Each row is short-lived (5 minutes). The verify endpoint checks
 * the latest unused code for the given phone number.
 */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: serial('id').primaryKey(),
    phone: varchar('phone', { length: 15 }).notNull(),
    code: varchar('code', { length: 6 }).notNull(),
    purpose: varchar('purpose', { length: 30 }).notNull().default('phone_verify'),
    // phone_verify, login, etc.
    used: boolean('used').notNull().default(false),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    phoneIdx: index('otp_phone_idx').on(t.phone),
  }),
);
