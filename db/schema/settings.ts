import {
  pgTable,
  serial,
  varchar,
  boolean,
  numeric,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { paymentMethodEnum, notificationEventEnum, provinceEnum } from './enums';

// Single-row table holding store-wide configuration (read the one row your app expects)
export const storeProfile = pgTable('store_profile', {
  id: serial('id').primaryKey(),
  storeName: varchar('store_name', { length: 150 }).notNull().default('ICE Computers & Electronics'),
  contactEmail: varchar('contact_email', { length: 200 }),
  contactPhone: varchar('contact_phone', { length: 15 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  province: provinceEnum('province'),
  district: varchar('district', { length: 100 }),
  municipality: varchar('municipality', { length: 150 }),
  wardNo: varchar('ward_no', { length: 10 }),
  currency: varchar('currency', { length: 10 }).notNull().default('NPR'),
  vatRatePercent: numeric('vat_rate_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('13.00'),
  pricesIncludeVat: boolean('prices_include_vat').notNull().default(true),
  freeDeliveryThreshold: numeric('free_delivery_threshold', { precision: 12, scale: 2 })
    .notNull()
    .default('50000.00'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const paymentMethodSettings = pgTable(
  'payment_method_settings',
  {
    id: serial('id').primaryKey(),
    method: paymentMethodEnum('method').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    merchantId: varchar('merchant_id', { length: 150 }),
    // never store the raw secret — encrypt at the application layer before insert
    secretKeyEncrypted: varchar('secret_key_encrypted', { length: 500 }),
    config: jsonb('config'), // extra provider-specific fields (webhook URLs, etc.)
  },
  (t) => ({
    methodIdx: uniqueIndex('payment_method_settings_method_idx').on(t.method),
  }),
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: serial('id').primaryKey(),
    eventType: notificationEventEnum('event_type').notNull(),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    smsEnabled: boolean('sms_enabled').notNull().default(false),
  },
  (t) => ({
    eventIdx: uniqueIndex('notification_preferences_event_idx').on(t.eventType),
  }),
);
