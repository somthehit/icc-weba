import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posBankQrs } from '@/db/schema/pos';
import { eq, asc, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const list = await db
      .select({
        id: posBankQrs.id,
        bankName: posBankQrs.bankName,
        accountName: posBankQrs.accountName,
        accountNumber: posBankQrs.accountNumber,
        qrType: posBankQrs.qrType,
        merchantCode: posBankQrs.merchantCode,
        qrImageUrl: posBankQrs.qrImageUrl,
        qrPayloadTemplate: posBankQrs.qrPayloadTemplate,
        isDefault: posBankQrs.isDefault,
        displayOrder: posBankQrs.displayOrder,
        instructions: posBankQrs.instructions,
      })
      .from(posBankQrs)
      .where(eq(posBankQrs.isActive, true))
      .orderBy(desc(posBankQrs.isDefault), asc(posBankQrs.displayOrder), asc(posBankQrs.bankName));

    return NextResponse.json({
      success: true,
      count: list.length,
      qrCodes: list,
    });
  } catch (error: any) {
    console.error('Failed to fetch active POS bank QRs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank QR codes.' },
      { status: 500 }
    );
  }
}
