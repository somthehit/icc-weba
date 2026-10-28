// app/api/admin/loyalty/expiry/route.ts
// Automated points expiry check and batch execution endpoint

import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';
import { assertLoyaltyPermission } from '@/lib/loyalty/loyaltyPermissions';

export const dynamic = 'force-dynamic';

// GET: Summary of overdue points and upcoming expiries (preview before execution)
export async function GET(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'view');
    if (authResult instanceof NextResponse) return authResult;

    const summary = await LoyaltyService.getExpiringPointsSummary();

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error('Loyalty Expiry GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Execute batch expiration of all overdue points
export async function POST(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'points.expire');
    if (authResult instanceof NextResponse) return authResult;

    const result = await LoyaltyService.expireOverduePoints();

    return NextResponse.json({
      success: true,
      message: `Batch expiry executed: ${result.expiredPointsTotal} points expired across ${result.affectedCustomers} customers (${result.processedCount} ledger entries processed).`,
      result,
    });
  } catch (error: any) {
    console.error('Loyalty Expiry POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
