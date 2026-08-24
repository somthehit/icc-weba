// lib/pricing/quote.ts
//
// Order money, decided server-side.
//
// `POST /api/orders` used to add up `item.unitPrice` from the request body, put a
// hardcoded 13% VAT on top of prices the store already sells VAT-inclusive, and
// take `deliveryFee`, `discountAmount` and `couponId` from the client. This
// module is the replacement: every figure comes from the database — the product's
// own price and timed offer, the coupon looked up by code, the delivery zone's
// flat fee, and the VAT rate plus inclusive/exclusive flag from `store_profile`.
//
// All arithmetic is in integer paisa. Rupee floats do not add up (0.1 + 0.2 is
// not 0.3) and a numeric(12,2) column will happily store the difference.

import { eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  cartItems,
  carts,
  coupons,
  deliveryZones,
  productVariants,
  products,
  storeProfile,
} from '@/db/schema';

/** A transaction handle, or the pool client when there is nothing to commit. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | Tx;

/** Matches the cap in `createOrderSchema`; kept here for the cart path too. */
export const MAX_ORDER_LINES = 50;
const MAX_LINE_QUANTITY = 99;

/** Fallbacks for a database with no `store_profile` row yet. */
const DEFAULT_VAT_PERCENT = '13.00';
const DEFAULT_FREE_DELIVERY_THRESHOLD = '50000.00';

export function toPaisa(value: string | number | null | undefined): number {
  return Math.round(Number(value ?? 0) * 100);
}

export function toRupees(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

export interface LineInput {
  productId: number;
  variantId?: number | null;
  quantity: number;
}

export interface QuoteLine {
  productId: number;
  variantId: number | null;
  /** Copied onto `order_items` so a later product rename can't rewrite history. */
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  /** What the line costs now, after any live timed offer. */
  unitPricePaisa: number;
  lineTotalPaisa: number;
  /** Before the offer — lets the confirmation screen show what was saved. */
  listUnitPricePaisa: number;
  /**
   * What the unit cost us, for `order_items.unit_cost_snapshot`.
   *
   * `null` when `products.cost_price` is unset — the reports disclose how many
   * lines that affects rather than reading a missing cost as zero, which would
   * overstate gross profit.
   */
  unitCostPaisa: number | null;
  /** Pre-order lines are sold without stock on hand, so the decrement is unguarded. */
  allowBackorder: boolean;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalPaisa: number;
  discountPaisa: number;
  deliveryFeePaisa: number;
  vatPaisa: number;
  totalPaisa: number;
  couponId: number | null;
  couponCode: string | null;
  /** The coupon's terms in words, for the cart to show beside the code. */
  couponDescription: string | null;
  vatRatePercent: string;
  pricesIncludeVat: boolean;
  freeDeliveryApplied: boolean;
  /** Net subtotal at which delivery stops being charged. 0 disables the rule. */
  freeDeliveryThresholdPaisa: number;
  currency: string;
}

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; status: number; error: string };

interface QuoteOptions {
  items: LineInput[];
  couponCode?: string;
  deliveryZoneId?: number;
  now?: Date;
}

/** The saved cart, as quotable lines. Empty when the customer has no cart. */
export async function loadCartLines(client: DbClient, userId: number): Promise<LineInput[]> {
  const [cart] = await client
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  if (!cart) return [];

  const rows = await client
    .select({
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id))
    .limit(MAX_ORDER_LINES);

  return rows;
}

/**
 * Collapses repeats of the same product/variant into one line, so a cart that
 * somehow holds two rows for the same thing is priced — and stock-checked — as a
 * single quantity rather than racing itself.
 */
export function mergeLines(input: LineInput[]): LineInput[] {
  const merged = new Map<string, LineInput>();

  for (const line of input) {
    const variantId = line.variantId ?? null;
    const key = `${line.productId}:${variantId ?? 'base'}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity = Math.min(existing.quantity + line.quantity, MAX_LINE_QUANTITY);
    } else {
      merged.set(key, {
        productId: line.productId,
        variantId,
        quantity: Math.min(line.quantity, MAX_LINE_QUANTITY),
      });
    }
  }

  return [...merged.values()];
}

type ProductRow = {
  id: number;
  name: string;
  sku: string;
  basePrice: string;
  costPrice: string | null;
  isActive: boolean;
  status: string;
  stockQuantity: number;
  stockStatus: string;
  offerEnabled: boolean;
  offerDiscountType: 'percentage' | 'fixed' | null;
  offerDiscountValue: string | null;
  offerMaxDiscountAmount: string | null;
  offerStartsAt: Date | null;
  offerEndsAt: Date | null;
};

/**
 * The unit price a timed offer produces, in paisa.
 *
 * The DB-side twin of `computeProductEffectivePrice`, with one addition: it
 * honours `offer_max_discount_amount`, which the client helper has no field for.
 * The cap can only ever reduce the discount, so a capped product is charged at
 * more than the storefront card shows until that helper learns about the column.
 */
function offerUnitPaisa(product: ProductRow, listPaisa: number, now: Date): number {
  const started = !product.offerStartsAt || product.offerStartsAt <= now;
  const notExpired = !product.offerEndsAt || product.offerEndsAt >= now;
  const live =
    product.offerEnabled &&
    product.offerDiscountValue !== null &&
    product.offerDiscountType !== null &&
    started &&
    notExpired;

  if (!live) return listPaisa;

  const raw =
    product.offerDiscountType === 'percentage'
      ? Math.round((listPaisa * Number(product.offerDiscountValue)) / 100)
      : toPaisa(product.offerDiscountValue);

  const capped =
    product.offerMaxDiscountAmount !== null
      ? Math.min(raw, toPaisa(product.offerMaxDiscountAmount))
      : raw;

  return Math.max(listPaisa - capped, 0);
}

/**
 * A coupon's terms in words.
 *
 * The table has no description column, and a stored one would drift from the
 * numbers anyway, so the sentence the cart shows is derived from the same fields
 * the discount is computed from.
 */
function describeCoupon(coupon: {
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  minOrderValue: string | null;
  maxDiscountAmount: string | null;
}): string {
  const parts: string[] = [];

  if (coupon.discountType === 'percentage') {
    parts.push(`${Number(coupon.discountValue)}% off`);
    if (coupon.maxDiscountAmount !== null) {
      parts.push(`up to NPR ${toRupees(toPaisa(coupon.maxDiscountAmount))}`);
    }
  } else {
    parts.push(`NPR ${toRupees(toPaisa(coupon.discountValue))} off`);
  }

  const minOrderPaisa = toPaisa(coupon.minOrderValue);
  if (minOrderPaisa > 0) parts.push(`on orders over NPR ${toRupees(minOrderPaisa)}`);

  return parts.join(', ');
}

async function loadStoreProfile(client: DbClient) {
  const [profile] = await client
    .select({
      currency: storeProfile.currency,
      vatRatePercent: storeProfile.vatRatePercent,
      pricesIncludeVat: storeProfile.pricesIncludeVat,
      freeDeliveryThreshold: storeProfile.freeDeliveryThreshold,
    })
    .from(storeProfile)
    .limit(1);

  return (
    profile ?? {
      currency: 'NPR',
      vatRatePercent: DEFAULT_VAT_PERCENT,
      pricesIncludeVat: true,
      freeDeliveryThreshold: DEFAULT_FREE_DELIVERY_THRESHOLD,
    }
  );
}

/**
 * Prices a basket. Returns a failure result rather than throwing, so the caller
 * decides whether that means a 4xx to the customer or a rolled-back transaction.
 *
 * Nothing here writes, which is what lets `/api/orders/quote` reuse it to show a
 * checkout summary the customer can trust to match the order they place.
 */
export async function quoteOrder(client: DbClient, options: QuoteOptions): Promise<QuoteResult> {
  const now = options.now ?? new Date();
  const requested = mergeLines(options.items);

  if (requested.length === 0) {
    return { ok: false, status: 400, error: 'There is nothing to order' };
  }
  if (requested.length > MAX_ORDER_LINES) {
    return { ok: false, status: 400, error: `An order can hold at most ${MAX_ORDER_LINES} lines` };
  }

  const profile = await loadStoreProfile(client);

  const productRows = await client
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      basePrice: products.basePrice,
      costPrice: products.costPrice,
      isActive: products.isActive,
      status: products.status,
      stockQuantity: products.stockQuantity,
      stockStatus: products.stockStatus,
      offerEnabled: products.offerEnabled,
      offerDiscountType: products.offerDiscountType,
      offerDiscountValue: products.offerDiscountValue,
      offerMaxDiscountAmount: products.offerMaxDiscountAmount,
      offerStartsAt: products.offerStartsAt,
      offerEndsAt: products.offerEndsAt,
    })
    .from(products)
    .where(
      inArray(
        products.id,
        requested.map((line) => line.productId),
      ),
    );

  const productById = new Map(productRows.map((row) => [row.id, row as ProductRow]));

  const variantIds = requested
    .map((line) => line.variantId)
    .filter((id): id is number => typeof id === 'number');

  const variantRows = variantIds.length
    ? await client
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          variantName: productVariants.variantName,
          sku: productVariants.sku,
          priceAdjustment: productVariants.priceAdjustment,
          isActive: productVariants.isActive,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
    : [];

  const variantById = new Map(variantRows.map((row) => [row.id, row]));

  const lines: QuoteLine[] = [];
  let subtotalPaisa = 0;

  for (const line of requested) {
    const product = productById.get(line.productId);
    if (!product) {
      return { ok: false, status: 400, error: 'One of those products no longer exists' };
    }
    if (!product.isActive || product.status !== 'active') {
      return { ok: false, status: 409, error: `${product.name} is no longer on sale` };
    }

    let listPaisa = toPaisa(product.basePrice);
    let nameSnapshot = product.name;
    let skuSnapshot = product.sku;

    if (line.variantId != null) {
      const variant = variantById.get(line.variantId);
      if (!variant || variant.productId !== product.id) {
        return {
          ok: false,
          status: 400,
          error: `That option does not belong to ${product.name}`,
        };
      }
      if (!variant.isActive) {
        return {
          ok: false,
          status: 409,
          error: `${product.name} — ${variant.variantName} is no longer available`,
        };
      }
      listPaisa += toPaisa(variant.priceAdjustment);
      nameSnapshot = `${product.name} (${variant.variantName})`;
      skuSnapshot = variant.sku;
    }

    const allowBackorder = product.stockStatus === 'pre_order';
    if (!allowBackorder && product.stockQuantity < line.quantity) {
      return {
        ok: false,
        status: 409,
        error:
          product.stockQuantity > 0
            ? `Only ${product.stockQuantity} left of ${product.name}`
            : `${product.name} is out of stock`,
      };
    }

    const unitPricePaisa = offerUnitPaisa(product, listPaisa, now);
    const lineTotalPaisa = unitPricePaisa * line.quantity;
    subtotalPaisa += lineTotalPaisa;

    lines.push({
      productId: product.id,
      variantId: line.variantId ?? null,
      // varchar(200) / varchar(60) on the order_items snapshots.
      productNameSnapshot: nameSnapshot.slice(0, 200),
      skuSnapshot: skuSnapshot.slice(0, 60),
      quantity: line.quantity,
      unitPricePaisa,
      lineTotalPaisa,
      listUnitPricePaisa: listPaisa,
      // Read off the product now, frozen onto the order row by the caller. A
      // variant's `price_adjustment` moves the sell price but there is no
      // per-variant cost column, so the product cost stands for both.
      unitCostPaisa: product.costPrice === null ? null : toPaisa(product.costPrice),
      allowBackorder,
    });
  }

  let couponId: number | null = null;
  let couponCode: string | null = null;
  let couponDescription: string | null = null;
  let discountPaisa = 0;

  if (options.couponCode) {
    const code = options.couponCode.trim();
    const [coupon] = await client
      .select()
      .from(coupons)
      .where(eq(sql`lower(${coupons.code})`, code.toLowerCase()))
      .limit(1);

    if (!coupon || !coupon.isActive) {
      return { ok: false, status: 400, error: 'That coupon code is not valid' };
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      return { ok: false, status: 400, error: 'That coupon is not active yet' };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { ok: false, status: 400, error: 'That coupon has expired' };
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { ok: false, status: 409, error: 'That coupon has been fully redeemed' };
    }

    const minOrderPaisa = toPaisa(coupon.minOrderValue);
    if (subtotalPaisa < minOrderPaisa) {
      return {
        ok: false,
        status: 400,
        error: `That coupon needs a subtotal of at least NPR ${toRupees(minOrderPaisa)}`,
      };
    }

    const raw =
      coupon.discountType === 'percentage'
        ? Math.round((subtotalPaisa * Number(coupon.discountValue)) / 100)
        : toPaisa(coupon.discountValue);

    const capped =
      coupon.maxDiscountAmount !== null ? Math.min(raw, toPaisa(coupon.maxDiscountAmount)) : raw;

    // Clamped to the subtotal: a fixed coupon worth more than the basket must not
    // turn into a negative total the store would owe.
    discountPaisa = Math.min(Math.max(capped, 0), subtotalPaisa);
    couponId = coupon.id;
    couponCode = coupon.code;
    couponDescription = describeCoupon(coupon);
  }

  const netPaisa = Math.max(subtotalPaisa - discountPaisa, 0);

  let deliveryFeePaisa = 0;
  if (options.deliveryZoneId !== undefined) {
    const [zone] = await client
      .select({ flatFee: deliveryZones.flatFee, isActive: deliveryZones.isActive })
      .from(deliveryZones)
      .where(eq(deliveryZones.id, options.deliveryZoneId))
      .limit(1);

    if (!zone || !zone.isActive) {
      return { ok: false, status: 400, error: 'We do not deliver to that zone' };
    }
    deliveryFeePaisa = toPaisa(zone.flatFee);
  }

  const thresholdPaisa = toPaisa(profile.freeDeliveryThreshold);
  const freeDeliveryApplied =
    deliveryFeePaisa > 0 && thresholdPaisa > 0 && netPaisa >= thresholdPaisa;
  if (freeDeliveryApplied) deliveryFeePaisa = 0;

  // `pricesIncludeVat` decides whether VAT is carved out of the price the
  // customer already saw or added to it. Sold inclusive (the default), a 13% rate
  // means the shown price is 113% of net, so VAT is the part above net — adding
  // 13% on top, as the old handler did, overcharged every order by 13%.
  const vatRate = Number(profile.vatRatePercent) / 100;
  const vatPaisa = profile.pricesIncludeVat
    ? netPaisa - Math.round(netPaisa / (1 + vatRate))
    : Math.round(netPaisa * vatRate);

  const totalPaisa = profile.pricesIncludeVat
    ? netPaisa + deliveryFeePaisa
    : netPaisa + vatPaisa + deliveryFeePaisa;

  return {
    ok: true,
    quote: {
      lines,
      subtotalPaisa,
      discountPaisa,
      deliveryFeePaisa,
      vatPaisa,
      totalPaisa,
      couponId,
      couponCode,
      couponDescription,
      vatRatePercent: profile.vatRatePercent,
      pricesIncludeVat: profile.pricesIncludeVat,
      freeDeliveryApplied,
      freeDeliveryThresholdPaisa: thresholdPaisa,
      currency: profile.currency,
    },
  };
}

/** The rupee-string shape the storefront and the `orders` columns both want. */
export function quoteTotals(quote: Quote) {
  return {
    subtotal: toRupees(quote.subtotalPaisa),
    discountAmount: toRupees(quote.discountPaisa),
    deliveryFee: toRupees(quote.deliveryFeePaisa),
    vatAmount: toRupees(quote.vatPaisa),
    totalAmount: toRupees(quote.totalPaisa),
  };
}

/** Removes the priced lines from the customer's cart once an order owns them. */
export async function clearCart(client: DbClient, userId: number): Promise<void> {
  const [cart] = await client
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  if (!cart) return;

  await client.delete(cartItems).where(eq(cartItems.cartId, cart.id));
}
