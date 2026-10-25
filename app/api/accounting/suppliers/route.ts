import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers, purchaseBills, purchaseOrders } from '@/db/schema/accounting';
import { desc, eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const list = await db
      .select()
      .from(suppliers)
      .orderBy(suppliers.name);

    const suppliersWithMetrics = await Promise.all(
      list.map(async (sup) => {
        let totalBilled = 0;
        let totalPaid = 0;
        let openBillsCount = 0;

        try {
          const bills = await db
            .select()
            .from(purchaseBills)
            .where(eq(purchaseBills.supplierId, sup.id));

          for (const b of bills) {
            totalBilled += Number(b.totalAmount || 0);
            totalPaid += Number(b.amountPaid || 0);
            if (b.status !== 'paid') openBillsCount++;
          }
        } catch (e) {}

        return {
          ...sup,
          totalBilled,
          totalPaid,
          outstandingBalance: Math.max(0, totalBilled - totalPaid),
          openBillsCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      suppliers: suppliersWithMetrics,
    });
  } catch (error: any) {
    console.error('Suppliers API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch suppliers',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, contactPerson, phone, email, address, vatPanNo, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Supplier name is required' }, { status: 400 });
    }

    const [newSup] = await db
      .insert(suppliers)
      .values({
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        vatPanNo: vatPanNo?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      supplier: newSup,
    });
  } catch (error: any) {
    console.error('Create Supplier Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create supplier',
    }, { status: 500 });
  }
}
