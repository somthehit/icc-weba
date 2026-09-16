import {
  pgTable,
  serial,
  varchar,
  numeric,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { deliveryPartnerTypeEnum } from './enums';

export const deliveryZones = pgTable('delivery_zones', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(), // "Kailali Valley", "Outside Valley (Terai)"
  provinces: varchar('provinces', { length: 300 }), // comma-separated province codes covered
  districts: varchar('districts', { length: 500 }),
  municipalities: varchar('municipalities', { length: 1000 }),
  flatFee: numeric('flat_fee', { precision: 10, scale: 2 }).notNull(),
  estimatedDays: integer('estimated_days').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
});

export const deliveryPartners = pgTable('delivery_partners', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(), // "In-house Riders", "Pathao Courier"
  type: deliveryPartnerTypeEnum('type').notNull().default('in_house'),
  contactPhone: varchar('contact_phone', { length: 15 }),
  isActive: boolean('is_active').notNull().default(true),
});
