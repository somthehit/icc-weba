import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';
import { assertLoyaltyPermission } from '@/lib/loyalty/loyaltyPermissions';

export async function POST(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'points.adjust');
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const {
      customerId,
      points,
      type = 'credit', // 'credit' | 'debit'
      reason,
      operatorId,
      operatorName = authResult.user.email || 'Administrator',
    } = body;

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'Customer ID is required.' }, { status: 400 });
    }

    const res = await LoyaltyService.manualPointAdjustment({
      customerId,
      points: Number(points),
      type,
      reason,
      operatorId: operatorId || authResult.user.userId,
      operatorName,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully adjusted ${points} points (${type}). New balance: ${res.newBalance} coins.`,
      newBalance: res.newBalance,
    });
  } catch (error: any) {
    console.error('Admin Loyalty Adjustment Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
