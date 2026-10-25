// db/schema/warehouse-enterprise.ts
// Enterprise Warehouse, Barcode, Serialized Stock, Bins, Transfers, Audits, Returns, and Warranty schema

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
  jsonb,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { products } from './catalog';
import { warehouses, inventoryMovements } from './inventory';
import { suppliers, purchaseOrders, goodsReceiptNotes, goodsReceiptNoteItems } from './accounting';

// =============================================================================
// 1. WAREHOUSE BINS (Zone -> Rack -> Shelf -> Bin)
// =============================================================================
export const warehouseBins = pgTable(
  'warehouse_bins',
  {
    id: serial('id').primaryKey(),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    zone: varchar('zone', { length: 30 }).notNull().default('A'), // Zone e.g. A, B, Bulk
    rack: varchar('rack', { length: 30 }).notNull().default('01'), // Rack e.g. R01, R02
    shelf: varchar('shelf', { length: 30 }).notNull().default('S1'), // Shelf e.g. S1, S2
    bin: varchar('bin', { length: 30 }).notNull().default('B01'), // Bin e.g. B01, B02
    code: varchar('code', { length: 60 }).notNull(), // Formatted code e.g. "WH1-Z-A-R01-S1-B01"
    description: varchar('description', { length: 150 }),
    capacityUnits: integer('capacity_units').notNull().default(100),
    currentUsage: integer('current_usage').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    binCodeIdx: uniqueIndex('warehouse_bins_code_idx').on(t.code),
    warehouseIdx: index('warehouse_bins_warehouse_idx').on(t.warehouseId),
  })
);

// =============================================================================
// 2. PRODUCT SERIALS / IMEI TRACKING (Laptops, Phones, Printers, CCTV, NVRs)
// =============================================================================
export type SerialStatus =
  | 'in_stock'
  | 'allocated'
  | 'sold'
  | 'returned'
  | 'under_repair'
  | 'rma_vendor'
  | 'scrapped';

export const productSerials = pgTable(
  'product_serials',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    serialNumber: varchar('serial_number', { length: 100 }).notNull(),
    grnItemId: integer('grn_item_id').references(() => goodsReceiptNoteItems.id, {
      onDelete: 'set null',
    }),
    grnId: integer('grn_id').references(() => goodsReceiptNotes.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 30 })
      .$type<SerialStatus>()
      .notNull()
      .default('in_stock'),
    warehouseId: integer('warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    binId: integer('bin_id').references(() => warehouseBins.id, {
      onDelete: 'set null',
    }),
    costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
    sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }),
    warrantyMonths: integer('warranty_months').notNull().default(12),
    warrantyStartDate: date('warranty_start_date', { mode: 'string' }),
    warrantyEndDate: date('warranty_end_date', { mode: 'string' }),
    soldInvoiceNo: varchar('sold_invoice_no', { length: 60 }),
    soldDate: timestamp('sold_date'),
    customerId: integer('customer_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    serialProductIdx: uniqueIndex('product_serials_product_serial_idx').on(
      t.productId,
      t.serialNumber
    ),
    serialNumberIdx: index('product_serials_serial_number_idx').on(t.serialNumber),
    statusIdx: index('product_serials_status_idx').on(t.status),
    warehouseIdx: index('product_serials_warehouse_idx').on(t.warehouseId),
  })
);

// =============================================================================
// 3. PRODUCT BATCHES & LOT TRACKING
// =============================================================================
export const productBatches = pgTable(
  'product_batches',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    batchNumber: varchar('batch_number', { length: 80 }).notNull(),
    grnId: integer('grn_id').references(() => goodsReceiptNotes.id, { onDelete: 'set null' }),
    initialQuantity: integer('initial_quantity').notNull().default(0),
    currentQuantity: integer('current_quantity').notNull().default(0),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull().default('0'),
    manufacturingDate: date('manufacturing_date', { mode: 'string' }),
    expiryDate: date('expiry_date', { mode: 'string' }),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    productBatchIdx: uniqueIndex('product_batches_prod_batch_idx').on(
      t.productId,
      t.batchNumber
    ),
    expiryIdx: index('product_batches_expiry_idx').on(t.expiryDate),
  })
);

// =============================================================================
// 4. INTER-LOCATION STOCK TRANSFERS
// =============================================================================
export type TransferStatus =
  | 'draft'
  | 'requested'
  | 'approved'
  | 'in_transit'
  | 'received'
  | 'discrepancy'
  | 'cancelled';

export const stockTransfers = pgTable(
  'stock_transfers',
  {
    id: serial('id').primaryKey(),
    transferNumber: varchar('transfer_number', { length: 60 }).notNull(), // e.g. "TRF-2026-0001"
    sourceWarehouseId: integer('source_warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    destWarehouseId: integer('dest_warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 30 })
      .$type<TransferStatus>()
      .notNull()
      .default('draft'),
    totalItems: integer('total_items').notNull().default(0),
    totalQuantity: integer('total_quantity').notNull().default(0),
    notes: text('notes'),
    requestedById: integer('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
    requestedByName: varchar('requested_by_name', { length: 150 }),
    approvedById: integer('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    approvedByName: varchar('approved_by_name', { length: 150 }),
    shippedAt: timestamp('shipped_at'),
    receivedAt: timestamp('received_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    transferNumberIdx: uniqueIndex('stock_transfers_number_idx').on(t.transferNumber),
    statusIdx: index('stock_transfers_status_idx').on(t.status),
    sourceIdx: index('stock_transfers_source_idx').on(t.sourceWarehouseId),
    destIdx: index('stock_transfers_dest_idx').on(t.destWarehouseId),
  })
);

export const stockTransferItems = pgTable(
  'stock_transfer_items',
  {
    id: serial('id').primaryKey(),
    transferId: integer('transfer_id')
      .notNull()
      .references(() => stockTransfers.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 60 }).notNull(),
    quantityRequested: integer('quantity_requested').notNull().default(1),
    quantityShipped: integer('quantity_shipped').notNull().default(0),
    quantityReceived: integer('quantity_received').notNull().default(0),
    discrepancyNote: varchar('discrepancy_note', { length: 300 }),
  },
  (t) => ({
    transferIdx: index('stock_transfer_items_transfer_idx').on(t.transferId),
  })
);

// =============================================================================
// 5. PHYSICAL AUDIT & CYCLE COUNT SESSIONS
// =============================================================================
export type AuditSessionStatus =
  | 'in_progress'
  | 'pending_approval'
  | 'reconciled'
  | 'cancelled';

export type AuditSessionType = 'full' | 'cycle_category' | 'cycle_zone' | 'abc_high_value';

export const auditSessions = pgTable(
  'audit_sessions',
  {
    id: serial('id').primaryKey(),
    sessionNumber: varchar('session_number', { length: 60 }).notNull(), // e.g. "AUD-2026-0001"
    title: varchar('title', { length: 150 }).notNull(),
    auditType: varchar('audit_type', { length: 30 })
      .$type<AuditSessionType>()
      .notNull()
      .default('full'),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 30 })
      .$type<AuditSessionStatus>()
      .notNull()
      .default('in_progress'),
    blindCountEnabled: boolean('blind_count_enabled').notNull().default(true),
    totalSkusCounted: integer('total_skus_counted').notNull().default(0),
    totalVarianceQty: integer('total_variance_qty').notNull().default(0),
    totalVarianceValue: numeric('total_variance_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    startedById: integer('started_by_id').references(() => users.id, { onDelete: 'set null' }),
    startedByName: varchar('started_by_name', { length: 150 }),
    approvedById: integer('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    approvedByName: varchar('approved_by_name', { length: 150 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    sessionNumberIdx: uniqueIndex('audit_sessions_number_idx').on(t.sessionNumber),
    statusIdx: index('audit_sessions_status_idx').on(t.status),
    warehouseIdx: index('audit_sessions_warehouse_idx').on(t.warehouseId),
  })
);

export const auditSessionItems = pgTable(
  'audit_session_items',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 60 }).notNull(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    systemQtySnapshot: integer('system_qty_snapshot').notNull().default(0),
    physicalCountQty: integer('physical_count_qty').notNull().default(0),
    varianceQty: integer('variance_qty').notNull().default(0), // physical - system
    unitCostSnapshot: numeric('unit_cost_snapshot', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    varianceValue: numeric('variance_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    isRecounted: boolean('is_recounted').notNull().default(false),
    status: varchar('status', { length: 30 }).notNull().default('counted'), // counted, verified, discrepancy
    notes: text('notes'),
  },
  (t) => ({
    sessionIdx: index('audit_session_items_session_idx').on(t.sessionId),
    productIdx: index('audit_session_items_product_idx').on(t.productId),
  })
);

// =============================================================================
// 6. RETURNS & RETURN-TO-VENDOR (DEBIT NOTES)
// =============================================================================
export type ReturnType = 'customer_return' | 'return_to_vendor';
export type ReturnStatus = 'draft' | 'approved' | 'completed' | 'rejected';

export const stockReturns = pgTable(
  'stock_returns',
  {
    id: serial('id').primaryKey(),
    returnNumber: varchar('return_number', { length: 60 }).notNull(), // e.g. "RET-2026-0001" or "RTV-2026-0001"
    returnType: varchar('return_type', { length: 30 })
      .$type<ReturnType>()
      .notNull()
      .default('customer_return'),
    referenceInvoiceOrPo: varchar('reference_invoice_or_po', { length: 80 }),
    supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 30 })
      .$type<ReturnStatus>()
      .notNull()
      .default('draft'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    reason: varchar('reason', { length: 200 }).notNull(),
    notes: text('notes'),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdByName: varchar('created_by_name', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    returnNumberIdx: uniqueIndex('stock_returns_number_idx').on(t.returnNumber),
    typeIdx: index('stock_returns_type_idx').on(t.returnType),
    statusIdx: index('stock_returns_status_idx').on(t.status),
  })
);

export const stockReturnItems = pgTable(
  'stock_return_items',
  {
    id: serial('id').primaryKey(),
    returnId: integer('return_id')
      .notNull()
      .references(() => stockReturns.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    serialId: integer('serial_id').references(() => productSerials.id, { onDelete: 'set null' }),
    sku: varchar('sku', { length: 60 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull().default('0'),
    action: varchar('action', { length: 40 })
      .$type<'restock' | 'scrap_damage' | 'vendor_credit'>()
      .notNull()
      .default('restock'),
    notes: text('notes'),
  },
  (t) => ({
    returnIdx: index('stock_return_items_return_idx').on(t.returnId),
  })
);

// =============================================================================
// 7. WARRANTY & RMA TRACKING
// =============================================================================
export type ClaimStatus =
  | 'received'
  | 'under_inspection'
  | 'rma_vendor'
  | 'repaired'
  | 'replaced'
  | 'closed_rejected';

export const warrantyClaims = pgTable(
  'warranty_claims',
  {
    id: serial('id').primaryKey(),
    claimNumber: varchar('claim_number', { length: 60 }).notNull(), // e.g. "RMA-2026-0001"
    serialId: integer('serial_id').references(() => productSerials.id, { onDelete: 'set null' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    customerName: varchar('customer_name', { length: 150 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 30 }).notNull(),
    customerEmail: varchar('customer_email', { length: 150 }),
    invoiceNumber: varchar('invoice_number', { length: 80 }),
    issueDescription: text('issue_description').notNull(),
    warrantyStatus: varchar('warranty_status', { length: 30 })
      .$type<'under_warranty' | 'out_of_warranty'>()
      .notNull()
      .default('under_warranty'),
    claimStatus: varchar('claim_status', { length: 30 })
      .$type<ClaimStatus>()
      .notNull()
      .default('received'),
    technicianNotes: text('technician_notes'),
    resolution: text('resolution'),
    supplierRmaNumber: varchar('supplier_rma_number', { length: 80 }),
    supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    receivedDate: date('received_date', { mode: 'string' }).notNull(),
    resolvedDate: date('resolved_date', { mode: 'string' }),
    handledById: integer('handled_by_id').references(() => users.id, { onDelete: 'set null' }),
    handledByName: varchar('handled_by_name', { length: 150 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    claimNumberIdx: uniqueIndex('warranty_claims_number_idx').on(t.claimNumber),
    claimStatusIdx: index('warranty_claims_status_idx').on(t.claimStatus),
    serialIdx: index('warranty_claims_serial_idx').on(t.serialId),
  })
);

// =============================================================================
// 8. INVENTORY ALERTS
// =============================================================================
export type InventoryAlertType =
  | 'low_stock'
  | 'out_of_stock'
  | 'po_overdue'
  | 'large_adjustment'
  | 'negative_attempt'
  | 'warranty_expiring';

export const inventoryAlerts = pgTable(
  'inventory_alerts',
  {
    id: serial('id').primaryKey(),
    alertType: varchar('alert_type', { length: 40 })
      .$type<InventoryAlertType>()
      .notNull(),
    severity: varchar('severity', { length: 20 })
      .$type<'info' | 'warning' | 'critical'>()
      .notNull()
      .default('warning'),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    referenceId: varchar('reference_id', { length: 80 }),
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    isResolved: boolean('is_resolved').notNull().default(false),
    resolvedById: integer('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    alertTypeIdx: index('inventory_alerts_type_idx').on(t.alertType),
    isResolvedIdx: index('inventory_alerts_resolved_idx').on(t.isResolved),
    createdAtIdx: index('inventory_alerts_created_idx').on(t.createdAt.desc()),
  })
);

// =============================================================================
// RELATIONS
// =============================================================================
export const warehouseBinsRelations = relations(warehouseBins, ({ one, many }) => ({
  warehouse: one(warehouses, { fields: [warehouseBins.warehouseId], references: [warehouses.id] }),
  serials: many(productSerials),
}));

export const productSerialsRelations = relations(productSerials, ({ one, many }) => ({
  product: one(products, { fields: [productSerials.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [productSerials.warehouseId], references: [warehouses.id] }),
  bin: one(warehouseBins, { fields: [productSerials.binId], references: [warehouseBins.id] }),
  grnItem: one(goodsReceiptNoteItems, {
    fields: [productSerials.grnItemId],
    references: [goodsReceiptNoteItems.id],
  }),
  warrantyClaims: many(warrantyClaims),
}));

export const productBatchesRelations = relations(productBatches, ({ one }) => ({
  product: one(products, { fields: [productBatches.productId], references: [products.id] }),
  grn: one(goodsReceiptNotes, { fields: [productBatches.grnId], references: [goodsReceiptNotes.id] }),
}));

export const stockTransfersRelations = relations(stockTransfers, ({ one, many }) => ({
  sourceWarehouse: one(warehouses, {
    fields: [stockTransfers.sourceWarehouseId],
    references: [warehouses.id],
  }),
  destWarehouse: one(warehouses, {
    fields: [stockTransfers.destWarehouseId],
    references: [warehouses.id],
  }),
  items: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({ one }) => ({
  transfer: one(stockTransfers, {
    fields: [stockTransferItems.transferId],
    references: [stockTransfers.id],
  }),
  product: one(products, { fields: [stockTransferItems.productId], references: [products.id] }),
}));

export const auditSessionsRelations = relations(auditSessions, ({ one, many }) => ({
  warehouse: one(warehouses, { fields: [auditSessions.warehouseId], references: [warehouses.id] }),
  items: many(auditSessionItems),
}));

export const auditSessionItemsRelations = relations(auditSessionItems, ({ one }) => ({
  session: one(auditSessions, { fields: [auditSessionItems.sessionId], references: [auditSessions.id] }),
  product: one(products, { fields: [auditSessionItems.productId], references: [products.id] }),
}));

export const stockReturnsRelations = relations(stockReturns, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [stockReturns.supplierId], references: [suppliers.id] }),
  items: many(stockReturnItems),
}));

export const stockReturnItemsRelations = relations(stockReturnItems, ({ one }) => ({
  returnRecord: one(stockReturns, { fields: [stockReturnItems.returnId], references: [stockReturns.id] }),
  product: one(products, { fields: [stockReturnItems.productId], references: [products.id] }),
  serial: one(productSerials, { fields: [stockReturnItems.serialId], references: [productSerials.id] }),
}));

export const warrantyClaimsRelations = relations(warrantyClaims, ({ one }) => ({
  product: one(products, { fields: [warrantyClaims.productId], references: [products.id] }),
  serial: one(productSerials, { fields: [warrantyClaims.serialId], references: [productSerials.id] }),
  supplier: one(suppliers, { fields: [warrantyClaims.supplierId], references: [suppliers.id] }),
}));
