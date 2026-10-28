// app/api/pos/loyalty/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';

// POST: Real-time calculation and validation of points redemption & offers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      coinsToRedeem = 0,
      orderSubtotal = 0,
      offerCode,
    } = body;

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'Customer ID is required.' }, { status: 400 });
    }

    const profile = await LoyaltyService.getCustomerProfile(customerId);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Customer membership profile not found.' }, { status: 404 });
    }

    // 1. Redemption Quote
    const redemptionQuote = await LoyaltyService.validateAndQuoteRedemption(
      customerId,
      Number(coinsToRedeem) || 0,
      Number(orderSubtotal) || 0
    );

    // 2. Offer Discount Calculation
    let offerQuote = {
      applied: false,
      code: '',
      title: '',
      discountAmount: 0,
      bonusCoins: 0,
      errorMessage: '',
    };

    if (offerCode) {
      const eligibleOffers = await LoyaltyService.getEligibleOffers(
        customerId,
        profile.currentLevelId,
        Number(orderSubtotal) || 0
      );

      const matched = eligibleOffers.find(
        (o) => o.code.toUpperCase() === String(offerCode).trim().toUpperCase()
      );

      if (matched) {
        offerQuote = {
          applied: true,
          code: matched.code,
          title: matched.title,
          discountAmount: matched.calculatedDiscount,
          bonusCoins: matched.bonusCoins,
          errorMessage: '',
        };
      } else {
        offerQuote = {
          applied: false,
          code: String(offerCode).trim().toUpperCase(),
          title: '',
          discountAmount: 0,
          bonusCoins: 0,
          errorMessage: `Offer code "${offerCode}" is not applicable to current tier (${profile.levelName}) or minimum order spend not reached.`,
        };
      }
    }

    // 3. Earning Estimation
    const netSpendAfterDiscounts = Math.max(
      0,
      Number(orderSubtotal) - redemptionQuote.discountNpr - offerQuote.discountAmount
    );

    const estimatedEarning = LoyaltyService.calculatePointsEarning(
      netSpendAfterDiscounts,
      profile.pointsEarningRate,
      offerQuote.bonusCoins
    );

    return NextResponse.json({
      success: true,
      profile,
      redemption: redemptionQuote,
      offer: offerQuote,
      earning: estimatedEarning,
      finalPayable: netSpendAfterDiscounts,
    });
  } catch (error: any) {
    console.error('POS Loyalty Quote Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
