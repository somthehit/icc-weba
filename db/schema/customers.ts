import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { products } from './catalog';

export const customerActivityLogs = pgTable('customer_activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  occurredAt: timestamp('occurred_at').notNull().defaultNow(),
}, (t) => ({ userDateIdx: index('customer_activity_user_date_idx').on(t.userId, t.occurredAt) }));

export const customerProductPreferences = pgTable('customer_product_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  preference: varchar('preference', { length: 12 }).notNull(),
  affinityScore: numeric('affinity_score', { precision: 6, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ userProductIdx: uniqueIndex('customer_product_preferences_user_product_idx').on(t.userId, t.productId) }));

export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: serial('id').primaryKey(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 150 }).notNull(),
  channel: varchar('channel', { length: 12 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  body: text('body').notNull(),
  audience: jsonb('audience').$type<Record<string, unknown>>().notNull().default({}),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  convertedCount: integer('converted_count').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
