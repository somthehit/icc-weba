// lib/queries/inventory.ts
//
// Admin-side inventory reads. Like lib/queries/registry.ts these are plain functions
// over Drizzle rather than fetches, so a server component can call them directly
// later without going back out through HTTP.
//
// Every total, count and valuation here is computed by Postgres. Nothing pages rows
// into JavaScript and reduces them: a "Total stock value" summed in the browser is a
// total of the current page, which is the kind of number that looks right and is
// wrong.
//
// Two figures that look redundant and are not:
//
//   - `stockQuantity` is `products.stock_quantity`, the authoritative count that
//     checkout decrements and pricing enforces.
//   - `warehouseQuantity` is the `inventory` mirror. `drift` says whether they
//     disagree. It should always be false; surfacing it is the only way to find out
//     if something wrote stock without going through `lib/inventory/movements.ts`.

import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '@/db';
import {
  brands,
  categories,
  expenses,
  inventory,
  inventoryMovements,
  orders,
  productImages,
  products,
  warehouses,
} from '@/db/schema';
import type { InventoryMovementReason } from '@/lib/inventory/reasons';
import { MANUAL_REASONS } from '@/lib/inventory/reasons';
import type { MovementQuery, StockLevelQuery } from '@/lib/validation/inventory';

/** Nepal is a fixed UTC+05:45, so a stored UTC timestamp needs shifting to read as a local day. */
const NEPAL_SHIFT = sql`interval '5 hours 45 minutes'`;

/** `numeric` arrives as a string; null must survive as null rather than become 0. */
function amount(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The primary image, or the first one on display order.
 *
 * A correlated subquery rather than a join: a product has many images, and joining
 * them would multiply the row and quietly break every aggregate on the query.
 */
const primaryImage = sql<string | null>`(
  SELECT ${productImages.url}
  FROM ${productImages}
  WHERE ${productImages.productId} = ${products.id}
  ORDER BY ${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC
  LIMIT 1
)`;

/* ------------------------------------------------------------- stock levels */

export interface StockLevelRow {
  productId: number;
  sku: string;
  barcode: string | null;
  productName: string;
  slug: string;
  imageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  brandId: number | null;
  brandName: string | null;
  /** `products.stock_quantity` — the authoritative count. */
  stockQuantity: number;
  reservedQuantity: number;
  /** On hand less reserved. What could actually be promised to a new customer. */
  availableQuantity: number;
  lowStockThreshold: number;
  stockStatus: string;
  /** Product lifecycle (`active` / `draft` / `discontinued`), not stock. */
  status: string;
  isActive: boolean;
  /** `products.cost_price`. Null means no cost is on record — never treat as zero. */
  unitCost: number | null;
  /** `stockQuantity × unitCost`, or null when the cost is unknown. */
  stockValue: number | null;
  /** `inventory.reorder_point`, or null when the product has no inventory row yet. */
  reorderPoint: number | null;
  /** The mirror's total across the warehouses in scope. Null when there is no row. */
  warehouseQuantity: number | null;
  warehouseCount: number;
  /** The warehouse, when exactly one is in scope for this product. */
  warehouseId: number | null;
  warehouseName: string | null;
  /**
   * True when the mirror disagrees with the authoritative count. Null when the query
   * is scoped to one warehouse, because a single warehouse's mirror is not supposed
   * to equal a product-level total.
   */
  drift: boolean | null;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/**
 * The stock overview table.
 *
 * `LEFT JOIN` on the mirror, deliberately: a product created through the admin form
 * has a `products` row and no `inventory` row, and it must still be listed and
 * adjustable — otherwise the only products you can correct are the seeded ones.
 *
 * `warehouseId` narrows **which mirror is reported**, not which products are listed.
 * The authoritative count is not per-warehouse, so filtering products out by
 * warehouse would hide exactly the rows someone needs in order to record stock
 * arriving at a new branch.
 */
export async function queryStockLevels(
  query: StockLevelQuery & { productId?: number },
): Promise<Paginated<StockLevelRow>> {
  const scoped = query.warehouseId !== undefined;

  const mirror = db
    .select({
      productId: inventory.productId,
      quantity: sql<number>`sum(${inventory.quantityOnHand})::int`.as('quantity'),
      reorderPoint: sql<number>`max(${inventory.reorderPoint})::int`.as('reorder_point'),
      warehouseCount: sql<number>`count(DISTINCT ${inventory.warehouseId})::int`.as(
        'warehouse_count',
      ),
      // Only meaningful when the product sits in exactly one warehouse; null otherwise,
      // which is what stops the UI labelling a four-branch total with one branch's name.
      soleWarehouseId: sql<number | null>`CASE
        WHEN count(DISTINCT ${inventory.warehouseId}) = 1
        THEN min(${inventory.warehouseId})
      END`.as('sole_warehouse_id'),
    })
    .from(inventory)
    .where(scoped ? eq(inventory.warehouseId, query.warehouseId as number) : undefined)
    .groupBy(inventory.productId)
    .as('mirror');

  const conditions: SQL[] = [];

  // Not one of the table's filters — the adjustment form uses it to load one product
  // through the same query, so the figure it submits as `expectedQuantity` is computed
  // by exactly the code that produced the number on screen.
  if (query.productId !== undefined) conditions.push(eq(products.id, query.productId));

  if (query.search) {
    const needle = `%${query.search}%`;
    conditions.push(
      or(
        ilike(products.sku, needle),
        ilike(products.name, needle),
        ilike(products.barcode, needle),
      ) as SQL,
    );
  }
  if (query.categoryId !== undefined) conditions.push(eq(products.categoryId, query.categoryId));
  if (query.brandId !== undefined) conditions.push(eq(products.brandId, query.brandId));
  if (query.stockStatus) conditions.push(eq(products.stockStatus, query.stockStatus));
  // The same predicate as the "Low Stock Alert" KPI card in
  // lib/reports/aggregate.ts — out-of-stock is its own card, so it is excluded here.
  // The reorder planner uses the *reorder point* instead, which is a different and
  // separately-labelled line.
  if (query.lowStockOnly) {
    conditions.push(gt(products.stockQuantity, 0));
    conditions.push(lte(products.stockQuantity, products.lowStockThreshold));
  }
  if (!query.includeInactive) {
    conditions.push(sql`${products.status} <> 'discontinued'`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const stockValue = sql<string | null>`CASE
    WHEN ${products.costPrice} IS NULL THEN NULL
    ELSE round(${products.costPrice} * ${products.stockQuantity}, 2)
  END`;

  const orderBy = {
    name: [asc(products.name)],
    sku: [asc(products.sku)],
    stock_asc: [asc(products.stockQuantity), asc(products.name)],
    stock_desc: [desc(products.stockQuantity), asc(products.name)],
    // NULLS LAST so the products with no cost on record sit at the bottom rather than
    // heading a list sorted by value.
    value_desc: [sql`${stockValue} DESC NULLS LAST`, asc(products.name)],
    updated: [desc(products.updatedAt)],
  }[query.sort];

  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      slug: products.slug,
      imageUrl: primaryImage,
      categoryId: products.categoryId,
      categoryName: categories.name,
      brandId: products.brandId,
      brandName: brands.name,
      stockQuantity: products.stockQuantity,
      reservedQuantity: products.reservedQuantity,
      lowStockThreshold: products.lowStockThreshold,
      stockStatus: products.stockStatus,
      status: products.status,
      isActive: products.isActive,
      unitCost: products.costPrice,
      stockValue,
      reorderPoint: mirror.reorderPoint,
      warehouseQuantity: mirror.quantity,
      warehouseCount: mirror.warehouseCount,
      warehouseId: mirror.soleWarehouseId,
      warehouseName: warehouses.name,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(mirror, eq(mirror.productId, products.id))
    .leftJoin(warehouses, eq(warehouses.id, mirror.soleWarehouseId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(where)
    .orderBy(...orderBy)
    .limit(query.limit)
    .offset(offset);

  // Counted with the same predicate but without the joins: every filter above is on a
  // `products` column, so the mirror cannot change how many rows match.
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  const total = counted?.total ?? rows.length;

  return {
    data: rows.map((row) => ({
      ...row,
      unitCost: amount(row.unitCost),
      stockValue: amount(row.stockValue),
      availableQuantity: row.stockQuantity - row.reservedQuantity,
      warehouseCount: row.warehouseCount ?? 0,
      drift:
        scoped || row.warehouseQuantity === null
          ? null
          : row.warehouseQuantity !== row.stockQuantity,
      updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * One product's stock, for the adjustment form.
 *
 * The form needs the current count at the moment it opens, because that figure is
 * submitted back as `expectedQuantity` and is what makes the stale-screen 409
 * possible.
 */
export async function queryStockLevel(
  productId: number,
  warehouseId?: number,
): Promise<StockLevelRow | null> {
  const result = await queryStockLevels({
    productId,
    search: undefined,
    warehouseId,
    categoryId: undefined,
    brandId: undefined,
    stockStatus: undefined,
    lowStockOnly: undefined,
    // A discontinued product can still hold stock that needs writing off.
    includeInactive: true,
    sort: 'name',
    page: 1,
    limit: 1,
  });

  return result.data[0] ?? null;
}

/* ----------------------------------------------------------- reorder planner */

export interface ReorderRow {
  productId: number;
  sku: string;
  productName: string;
  imageUrl: string | null;
  brandName: string | null;
  categoryName: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  /** The line this product is judged against. */
  reorderPoint: number;
  /** Where that line came from — an explicit inventory row, or the product default. */
  reorderPointSource: 'inventory' | 'threshold';
  /** How many units short of the line. Always at least 1, or this row would not be here. */
  shortfall: number;
  unitCost: number | null;
  stockStatus: string;
}

/**
 * Everything at or below its reorder point, worst first.
 *
 * The line is `inventory.reorder_point` where an inventory row exists and
 * `products.low_stock_threshold` where one does not — stated on each row as
 * `reorderPointSource` so nobody has to guess which number they are looking at.
 *
 * No supplier column and no "suggested order quantity": both would be invented. The
 * shortfall is arithmetic, and arithmetic is all this can honestly offer.
 */
export async function queryReorderList(limit = 100): Promise<ReorderRow[]> {
  const mirror = db
    .select({
      productId: inventory.productId,
      reorderPoint: sql<number>`max(${inventory.reorderPoint})::int`.as('reorder_point'),
    })
    .from(inventory)
    .groupBy(inventory.productId)
    .as('mirror');

  const line = sql<number>`coalesce(${mirror.reorderPoint}, ${products.lowStockThreshold})`;

  const rows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      productName: products.name,
      imageUrl: primaryImage,
      brandName: brands.name,
      categoryName: categories.name,
      stockQuantity: products.stockQuantity,
      reservedQuantity: products.reservedQuantity,
      lowStockThreshold: products.lowStockThreshold,
      mirrorReorderPoint: mirror.reorderPoint,
      unitCost: products.costPrice,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .leftJoin(mirror, eq(mirror.productId, products.id))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        sql`${products.status} <> 'discontinued'`,
        // A pre-order product is *meant* to be at or below zero, so it is not short of
        // anything and does not belong on a buying list.
        sql`${products.stockStatus} <> 'pre_order'`,
        lte(products.stockQuantity, line),
      ),
    )
    .orderBy(asc(products.stockQuantity), asc(products.name))
    .limit(limit);

  return rows.map((row) => {
    const reorderPoint = row.mirrorReorderPoint ?? row.lowStockThreshold;
    return {
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      imageUrl: row.imageUrl,
      brandName: row.brandName,
      categoryName: row.categoryName,
      stockQuantity: row.stockQuantity,
      reservedQuantity: row.reservedQuantity,
      availableQuantity: row.stockQuantity - row.reservedQuantity,
      reorderPoint,
      reorderPointSource: row.mirrorReorderPoint === null ? 'threshold' : 'inventory',
      shortfall: reorderPoint - row.stockQuantity,
      unitCost: amount(row.unitCost),
      stockStatus: row.stockStatus,
    };
  });
}

/* ----------------------------------------------------------------- movements */

export interface MovementView {
  id: number;
  createdAt: string;
  productId: number;
  variantId: number | null;
  sku: string;
  productName: string;
  quantityDelta: number;
  quantityAfter: number;
  reason: InventoryMovementReason;
  note: string | null;
  referenceNo: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
  performedBy: number | null;
  performedByName: string | null;
  unitCost: number | null;
  /** `unitCost × quantityDelta`, signed. Negative when value left the business. */
  valueImpact: number | null;
  orderId: number | null;
  orderNumber: string | null;
  expenseId: number | null;
  expenseAmount: number | null;
  reversesMovementId: number | null;
  /** Set when a later movement undid this one. */
  reversedByMovementId: number | null;
  /**
   * Whether the Reverse action applies. A sale is undone by cancelling the order, an
   * opening balance has nothing before it to return to, and a movement that has
   * already been reversed cannot be reversed twice — the partial unique index on
   * `reverses_movement_id` would refuse anyway.
   */
  isReversible: boolean;
}

export interface MovementFacets {
  /** Distinct actors present in the ledger, for the filter dropdown. */
  staff: Array<{ id: number | null; name: string }>;
  reasons: Array<{ reason: InventoryMovementReason; count: number }>;
}

const MANUAL_SET = new Set<string>(MANUAL_REASONS);

/**
 * The audit log.
 *
 * `facets` is returned alongside the page so the filter dropdowns can be populated
 * from the ledger itself. Without it the staff filter would need `/api/users`, which
 * is `OWNER_ONLY` — an inventory manager would get a 403 and an empty dropdown.
 */
export async function queryMovements(
  query: MovementQuery,
): Promise<Paginated<MovementView> & { facets: MovementFacets }> {
  const reversal = alias(inventoryMovements, 'reversal');

  const conditions: SQL[] = [];

  if (query.search) {
    const needle = `%${query.search}%`;
    conditions.push(
      or(
        ilike(inventoryMovements.skuSnapshot, needle),
        ilike(inventoryMovements.productNameSnapshot, needle),
        ilike(inventoryMovements.referenceNo, needle),
      ) as SQL,
    );
  }
  if (query.productId !== undefined) {
    conditions.push(eq(inventoryMovements.productId, query.productId));
  }
  if (query.reason) conditions.push(eq(inventoryMovements.reason, query.reason));
  if (query.performedBy !== undefined) {
    conditions.push(eq(inventoryMovements.performedBy, query.performedBy));
  }
  if (query.warehouseId !== undefined) {
    conditions.push(eq(inventoryMovements.warehouseId, query.warehouseId));
  }
  // Read as Nepal-local calendar days, inclusive at both ends. Comparing the raw UTC
  // timestamp would put anything after 6:15pm local into the following day.
  if (query.from) {
    conditions.push(sql`(${inventoryMovements.createdAt} + ${NEPAL_SHIFT})::date >= ${query.from}`);
  }
  if (query.to) {
    conditions.push(sql`(${inventoryMovements.createdAt} + ${NEPAL_SHIFT})::date <= ${query.to}`);
  }
  if (query.view === 'manual') {
    conditions.push(inArray(inventoryMovements.reason, [...MANUAL_REASONS]));
  }
  if (query.view === 'writeoffs') {
    conditions.push(isNotNull(inventoryMovements.expenseId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select({
      id: inventoryMovements.id,
      createdAt: inventoryMovements.createdAt,
      productId: inventoryMovements.productId,
      variantId: inventoryMovements.variantId,
      sku: inventoryMovements.skuSnapshot,
      productName: inventoryMovements.productNameSnapshot,
      quantityDelta: inventoryMovements.quantityDelta,
      quantityAfter: inventoryMovements.quantityAfter,
      reason: inventoryMovements.reason,
      note: inventoryMovements.note,
      referenceNo: inventoryMovements.referenceNo,
      warehouseId: inventoryMovements.warehouseId,
      warehouseName: warehouses.name,
      performedBy: inventoryMovements.performedBy,
      performedByName: inventoryMovements.performedByName,
      unitCost: inventoryMovements.unitCostSnapshot,
      orderId: inventoryMovements.orderId,
      orderNumber: orders.orderNumber,
      expenseId: inventoryMovements.expenseId,
      expenseAmount: expenses.amount,
      reversesMovementId: inventoryMovements.reversesMovementId,
      reversedByMovementId: reversal.id,
    })
    .from(inventoryMovements)
    .leftJoin(warehouses, eq(warehouses.id, inventoryMovements.warehouseId))
    .leftJoin(orders, eq(orders.id, inventoryMovements.orderId))
    .leftJoin(expenses, eq(expenses.id, inventoryMovements.expenseId))
    .leftJoin(reversal, eq(reversal.reversesMovementId, inventoryMovements.id))
    .where(where)
    .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
    .limit(query.limit)
    .offset(offset);

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryMovements)
    .where(where);

  const facets = await queryMovementFacets();
  const total = counted?.total ?? rows.length;

  return {
    data: rows.map((row) => {
      const unitCost = amount(row.unitCost);
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        unitCost,
        valueImpact: unitCost === null ? null : Number((unitCost * row.quantityDelta).toFixed(2)),
        expenseAmount: amount(row.expenseAmount),
        isReversible:
          MANUAL_SET.has(row.reason) &&
          row.reversesMovementId === null &&
          row.reversedByMovementId === null,
      };
    }),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    },
    facets,
  };
}

/**
 * Filter options, computed over the whole ledger rather than the current filters —
 * a dropdown that loses its own options as soon as you pick one is unusable.
 */
async function queryMovementFacets(): Promise<MovementFacets> {
  const staffRows = await db
    .selectDistinct({
      id: inventoryMovements.performedBy,
      name: inventoryMovements.performedByName,
    })
    .from(inventoryMovements)
    .orderBy(asc(inventoryMovements.performedByName));

  const reasonRows = await db
    .select({
      reason: inventoryMovements.reason,
      count: sql<number>`count(*)::int`,
    })
    .from(inventoryMovements)
    .groupBy(inventoryMovements.reason)
    .orderBy(desc(sql`count(*)`));

  // Rows written by the seed and by migration 0008's opening-balance backfill have no
  // actor. Labelling them "System" is accurate; leaving them unlabelled would make the
  // filter look broken.
  const staff = new Map<string, { id: number | null; name: string }>();
  for (const row of staffRows) {
    const key = row.id === null ? 'system' : String(row.id);
    if (!staff.has(key)) {
      staff.set(key, { id: row.id, name: row.name ?? (row.id === null ? 'System' : `User ${row.id}`) });
    }
  }

  return { staff: [...staff.values()], reasons: reasonRows };
}

/* ---------------------------------------------------------------- warehouses */

export interface WarehouseView {
  id: number;
  name: string;
  province: string | null;
  district: string | null;
  isActive: boolean;
  /** Product rows held in this warehouse's mirror. */
  stockRows: number;
  unitsOnHand: number;
}

export async function queryWarehouses(includeInactive = true): Promise<WarehouseView[]> {
  return db
    .select({
      id: warehouses.id,
      name: warehouses.name,
      province: warehouses.province,
      district: warehouses.district,
      isActive: warehouses.isActive,
      stockRows: sql<number>`count(${inventory.id})::int`,
      unitsOnHand: sql<number>`coalesce(sum(${inventory.quantityOnHand}), 0)::int`,
    })
    .from(warehouses)
    .leftJoin(inventory, eq(inventory.warehouseId, warehouses.id))
    .where(includeInactive ? undefined : eq(warehouses.isActive, true))
    .groupBy(warehouses.id)
    .orderBy(desc(warehouses.isActive), asc(warehouses.name));
}
