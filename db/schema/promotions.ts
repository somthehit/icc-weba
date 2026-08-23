import {
  pgTable,
  serial,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { discountTypeEnum } from './enums';

export const coupons = pgTable(
  'coupons',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 40 }).notNull(),
    discountType: discountTypeEnum('discount_type').notNull(),
    discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull(),
    minOrderValue: numeric('min_order_value', { precision: 12, scale: 2 }).default('0'),
    maxDiscountAmount: numeric('max_discount_amount', { precision: 12, scale: 2 }),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex('coupons_code_idx').on(t.code),
  }),
);
