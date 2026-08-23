import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { products, productVariants } from './catalog';
import { provinceEnum } from './enums';

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(), // e.g. "Kathmandu Warehouse"
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

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  inventory: many(inventory),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
  warehouse: one(warehouses, { fields: [inventory.warehouseId], references: [warehouses.id] }),
}));
