import { NextRequest, NextResponse } from "next/server";
import { applyTimedOffer, getEffectivePrice, syncCachedOfferPrices } from "@/services/offerService";
import { withRole } from "@/lib/auth/middleware";
import { parseJson, parseQuery } from "@/lib/validation/parse";
import { applyOfferSchema, effectivePriceQuerySchema } from "@/lib/validation/commerce";

/** Roles allowed to run a promotion — mirrors the policy table in middleware.ts. */
const PROMO_MANAGERS = ['admin', 'sales'] as const;

// GET /api/offers?productId=...&sellingPrice=...
export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req.url, effectivePriceQuerySchema);
    if (!query.ok) return query.response;

    const result = await getEffectivePrice(query.data.productId, query.data.sellingPrice);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error computing effective price:', error);
    return NextResponse.json({ error: "Failed to get effective price" }, { status: 500 });
  }
}

// POST /api/offers — start a timed discount on one product
export const POST = withRole([...PROMO_MANAGERS], async (req) => {
  try {
    const parsed = await parseJson(req, applyOfferSchema);
    if (!parsed.ok) return parsed.response;

    const offer = await applyTimedOffer(parsed.data);
    // applyTimedOffer updates by id and returns nothing when no row matched.
    if (!offer) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    console.error('Error applying offer:', error);
    return NextResponse.json({ error: "Failed to apply offer" }, { status: 500 });
  }
});

// PUT /api/offers — recompute the cached offer prices for every product
export const PUT = withRole([...PROMO_MANAGERS], async () => {
  try {
    await syncCachedOfferPrices();
    return NextResponse.json({ success: true, message: "Cached offer prices synchronized" });
  } catch (error: any) {
    console.error('Error syncing offer prices:', error);
    return NextResponse.json({ error: "Failed to sync offer prices" }, { status: 500 });
  }
});
