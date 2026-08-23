-- 0005: Snapshot the delivery address onto the order.
--
-- `orders.shipping_address_id` is a FK with ON DELETE SET NULL, and a customer is
-- allowed to edit or delete their saved addresses. Without a snapshot, tidying up
-- an address book rewrites — or erases — where past orders were sent, which is
-- exactly the kind of history `order_items.product_name_snapshot` already
-- protects for prices and product names.
--
-- Nullable because orders placed before this column existed have nothing to
-- record; the API falls back to the live address row for those.
--
-- Guarded with IF NOT EXISTS to match 0001-0004: this DB was bootstrapped via
-- `drizzle-kit push`, so migrations are applied directly and must re-run safely.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_address_snapshot" jsonb;
