import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { products, productVariants } from './catalog';
import { orders } from './orders';
import { expenses } from './accounting';
import { users } from './users';
import { inventoryMovementReasonEnum, provinceEnum } from './enums';

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(), // e.g. "Kailali Warehouse"
  province: provinceEnum('province'),
  district: varchar('district', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
});

export const inventory = pgTable(
  'inventory',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id').references(() => productVariants.id, {
      onDelete: 'cascade',
    }),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    // reserved by pending/unpaid orders so the same unit can't be double-sold
    quantityReserved: integer('quantity_reserved').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(3),
    reorderPoint: integer('reorder_point').notNull().default(10),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    productWarehouseIdx: uniqueIndex('inventory_product_warehouse_idx').on(
      t.productId,
      t.variantId,
      t.warehouseId,
    ),
    lowStockIdx: index('inventory_low_stock_idx').on(t.quantityOnHand),
  }),
);

/**
 * Every change to a stock figure, and why — see
 * drizzle/migrations/0008_inventory_movements.sql for the full rationale.
 *
 * Append-only, enforced by a `BEFORE UPDATE OR DELETE` trigger in the database. There
 * is no update or delete path in this codebase and there must not be one; a mistake is
 * corrected by writing a compensating movement with `reversesMovementId` set. Write
 * rows through `lib/inventory/movements.ts` rather than inserting here directly, so the
 * warehouse mirror and the write-off expense stay in step with the ledger.
 */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial('id').primaryKey(),
    // restrict: a ledger that cascades away with the product is not a ledger.
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    variantId: integer('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    // Nullable: a manual adjustment always names a warehouse, but a sale comes off
    // `products.stockQuantity`, which is not per-warehouse. Null means "against the
    // authoritative product-level count".
    warehouseId: integer('warehouse_id').references(() => warehouses.id, {
      onDelete: 'restrict',
    }),
    // Snapshots, matching the order_items precedent — the log must still read
    // correctly after a rename or a re-SKU.
    productNameSnapshot: varchar('product_name_snapshot', { length: 200 }).notNull(),
    skuSnapshot: varchar('sku_snapshot', { length: 60 }).notNull(),
    // Signed, and never zero (CHECK constraint in the migration).
    quantityDelta: integer('quantity_delta').notNull(),
    // On-hand immediately after this movement. Makes the ledger self-verifying:
    // consecutive rows for one product chain, and the newest must equal
    // products.stockQuantity.
    quantityAfter: integer('quantity_after').notNull(),
    reason: inventoryMovementReasonEnum('reason').notNull(),
    // Cost at the moment of the movement, so a later cost-price edit cannot change
    // what a past write-off was worth. Null when no cost was on record.
    unitCostSnapshot: numeric('unit_cost_snapshot', { precision: 12, scale: 2 }),
    note: varchar('note', { length: 500 }),
    // Damage report number, supplier invoice, stock count sheet — the spec's
    // `referenceId`, e.g. "DMG-2026-0811".
    referenceNo: varchar('reference_no', { length: 60 }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    // The expenses row this movement booked, for write-offs with a known cost.
    expenseId: integer('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
    reversesMovementId: integer('reverses_movement_id').references(
      (): AnyPgColumn => inventoryMovements.id,
      { onDelete: 'restrict' },
    ),
    performedBy: integer('performed_by').references(() => users.id, { onDelete: 'set null' }),
    // Name snapshot so "who did this" survives the user being deactivated.
    performedByName: varchar('performed_by_name', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    // One reversal per movement: two people both clicking Reverse on the same
    // fat-fingered adjustment would otherwise double-correct it.
    reversesIdx: uniqueIndex('inventory_movements_reverses_idx')
      .on(t.reversesMovementId)
      .where(sql`${t.reversesMovementId} IS NOT NULL`),
    productCreatedIdx: index('inventory_movements_product_created_idx').on(
      t.productId,
      t.createdAt.desc(),
    ),
    createdIdx: index('inventory_movements_created_idx').on(t.createdAt.desc()),
    reasonIdx: index('inventory_movements_reason_idx').on(t.reason),
    performedByIdx: index('inventory_movements_performed_by_idx').on(t.performedBy),
    warehouseIdx: index('inventory_movements_warehouse_idx').on(t.warehouseId),
    orderIdx: index('inventory_movements_order_idx').on(t.orderId),
  }),
);

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  inventory: many(inventory),
  movements: many(inventoryMovements),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
  warehouse: one(warehouses, { fields: [inventory.warehouseId], references: [warehouses.id] }),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  product: one(products, {
    fields: [inventoryMovements.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [inventoryMovements.variantId],
    references: [productVariants.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventoryMovements.warehouseId],
    references: [warehouses.id],
  }),
  order: one(orders, { fields: [inventoryMovements.orderId], references: [orders.id] }),
  expense: one(expenses, { fields: [inventoryMovements.expenseId], references: [expenses.id] }),
  performer: one(users, { fields: [inventoryMovements.performedBy], references: [users.id] }),
}));
