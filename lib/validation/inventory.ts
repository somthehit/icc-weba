// lib/validation/inventory.ts
//
// Request shapes for the inventory module: stock-level reads, manual adjustments,
// reversals, the movement log and warehouse CRUD.
//
// Two rules here are load-bearing rather than cosmetic:
//
//   1. **`reason` is restricted to `MANUAL_REASONS`.** `sale`, `sale_cancelled` and
//      `initial_stock` exist in the database enum but are written only by code. If a
//      request could name `sale`, staff could file shrinkage as a sale, which moves a
//      real loss out of the write-off expense and into COGS where it reads as the
//      ordinary cost of trading. The schema is the enforcement point, not a convention.
//   2. **`quantityDelta` may not be zero.** A movement of zero units is not a movement,
//      and a CHECK constraint would otherwise reject it with a message about a
//      constraint rather than about the mistake.
//
// `expectedQuantity` is what makes optimistic concurrency possible: the form submits
// the count it was showing, and the route refuses the write if the shelf has moved
// since. Two people adjusting the same product from stale screens is the ordinary
// failure mode of a stock screen, and applying both deltas silently is how a count
// goes wrong.

import { z } from 'zod';

import { MANUAL_REASONS } from '@/lib/inventory/reasons';
import { PROVINCES } from './commerce';
import { idParamSchema } from './schemas';

/** Matches `stockStatusEnum` in db/schema/enums.ts. */
export const STOCK_STATUSES = [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'pre_order',
  'discontinued',
] as const;

/**
 * A blank text field posts `""`, which should read as "not filtered" / "clear the
 * column" rather than as a search for the empty string or a stored blank.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

/** Same treatment for a query-string filter, where absent and blank both mean "all". */
const optionalFilter = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/**
 * A checkbox or flag arriving over the query string.
 *
 * Only the literal `"true"` turns it on. `Boolean("false")` is `true`, which is the
 * classic way a "low stock only" toggle ends up permanently stuck on.
 */
const queryFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const page = z.coerce.number().int().min(1).max(100_000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);

/** `YYYY-MM-DD`, the shape `<input type="date">` submits and `expense_date` stores. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
  .optional();

/**
 * How a quantity may be written.
 *
 * Bounded at a hundred thousand in either direction: an unbounded integer here is
 * how a slipped keypress turns into a six-figure write-off expense, and no shop this
 * software is for moves that many units in one adjustment.
 */
const quantityDelta = z.coerce
  .number()
  .int('Enter a whole number of units')
  .min(-100_000)
  .max(100_000)
  .refine((value) => value !== 0, {
    message: 'Enter how many units to add or remove',
  });

const threshold = z.coerce.number().int().min(0).max(100_000);

/* ------------------------------------------------------------- stock levels */

/**
 * Filters for the stock overview table.
 *
 * `sort` is a closed list rather than a column name, so a caller cannot order by an
 * arbitrary expression.
 */
export const stockLevelQuerySchema = z.object({
  search: optionalFilter(120),
  warehouseId: idParamSchema.optional(),
  categoryId: idParamSchema.optional(),
  brandId: idParamSchema.optional(),
  stockStatus: z.enum(STOCK_STATUSES).optional(),
  lowStockOnly: queryFlag,
  /** Products whose status is `discontinued` are hidden unless this is set. */
  includeInactive: queryFlag,
  sort: z
    .enum(['name', 'sku', 'stock_asc', 'stock_desc', 'value_desc', 'updated'])
    .default('name'),
  page,
  limit,
});

export type StockLevelQuery = z.infer<typeof stockLevelQuerySchema>;

/* -------------------------------------------------------------- adjustments */

export const adjustStockSchema = z.object({
  productId: idParamSchema,
  /** Carried for multi-variant stock later; every row this app writes has none. */
  variantId: idParamSchema.nullable().optional(),
  /**
   * Absent means "let the server use the only active warehouse". Explicitly null
   * means "against the product-level count with no warehouse", which is what a sale
   * records.
   */
  warehouseId: idParamSchema.nullable().optional(),
  quantityDelta,
  reason: z.enum(MANUAL_REASONS),
  note: optionalText(500),
  referenceNo: optionalText(60),
  /**
   * The per-unit purchase price for this batch, in NPR.
   *
   * Optional. When supplied on a *receipt* (a positive delta) the server records it as
   * the movement's cost snapshot and updates `products.cost_price`, which is what the
   * stock table reads to compute cost value — that is why rows show "Cost missing"
   * until a cost has been seen once. Ignored on a removal, where the cost that matters
   * is the one already on record, not a new one typed at write-off time.
   */
  unitCost: z.coerce
    .number()
    .positive('Unit cost must be greater than zero')
    .max(99_999_999.99, 'Unit cost is too large')
    .optional(),
  /** The on-hand figure the form was showing. Mismatch is a 409, not a silent apply. */
  expectedQuantity: z.coerce.number().int().min(-100_000).max(1_000_000).optional(),
  /**
   * Permits a result below zero. Owner-only at the route, because a negative count is
   * either a genuine backorder or a mistake, and the two are told apart by a person.
   */
  // A real boolean, not `z.coerce.boolean()`: coercion is `Boolean(value)`, which
  // turns the string "false" into true — see `queryFlag` above.
  allowNegative: z.boolean().optional().default(false),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/**
 * Undo one movement.
 *
 * There is no `quantityDelta` — the reversal's delta is the original's negated, read
 * from the stored row. Letting a caller supply it would allow a "reversal" that
 * reverses a different amount than the thing it claims to reverse.
 */
export const reverseMovementSchema = z.object({
  movementId: idParamSchema,
  note: optionalText(500),
});

/* -------------------------------------------------------------- reorder point */

export const reorderPointSchema = z
  .object({
    productId: idParamSchema,
    warehouseId: idParamSchema.nullable().optional(),
    /** Per-warehouse "time to buy more" line, on the `inventory` row. */
    reorderPoint: threshold.optional(),
    /**
     * The product-level line that drives `stock_status`. Changing it recomputes the
     * status in the same statement, so the badge cannot lag the threshold.
     */
    lowStockThreshold: threshold.optional(),
  })
  .refine(
    (data) => data.reorderPoint !== undefined || data.lowStockThreshold !== undefined,
    { message: 'Provide a reorder point or a low-stock threshold' },
  );

/* ----------------------------------------------------------------- movements */

export const movementQuerySchema = z.object({
  /** Matched against the snapshots, so a since-renamed product still finds its rows. */
  search: optionalFilter(120),
  productId: idParamSchema.optional(),
  reason: z
    .enum([
      'sale',
      'sale_cancelled',
      'supplier_restock',
      'customer_return',
      'damaged',
      'stolen',
      'expired',
      'internal_use',
      'audit_correction',
      'initial_stock',
    ])
    .optional(),
  performedBy: idParamSchema.optional(),
  warehouseId: idParamSchema.optional(),
  /** Inclusive on both ends, read as Nepal-local calendar days. */
  from: isoDate,
  to: isoDate,
  /** `writeoffs` narrows to movements that booked an expense. */
  view: z.enum(['all', 'manual', 'writeoffs']).default('all'),
  page,
  limit,
});

export type MovementQuery = z.infer<typeof movementQuerySchema>;

/* ---------------------------------------------------------------- warehouses */

const warehouseFields = {
  name: z.string().trim().min(1, 'Warehouse name is required').max(120),
  province: z.enum(PROVINCES).nullable().optional(),
  district: optionalText(100),
  isActive: z.boolean().optional(),
};

export const createWarehouseSchema = z.object(warehouseFields);

export const updateWarehouseSchema = z
  .object(warehouseFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });
