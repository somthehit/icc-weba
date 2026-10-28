import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/loyalty/loyaltyService';
import { assertLoyaltyPermission } from '@/lib/loyalty/loyaltyPermissions';

export async function POST(request: NextRequest) {
  try {
    const authResult = await assertLoyaltyPermission(request, 'customer.merge');
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const {
      primaryCustomerId,
      secondaryCustomerId,
      reason,
      operatorName = authResult.user.email || 'Administrator',
    } = body;

    if (!primaryCustomerId || !secondaryCustomerId) {
      return NextResponse.json({ success: false, error: 'Both primary and secondary customer IDs are required.' }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ success: false, error: 'A mandatory merge reason is required.' }, { status: 400 });
    }

    const res = await LoyaltyService.mergeCustomerProfiles({
      primaryCustomerId,
      secondaryCustomerId,
      reason,
      operatorName,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Customer profiles successfully merged and points consolidated.',
    });
  } catch (error: any) {
    console.error('Admin Loyalty Merge Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
