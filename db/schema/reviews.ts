import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { products } from './catalog';
import { orders } from './orders';

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }), // verified purchase
    rating: integer('rating').notNull(), // 1-5, validate at app layer
    title: varchar('title', { length: 150 }),
    comment: text('comment'),
    images: jsonb('images').$type<Array<{ url: string; caption?: string }>>().notNull().default([]),
    // The hardware review form (components/HardwareReviewsSection.tsx) collects
    // more than a star rating: where the reviewer is from, their rig, and
    // per-aspect scores. Stored here so those submissions survive a round-trip.
    userCity: varchar('user_city', { length: 120 }),
    hardwareSetup: varchar('hardware_setup', { length: 300 }),
    componentAspect: varchar('component_aspect', { length: 60 }),
    // { thermals, buildQuality, acoustics, performance, value } — all optional,
    // all 1-5. jsonb keeps the aspect list open without a migration per aspect.
    componentRatings: jsonb('component_ratings').$type<Record<string, number>>(),
    pros: jsonb('pros').$type<string[]>(),
    cons: jsonb('cons').$type<string[]>(),
    isApproved: boolean('is_approved').notNull().default(false),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    helpfulCount: integer('helpful_count').notNull().default(0),
    adminResponse: text('admin_response'),
    adminResponseAt: timestamp('admin_response_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index('reviews_product_idx').on(t.productId),
    approvedIdx: index('reviews_is_approved_idx').on(t.isApproved),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
}));
