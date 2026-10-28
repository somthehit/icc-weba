import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payrollDiscrepancies } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const cashierParam = searchParams.get('cashier');
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');

    const conditions: any[] = [];

    if (dateParam && dateParam !== 'ALL') {
      conditions.push(eq(payrollDiscrepancies.businessDate, dateParam));
    }
    if (cashierParam && cashierParam !== 'ALL') {
      conditions.push(eq(payrollDiscrepancies.cashierCode, cashierParam));
    }
    if (statusParam && statusParam !== 'ALL') {
      conditions.push(eq(payrollDiscrepancies.reviewerAndApprovalStatus, statusParam));
    }
    if (typeParam && typeParam !== 'ALL') {
      conditions.push(eq(payrollDiscrepancies.discrepancyType, typeParam));
    }

    const discrepancies = await db
      .select()
      .from(payrollDiscrepancies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payrollDiscrepancies.createdAt));

    return NextResponse.json({
      success: true,
      discrepancies,
      totalCount: discrepancies.length,
    });
  } catch (error: any) {
    console.error('Failed to list payroll discrepancies:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
