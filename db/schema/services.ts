import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
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
    subject: varchar('subject', { length: 200 }).notNull(),
    description: text('description'),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    status: ticketStatusEnum('status').notNull().default('open'),
    priority: ticketPriorityEnum('priority').notNull().default('normal'),
    assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
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
