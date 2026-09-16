import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { products } from './catalog';
import { ticketTypeEnum, ticketStatusEnum, ticketPriorityEnum } from './enums';

export const serviceTickets = pgTable(
  'service_tickets',
  {
    id: serial('id').primaryKey(),
    ticketNumber: varchar('ticket_number', { length: 30 }).notNull(), // e.g. "SVC-223"
    customerId: integer('customer_id').references(() => users.id, { onDelete: 'set null' }),
    type: ticketTypeEnum('type').notNull(),
    channel: varchar('channel', { length: 20 }).notNull().default('OFFLINE_WALKIN'),
    workflowStatus: varchar('workflow_status', { length: 30 }).notNull().default('PENDING_INSPECTION'),
    subject: varchar('subject', { length: 200 }).notNull(),
    description: text('description'),
    deviceBrand: varchar('device_brand', { length: 100 }),
    deviceModel: varchar('device_model', { length: 150 }),
    serialNumber: varchar('serial_number', { length: 120 }),
    conditionChecklist: jsonb('condition_checklist').$type<Record<string, boolean>>(),
    lockCode: varchar('lock_code', { length: 120 }),
    preferredDate: timestamp('preferred_date'),
    preferredTime: varchar('preferred_time', { length: 80 }),
    serviceAddress: varchar('service_address', { length: 500 }),
    advanceAmount: numeric('advance_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    status: ticketStatusEnum('status').notNull().default('open'),
    priority: ticketPriorityEnum('priority').notNull().default('normal'),
    assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    // What the customer was billed for the job. The table previously had no
    // monetary column at all, which is why the console's service-revenue figure had
    // no data source. Nullable: a warranty claim or a site survey may be free.
    chargedAmount: numeric('charged_amount', { precision: 12, scale: 2 }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    ticketNumberIdx: uniqueIndex('service_tickets_ticket_number_idx').on(t.ticketNumber),
    statusIdx: index('service_tickets_status_idx').on(t.status),
    assignedIdx: index('service_tickets_assigned_idx').on(t.assignedTo),
  }),
);

export const serviceTicketsRelations = relations(serviceTickets, ({ one }) => ({
  customer: one(users, { fields: [serviceTickets.customerId], references: [users.id] }),
  product: one(products, { fields: [serviceTickets.productId], references: [products.id] }),
  assignee: one(users, { fields: [serviceTickets.assignedTo], references: [users.id] }),
}));

export const serviceActivityLogs = pgTable('service_activity_logs', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => serviceTickets.id, { onDelete: 'cascade' }),
  activityType: varchar('activity_type', { length: 40 }).notNull(),
  message: text('message').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ ticketIdx: index('service_activity_ticket_idx').on(t.ticketId, t.createdAt) }));
