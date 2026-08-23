import {
  pgTable,
  serial,
  integer,
  varchar,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orders } from './orders';
import { deliveryPartners } from './delivery';
import { users } from './users';

export const driverLocations = pgTable(
  'driver_locations',
  {
    id: serial('id').primaryKey(),
    driverId: integer('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
    accuracy: numeric('accuracy', { precision: 8, scale: 2 }),
    speed: numeric('speed', { precision: 6, scale: 2 }),
    heading: numeric('heading', { precision: 6, scale: 2 }),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    driverIdx: index('driver_locations_driver_idx').on(t.driverId),
    timestampIdx: index('driver_locations_timestamp_idx').on(t.timestamp),
  }),
);

export const deliveryRoutes = pgTable(
  'delivery_routes',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    driverId: integer('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deliveryPartnerId: integer('delivery_partner_id').references(
      () => deliveryPartners.id,
      { onDelete: 'set null' },
    ),
    status: varchar('status', { length: 30 }).notNull().default('assigned'),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
    pickedUpAt: timestamp('picked_up_at'),
    inTransitAt: timestamp('in_transit_at'),
    deliveredAt: timestamp('delivered_at'),
    failedAt: timestamp('failed_at'),
    failureReason: varchar('failure_reason', { length: 300 }),
    proofOfDelivery: jsonb('proof_of_delivery'),
    deliveryNotes: varchar('delivery_notes', { length: 500 }),
    estimatedArrival: timestamp('estimated_arrival'),
    distanceKm: numeric('distance_km', { precision: 8, scale: 2 }),
    routePolyline: varchar('route_polyline', { length: 5000 }),
    stopSequence: integer('stop_sequence').default(0),
  },
  (t) => ({
    orderIdx: index('delivery_routes_order_idx').on(t.orderId),
    driverIdx: index('delivery_routes_driver_idx').on(t.driverId),
    statusIdx: index('delivery_routes_status_idx').on(t.status),
  }),
);

export const driverLocationsRelations = relations(driverLocations, ({ one }) => ({
  driver: one(users, {
    fields: [driverLocations.driverId],
    references: [users.id],
  }),
}));

export const deliveryRoutesRelations = relations(deliveryRoutes, ({ one }) => ({
  order: one(orders, {
    fields: [deliveryRoutes.orderId],
    references: [orders.id],
  }),
  driver: one(users, {
    fields: [deliveryRoutes.driverId],
    references: [users.id],
  }),
  deliveryPartner: one(deliveryPartners, {
    fields: [deliveryRoutes.deliveryPartnerId],
    references: [deliveryPartners.id],
  }),
}));
