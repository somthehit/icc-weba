// db/schema/accounting.ts
//
// Practical shop books: suppliers, expenses and purchase bills.
//
// Deliberately not double-entry. There are no accounts, journal entries or trial
// balance here — this is the set of records a hardware shop actually keeps, and
// which the reports can turn into arithmetic anyone in the shop can check by hand:
//
//   revenue (orders) - COGS (order_items.unit_cost_snapshot) = gross profit
//   gross profit - expenses                                  = net profit
//   VAT collected (orders) - VAT paid (expenses + bills)      = VAT payable
//   purchase_bills.total_amount - amount_paid                = accounts payable
//
// See drizzle/migrations/0006_shop_books.sql for the DDL these mirror.

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { products } from './catalog';

export const suppliers = pgTable(
  'suppliers',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    contactPerson: varchar('contact_person', { length: 120 }),
    phone: varchar('phone', { length: 15 }),
    email: varchar('email', { length: 160 }),
    address: varchar('address', { length: 300 }),
    // Nepal PAN/VAT registration number. Required on a purchase bill for the VAT
    // paid on it to be claimable, so it sits on the supplier, not per-bill.
    vatPanNo: varchar('vat_pan_no', { length: 30 }),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex('suppliers_name_idx').on(t.name),
  }),
);

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 300 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex('expense_categories_name_idx').on(t.name),
  }),
);

/**
 * Money out that is not stock: rent, salaries, electricity, marketing.
 *
 * `vatAmount` is the VAT *contained in* `amount`, not additional to it, so
 * `amount` is always the total that left the till and the P&L cannot
 * double-count VAT.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 300 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    // `mode: 'string'` to match `products.releaseDate` — dates cross the API as
    // 'YYYY-MM-DD' and never pick up a timezone on the way.
    expenseDate: date('expense_date', { mode: 'string' }).notNull(),
    paymentMethod: varchar('payment_method', { length: 40 }).notNull().default('cash'),
    referenceNo: varchar('reference_no', { length: 60 }),
    recordedBy: integer('recorded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    dateIdx: index('expenses_date_idx').on(t.expenseDate),
    categoryIdx: index('expenses_category_idx').on(t.categoryId),
  }),
);

export type PurchaseBillStatus = 'unpaid' | 'partial' | 'paid';

/**
 * Stock bought from a supplier, possibly on credit.
 *
 * `amountPaid` against `totalAmount` is what makes accounts payable ageable;
 * `status` is a denormalization of that comparison, kept so the payables list can
 * filter on an index instead of a computed expression.
 */
export const purchaseBills = pgTable(
  'purchase_bills',
  {
    id: serial('id').primaryKey(),
    // restrict, not cascade: deleting a supplier must not erase the bills proving
    // what was owed to them. Deactivate the supplier instead.
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    billNumber: varchar('bill_number', { length: 60 }).notNull(),
    billDate: date('bill_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
    status: varchar('status', { length: 20 })
      .$type<PurchaseBillStatus>()
      .notNull()
      .default('unpaid'),
    notes: text('notes'),
    recordedBy: integer('recorded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    // Two suppliers may both issue "INV-001", so uniqueness is on the pair.
    supplierNumberIdx: uniqueIndex('purchase_bills_supplier_number_idx').on(
      t.supplierId,
      t.billNumber,
    ),
    statusIdx: index('purchase_bills_status_idx').on(t.status),
    dueDateIdx: index('purchase_bills_due_date_idx').on(t.dueDate),
  }),
);

export const purchaseBillItems = pgTable(
  'purchase_bill_items',
  {
    id: serial('id').primaryKey(),
    // cascade, unlike the bill->supplier edge: a bill's lines are part of the
    // bill rather than records in their own right.
    billId: integer('bill_id')
      .notNull()
      .references(() => purchaseBills.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    // Free text as well as the FK: a line may be for something not in the
    // catalogue (packaging, a one-off part), and this is what the paper bill said
    // even after the product row is renamed.
    description: varchar('description', { length: 300 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    billIdx: index('purchase_bill_items_bill_idx').on(t.billId),
  }),
);

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  bills: many(purchaseBills),
  expenses: many(expenses),
}));

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  supplier: one(suppliers, { fields: [expenses.supplierId], references: [suppliers.id] }),
  recorder: one(users, { fields: [expenses.recordedBy], references: [users.id] }),
}));

export const purchaseBillsRelations = relations(purchaseBills, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchaseBills.supplierId], references: [suppliers.id] }),
  recorder: one(users, { fields: [purchaseBills.recordedBy], references: [users.id] }),
  items: many(purchaseBillItems),
}));

export const purchaseBillItemsRelations = relations(purchaseBillItems, ({ one }) => ({
  bill: one(purchaseBills, {
    fields: [purchaseBillItems.billId],
    references: [purchaseBills.id],
  }),
  product: one(products, { fields: [purchaseBillItems.productId], references: [products.id] }),
}));
