-- 0008: The inventory movement ledger — a stock history the database refuses to let
-- anyone rewrite.
--
-- Before this migration the admin console rendered a table headed "Stock Adjustment
-- Audit Log (Append-Only)" whose three rows came from a literal array in
-- lib/data/initial-data.ts. It was append-nowhere: the modal that wrote to it pushed
-- onto React state and the row vanished on reload.
--
-- Meanwhile the real stock movements — every checkout deduction in
-- lib/orders/stock.ts — left no trace at all. `products.stock_quantity` went down and
-- nothing anywhere recorded why. That is the gap this table closes: it is the history
-- of every change to a stock figure, whatever caused it.
--
-- Three design decisions worth naming, because each one is a choice that could
-- reasonably have gone the other way:
--
-- 1. `warehouse_id` is NULLABLE. A manual adjustment always names a warehouse — the
--    form makes you pick one. But a *sale* comes off `products.stock_quantity`, which
--    is a single-warehouse denormalization (see the comment at db/schema/catalog.ts
--    on the `stock_quantity` column) and is not per-warehouse. Stamping a warehouse
--    onto a sale would be inventing a fact. Null means "this movement is against the
--    authoritative product-level count", which is the truth.
--
-- 2. Direction is the SIGN of `quantity_delta`, not a separate column. An "IN"
--    movement with a negative quantity is a contradiction the schema should not be
--    able to express, so `reason` says why and the sign says which way.
--
-- 3. Append-only is enforced by a TRIGGER, not by the absence of UPDATE/DELETE routes.
--    Omitting routes constrains this codebase; a trigger constrains everybody,
--    including a psql session and a future contributor in a hurry. A correction is
--    made by writing a compensating movement (`reverses_movement_id`), never by
--    editing the original.
--
-- Guarded with IF NOT EXISTS to match 0001-0007: this DB was bootstrapped via
-- `drizzle-kit push`, so migrations are applied directly and must re-run safely.

-- CREATE TYPE has no IF NOT EXISTS in any PostgreSQL version, so the enum gets the
-- same DO-block treatment 0006 and 0007 gave theirs.
--
-- The six reasons a human may choose map 1:1 onto the adjustment form's dropdown.
-- `sale`, `sale_cancelled` and `initial_stock` are written only by code and are
-- rejected by the request schema in lib/validation/inventory.ts — a member of staff
-- must not be able to disguise shrinkage as a sale.
DO $$ BEGIN
  CREATE TYPE "public"."inventory_movement_reason" AS ENUM(
    'sale',
    'sale_cancelled',
    'supplier_restock',
    'customer_return',
    'damaged',
    'stolen',
    'expired',
    'internal_use',
    'audit_correction',
    'initial_stock'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "variant_id" integer,
  -- Nullable on purpose — see header note 1.
  "warehouse_id" integer,
  -- Snapshots, matching the product_name_snapshot / sku_snapshot precedent in
  -- order_items: the log must still read correctly after a rename or a re-SKU, and
  -- must survive the product row being renamed out from under it.
  "product_name_snapshot" varchar(200) NOT NULL,
  "sku_snapshot" varchar(60) NOT NULL,
  -- Signed. Never zero: a movement of nothing is not a movement.
  "quantity_delta" integer NOT NULL,
  -- On-hand immediately after this movement. Makes the ledger self-verifying —
  -- consecutive rows for one product must chain, and the last row must equal
  -- products.stock_quantity. If they disagree, something wrote stock without
  -- going through lib/inventory/movements.ts.
  "quantity_after" integer NOT NULL,
  "reason" "inventory_movement_reason" NOT NULL,
  -- Cost at the moment of the movement, so a later cost-price edit cannot
  -- retroactively change what a write-off was worth. Null when the product had no
  -- cost price on record, which is a fact the UI reports rather than papering over
  -- with a zero.
  "unit_cost_snapshot" numeric(12, 2),
  "note" varchar(500),
  -- The spec's `referenceId`: a damage report number, a supplier invoice, a stock
  -- count sheet. e.g. "DMG-2026-0811".
  "reference_no" varchar(60),
  "order_id" integer,
  -- The expenses row this movement booked, for write-off reasons with a known cost.
  "expense_id" integer,
  "reverses_movement_id" integer,
  "performed_by" integer,
  -- Name snapshot so "who did this" survives the user being deactivated or renamed.
  "performed_by_name" varchar(150),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delta_nonzero"
    CHECK ("quantity_delta" <> 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- restrict: a ledger that cascades away with the product is not a ledger. Products
-- are soft-deleted in this app anyway (status = 'discontinued'), so this blocks
-- nothing that actually happens.
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- set null: the movement still happened even if the variant row is gone. The
-- snapshots carry enough to read the row.
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- restrict, matching inventory.warehouse_id: closing a warehouse is a soft
-- `is_active = false`, not a delete, precisely because its stock history matters.
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_expense_id_fk"
    FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- restrict: you cannot delete a movement anyway (see the trigger below), but stating
-- the intent keeps the reversal chain intact if that trigger is ever dropped.
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reverses_fk"
    FOREIGN KEY ("reverses_movement_id") REFERENCES "inventory_movements"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- set null: staff leave. The performed_by_name snapshot is what the log renders.
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_fk"
    FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- One movement may only be reversed once. Without this, two staff both clicking
-- "Reverse" on the same fat-fingered adjustment would double-correct it.
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_reverses_idx"
  ON "inventory_movements" ("reverses_movement_id")
  WHERE "reverses_movement_id" IS NOT NULL;
--> statement-breakpoint

-- The product history view: "show me everything that happened to this SKU, newest
-- first" — the single most common query this table serves.
CREATE INDEX IF NOT EXISTS "inventory_movements_product_created_idx"
  ON "inventory_movements" ("product_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inventory_movements_created_idx"
  ON "inventory_movements" ("created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inventory_movements_reason_idx"
  ON "inventory_movements" ("reason");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inventory_movements_performed_by_idx"
  ON "inventory_movements" ("performed_by");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inventory_movements_warehouse_idx"
  ON "inventory_movements" ("warehouse_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inventory_movements_order_idx"
  ON "inventory_movements" ("order_id");
--> statement-breakpoint

-- Append-only, enforced here rather than hoped for.
--
-- CREATE OR REPLACE FUNCTION is already idempotent, so this needs no guard.
CREATE OR REPLACE FUNCTION "inventory_movements_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'inventory_movements is append-only; % is not permitted. Write a compensating movement with reverses_movement_id instead.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- FOR EACH ROW matters: a row-level trigger does not fire on TRUNCATE, which is what
-- keeps `npm run db:seed` working. That is deliberate — do not "fix" it to a
-- statement-level trigger, or reseeding a development database becomes impossible
-- without dropping the trigger first.
DROP TRIGGER IF EXISTS "inventory_movements_no_mutate" ON "inventory_movements";
--> statement-breakpoint

CREATE TRIGGER "inventory_movements_no_mutate"
  BEFORE UPDATE OR DELETE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION "inventory_movements_append_only"();
--> statement-breakpoint

-- Barcodes. A shop that prints its own shelf labels needs somewhere to keep the
-- manufacturer's EAN/UPC when there is one; nullable because most of this catalogue
-- has none, and the label falls back to encoding the SKU.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" varchar(64);
--> statement-breakpoint

-- PARTIAL unique index: two products must not share a barcode, but any number of
-- them may have none. A plain unique index would allow only one null-barcode product
-- under some engines and is simply the wrong statement of the rule here.
CREATE UNIQUE INDEX IF NOT EXISTS "products_barcode_idx"
  ON "products" ("barcode")
  WHERE "barcode" IS NOT NULL;
--> statement-breakpoint

-- Opening balances, so the ledger starts with a real balance instead of an empty
-- table that makes every existing unit look like it appeared from nowhere.
--
-- Guarded on the table being entirely empty rather than per-product: this must not
-- insert a second opening balance for a product whose stock has since moved, and
-- "the ledger has never been written to" is the only condition under which an
-- opening balance is meaningful.
INSERT INTO "inventory_movements" (
  "product_id", "product_name_snapshot", "sku_snapshot",
  "quantity_delta", "quantity_after", "reason", "unit_cost_snapshot", "note"
)
SELECT
  p."id", p."name", p."sku",
  p."stock_quantity", p."stock_quantity", 'initial_stock', p."cost_price",
  'Opening balance recorded when the movement ledger was introduced.'
FROM "products" p
WHERE p."stock_quantity" <> 0
  AND NOT EXISTS (SELECT 1 FROM "inventory_movements");
