import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';
import { assertLoyaltyPermission } from '@/lib/loyalty/loyaltyPermissions';

export async function POST(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'membership.override');
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const {
      customerId,
      newLevelId,
      reason,
      operatorName = authResult.user.email || 'Administrator',
    } = body;

    if (!customerId || !newLevelId) {
      return NextResponse.json({ success: false, error: 'Customer ID and New Level ID are required.' }, { status: 400 });
    }

    const res = await LoyaltyService.manualLevelOverride({
      customerId,
      newLevelId,
      reason,
      operatorName,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Customer tier successfully updated to "${newLevelId}".`,
    });
  } catch (error: any) {
    console.error('Admin Loyalty Override Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
