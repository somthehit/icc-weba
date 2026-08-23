import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, addresses } from './users';
import { products, productVariants } from './catalog';
import { coupons } from './promotions';
import { deliveryZones, deliveryPartners } from './delivery';
import { orderStatusEnum, paymentMethodEnum, paymentStatusEnum } from './enums';

/** The address fields copied onto an order at checkout. */
export interface ShippingAddressSnapshot {
  label: string | null;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  wardNo: string;
  streetAddress: string | null;
  landmark: string | null;
}

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: varchar('order_number', { length: 30 }).notNull(), // e.g. "ICE-2026-1042"
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    status: orderStatusEnum('status').notNull().default('pending'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    deliveryFee: numeric('delivery_fee', { precision: 10, scale: 2 }).notNull().default('0'),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    couponId: integer('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    shippingAddressId: integer('shipping_address_id').references(() => addresses.id, {
      onDelete: 'set null',
    }),
    /**
     * Where the order was sent, frozen at checkout.
     *
     * The FK above is `set null` and customers may edit or delete their saved
     * addresses, so on its own it describes where the parcel *would* go today.
     * `order_items` snapshots product name and SKU for the same reason.
     */
    shippingAddressSnapshot: jsonb('shipping_address_snapshot').$type<ShippingAddressSnapshot>(),
    deliveryZoneId: integer('delivery_zone_id').references(() => deliveryZones.id, {
      onDelete: 'set null',
    }),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    customerNote: text('customer_note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orderNumberIdx: uniqueIndex('orders_order_number_idx').on(t.orderNumber),
    userIdx: index('orders_user_idx').on(t.userId),
    statusIdx: index('orders_status_idx').on(t.status),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: integer('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    // snapshots protect historical order records from later product edits/deletion
    productNameSnapshot: varchar('product_name_snapshot', { length: 200 }).notNull(),
    skuSnapshot: varchar('sku_snapshot', { length: 60 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    orderIdx: index('order_items_order_idx').on(t.orderId),
  }),
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: orderStatusEnum('status').notNull(),
    note: varchar('note', { length: 300 }),
    changedBy: integer('changed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('order_status_history_order_idx').on(t.orderId),
  }),
);

export const shipments = pgTable(
  'shipments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    deliveryPartnerId: integer('delivery_partner_id').references(() => deliveryPartners.id, {
      onDelete: 'set null',
    }),
    riderName: varchar('rider_name', { length: 120 }),
    trackingCode: varchar('tracking_code', { length: 80 }),
    dispatchedAt: timestamp('dispatched_at'),
    deliveredAt: timestamp('delivered_at'),
  },
  (t) => ({
    orderIdx: uniqueIndex('shipments_order_idx').on(t.orderId),
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum('method').notNull(),
    providerTransactionId: varchar('provider_transaction_id', { length: 150 }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    paidAt: timestamp('paid_at'),
    rawResponse: jsonb('raw_response'), // provider (eSewa/Khalti) webhook payload
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('payments_order_idx').on(t.orderId),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  shippingAddress: one(addresses, {
    fields: [orders.shippingAddressId],
    references: [addresses.id],
  }),
  deliveryZone: one(deliveryZones, {
    fields: [orders.deliveryZoneId],
    references: [deliveryZones.id],
  }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  shipment: one(shipments, { fields: [orders.id], references: [shipments.orderId] }),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
  changedByUser: one(users, {
    fields: [orderStatusHistory.changedBy],
    references: [users.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  deliveryPartner: one(deliveryPartners, {
    fields: [shipments.deliveryPartnerId],
    references: [deliveryPartners.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));
