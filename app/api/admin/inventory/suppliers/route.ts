// app/api/admin/inventory/suppliers/route.ts
// Supplier Master API: CRUD, Nepal PAN/VAT registration, lead time, and payment terms

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers, purchaseOrders, goodsReceiptNotes } from '@/db/schema/accounting';
import { auditLogs } from '@/db/schema/audit';
import { eq, desc, sql, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const allSuppliers = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
        email: suppliers.email,
        address: suppliers.address,
        vatPanNo: suppliers.vatPanNo,
        notes: suppliers.notes,
        isActive: suppliers.isActive,
        createdAt: suppliers.createdAt,
      })
      .from(suppliers)
      .orderBy(desc(suppliers.createdAt));

    // Aggregate POs and GRNs per supplier
    const enrichedSuppliers = await Promise.all(
      allSuppliers.map(async (s) => {
        const [poCount] = await db
          .select({ count: count() })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.supplierId, s.id));

        const [grnCount] = await db
          .select({ count: count() })
          .from(goodsReceiptNotes)
          .where(eq(goodsReceiptNotes.supplierId, s.id));

        return {
          ...s,
          totalPurchaseOrders: poCount?.count || 0,
          totalGrns: grnCount?.count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      suppliers: enrichedSuppliers,
    });
  } catch (error: any) {
    console.error('Failed to fetch suppliers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      contactPerson = '',
      phone = '',
      email = '',
      address = '',
      vatPanNo = '',
      notes = '',
      isActive = true,
      actorName = 'Store Manager',
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Supplier company name is required.' },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing
      const [updated] = await db
        .update(suppliers)
        .set({
          name,
          contactPerson,
          phone,
          email,
          address,
          vatPanNo,
          notes,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, Number(id)))
        .returning();

      await db.insert(auditLogs).values({
        action: 'supplier.updated',
        entityType: 'supplier',
        entityId: updated.id,
        metadata: { actorName, supplierName: name, vatPanNo },
      });

      return NextResponse.json({
        success: true,
        message: `Supplier "${name}" updated successfully.`,
        supplier: updated,
      });
    }

    // Create new
    const [inserted] = await db
      .insert(suppliers)
      .values({
        name,
        contactPerson,
        phone,
        email,
        address,
        vatPanNo,
        notes,
        isActive,
      })
      .returning();

    await db.insert(auditLogs).values({
      action: 'supplier.created',
      entityType: 'supplier',
      entityId: inserted.id,
      metadata: { actorName, supplierName: name, vatPanNo },
    });

    return NextResponse.json({
      success: true,
      message: `Supplier "${name}" registered successfully.`,
      supplier: inserted,
    });
  } catch (error: any) {
    console.error('Failed to save supplier:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
