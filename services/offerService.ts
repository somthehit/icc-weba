// services/offerService.ts
// Per-product timed offers, stored as denormalized columns on the products row
// (offerEnabled / offerDiscountType / offerDiscountValue / offerStartsAt / offerEndsAt …).
// Because the effective price is derived from those columns at read time, an offer
// reverts automatically once `offerEndsAt` passes — no manual "remove offer" step.

import { db } from "../db";
import { products } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";

export { computeProductEffectivePrice, formatCountdownTime } from "../lib/offers/offerUtils";

// 1. Launch a time-bound offer on a product. Default window is 7 days.
export async function applyTimedOffer(params: {
  productId: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
  days?: number; // default 7
  maxDiscountAmount?: number;
  name?: string; // accepted for API compatibility; not persisted (no offer-name column)
}) {
  const { productId, discountType, discountValue, days = 7, maxDiscountAmount } = params;

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(products)
    .set({
      offerEnabled: true,
      offerDiscountType: discountType,
      offerDiscountValue: discountValue.toString(),
      offerMaxDiscountAmount: maxDiscountAmount != null ? maxDiscountAmount.toString() : null,
      offerStartsAt: startsAt,
      offerEndsAt: endsAt,
      offerIsFlashSale: true,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning();

  return updated; // endsAt is all the frontend needs to render the countdown
}

// 2. Compute the effective price for a product from its offer columns. Once `now`
//    passes offerEndsAt the offer simply stops applying — automatic revert.
export async function getEffectivePrice(productId: number, sellingPrice: number) {
  const now = new Date();

  const [p] = await db
    .select({
      offerEnabled: products.offerEnabled,
      offerDiscountType: products.offerDiscountType,
      offerDiscountValue: products.offerDiscountValue,
      offerMaxDiscountAmount: products.offerMaxDiscountAmount,
      offerStartsAt: products.offerStartsAt,
      offerEndsAt: products.offerEndsAt,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  const active =
    p &&
    p.offerEnabled &&
    p.offerDiscountValue != null &&
    (!p.offerStartsAt || p.offerStartsAt <= now) &&
    (!p.offerEndsAt || p.offerEndsAt >= now);

  if (!active) {
    return { price: sellingPrice, onOffer: false, offerEndsAt: null };
  }

  const rawDiscount =
    p.offerDiscountType === "percentage"
      ? sellingPrice * (Number(p.offerDiscountValue) / 100)
      : Number(p.offerDiscountValue);
  const discount = p.offerMaxDiscountAmount
    ? Math.min(rawDiscount, Number(p.offerMaxDiscountAmount))
    : rawDiscount;

  return {
    price: Math.round(Math.max(sellingPrice - discount, 0)),
    onOffer: true,
    offerEndsAt: p.offerEndsAt, // use this to show "Offer ends in Xd Yh" on the frontend
  };
}

// 3. Deactivate any offers whose window has already ended. Safe to run on a
//    schedule (node-cron / platform cron) or manually via PUT /api/offers.
export async function syncCachedOfferPrices() {
  const now = new Date();
  await db
    .update(products)
    .set({ offerEnabled: false, offerIsFlashSale: false, updatedAt: new Date() })
    .where(and(eq(products.offerEnabled, true), lt(products.offerEndsAt, now)));
}
