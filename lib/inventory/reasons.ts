// lib/inventory/reasons.ts
//
// The vocabulary of stock movements, in one place with no database imports so that
// the Zod request schema, the server-side ledger core and the browser components can
// all share it. Everything here is a plain constant or a pure function.
//
// The mirror of these values lives in the `inventory_movement_reason` enum
// (db/schema/enums.ts, DDL in drizzle/migrations/0008_inventory_movements.sql). Adding
// a reason means adding it in both places.

import type { inventoryMovementReasonEnum } from '@/db/schema/enums';

export type InventoryMovementReason =
  (typeof inventoryMovementReasonEnum)['enumValues'][number];

/**
 * Reasons written only by code, never accepted from a request.
 *
 * `sale` and `sale_cancelled` come from `lib/orders/stock.ts` at checkout and
 * cancellation; `initial_stock` from the seed and from migration 0008's
 * opening-balance backfill. Staff must not be able to file shrinkage as a sale — that
 * would move real losses into COGS, where they look like the cost of trading rather
 * than stock that went missing.
 */
export const CODE_ONLY_REASONS = ['sale', 'sale_cancelled', 'initial_stock'] as const;

/**
 * What the adjustment form offers, in display order.
 *
 * The first two normally go up and the rest normally go down, but none of them is
 * forced: a supplier restock can legitimately be negative when a delivery is
 * short-shipped and the earlier entry has to be walked back.
 */
export const MANUAL_REASONS = [
  'supplier_restock',
  'customer_return',
  'damaged',
  'stolen',
  'expired',
  'internal_use',
  'audit_correction',
] as const;

export type ManualMovementReason = (typeof MANUAL_REASONS)[number];

export const REASON_LABELS: Record<InventoryMovementReason, string> = {
  sale: 'Sale',
  sale_cancelled: 'Sale cancelled',
  supplier_restock: 'Supplier restock',
  customer_return: 'Customer return',
  damaged: 'Damaged',
  stolen: 'Stolen',
  expired: 'Expired',
  internal_use: 'Internal use',
  audit_correction: 'Audit correction',
  initial_stock: 'Opening balance',
};

/**
 * A one-line explanation of what each manual reason means, shown under the dropdown.
 * Two people picking different reasons for the same event is how a stock report stops
 * being comparable month to month.
 */
export const MANUAL_REASON_HINTS: Record<ManualMovementReason, string> = {
  supplier_restock: 'Goods received from a supplier. Enter the money side as a purchase bill.',
  customer_return: 'A returned unit going back on the shelf as sellable stock.',
  damaged: 'Broken in handling, transport or storage. Books the cost as an expense.',
  stolen: 'Shoplifting or unexplained loss confirmed by a count. Books the cost as an expense.',
  expired: 'Past its usable life — batteries, thermal paste, licence keys. Books the cost.',
  internal_use: 'Taken for the workshop, a demo unit or staff use. Books the cost.',
  audit_correction: 'A physical count disagreed with the system. State the count in the note.',
};

/**
 * Whether this movement should book a line in the shop books.
 *
 * The rule, stated once: **a negative movement of goods with a known unit cost is
 * value that left the business, so it books one expense. A positive movement never
 * does.**
 *
 * `sale` is excluded because those units are already counted in COGS via
 * `order_items.unit_cost_snapshot` — booking them here as well would charge the shop
 * twice for the same laptop. `sale_cancelled` and `initial_stock` are positive in
 * practice and are listed only so the exclusion is explicit rather than incidental.
 *
 * The one exception is a reversal, which is positive and *must* book a negative
 * expense so the P&L nets back out; the caller passes that in separately.
 */
export function booksWriteOff(reason: InventoryMovementReason, quantityDelta: number): boolean {
  if (quantityDelta >= 0) return false;
  return !(CODE_ONLY_REASONS as readonly string[]).includes(reason);
}

/** The expense category every stock write-off is filed under. */
export const WRITE_OFF_CATEGORY_NAME = 'Inventory Write-off & Shrinkage';

export const WRITE_OFF_CATEGORY_DESCRIPTION =
  'Stock that left the business without being sold: damage, theft, expiry, internal use and count corrections.';
