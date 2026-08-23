import { NextResponse } from 'next/server';

import { db } from '@/db';
import { withOptionalAuth } from '@/lib/auth/middleware';
import { loadCartLines, quoteOrder, quoteTotals, toRupees } from '@/lib/pricing/quote';
import { parseJson } from '@/lib/validation/parse';
import { orderQuoteSchema } from '@/lib/validation/commerce';

/**
 * Price a basket without placing it.
 *
 * The checkout screen needs the same numbers the order will be written with —
 * offer prices, coupon discount, delivery fee, VAT — and it must not compute them
 * itself, or the summary and the invoice drift apart. This is the read-only half
 * of `POST /api/orders`: same module, same rules, nothing written.
 *
 * Open to guests, because an anonymous shopper's basket lives in their browser and
 * they would otherwise be shown browser-computed totals — the very arithmetic this
 * endpoint exists to replace. `fromCart` is the one part that needs a session,
 * since a saved cart belongs to somebody.
 *
 * Failures come back with the reason ("That coupon has expired", "Only 2 left of
 * …") so the form can say what is wrong instead of failing at the last step.
 */
export const POST = withOptionalAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, orderQuoteSchema);
    if (!parsed.ok) return parsed.response;

    const { items, fromCart, couponCode, deliveryZoneId } = parsed.data;

    if (fromCart && !user) {
      return NextResponse.json(
        { error: 'Sign in to price your saved cart' },
        { status: 401 },
      );
    }

    const lines = fromCart ? await loadCartLines(db, user!.userId) : (items ?? []);

    const priced = await quoteOrder(db, { items: lines, couponCode, deliveryZoneId });
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: priced.status });
    }

    const { quote } = priced;

    return NextResponse.json({
      ...quoteTotals(quote),
      currency: quote.currency,
      vatRatePercent: quote.vatRatePercent,
      pricesIncludeVat: quote.pricesIncludeVat,
      freeDeliveryApplied: quote.freeDeliveryApplied,
      freeDeliveryThreshold: toRupees(quote.freeDeliveryThresholdPaisa),
      couponCode: quote.couponCode,
      couponDescription: quote.couponDescription,
      items: quote.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        name: line.productNameSnapshot,
        sku: line.skuSnapshot,
        quantity: line.quantity,
        unitPrice: toRupees(line.unitPricePaisa),
        listUnitPrice: toRupees(line.listUnitPricePaisa),
        lineTotal: toRupees(line.lineTotalPaisa),
        onOffer: line.unitPricePaisa < line.listUnitPricePaisa,
      })),
    });
  } catch (error) {
    console.error('Error quoting order:', error);
    return NextResponse.json({ error: 'Failed to price your cart' }, { status: 500 });
  }
});
