// app/api/admin/inventory/warranties/route.ts
// Warranty Claims & RMA Tracking API

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { warrantyClaims, productSerials } from '@/db/schema/warehouse-enterprise';
import { products } from '@/db/schema/catalog';
import { suppliers } from '@/db/schema/accounting';
import { auditLogs } from '@/db/schema/audit';
import { eq, desc, or, ilike } from 'drizzle-orm';

// GET: List warranty claims
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const claimStatus = searchParams.get('status');

    const claims = await db
      .select({
        id: warrantyClaims.id,
        claimNumber: warrantyClaims.claimNumber,
        serialId: warrantyClaims.serialId,
        serialNumber: productSerials.serialNumber,
        productId: warrantyClaims.productId,
        productName: products.name,
        sku: products.sku,
        customerName: warrantyClaims.customerName,
        customerPhone: warrantyClaims.customerPhone,
        customerEmail: warrantyClaims.customerEmail,
        invoiceNumber: warrantyClaims.invoiceNumber,
        issueDescription: warrantyClaims.issueDescription,
        warrantyStatus: warrantyClaims.warrantyStatus,
        claimStatus: warrantyClaims.claimStatus,
        technicianNotes: warrantyClaims.technicianNotes,
        resolution: warrantyClaims.resolution,
        supplierRmaNumber: warrantyClaims.supplierRmaNumber,
        supplierName: suppliers.name,
        receivedDate: warrantyClaims.receivedDate,
        resolvedDate: warrantyClaims.resolvedDate,
        handledByName: warrantyClaims.handledByName,
        createdAt: warrantyClaims.createdAt,
      })
      .from(warrantyClaims)
      .leftJoin(productSerials, eq(warrantyClaims.serialId, productSerials.id))
      .leftJoin(products, eq(warrantyClaims.productId, products.id))
      .leftJoin(suppliers, eq(warrantyClaims.supplierId, suppliers.id))
      .orderBy(desc(warrantyClaims.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      claims,
    });
  } catch (error: any) {
    console.error('Failed to fetch warranty claims:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create or Update Warranty / RMA Claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      serialNumber,
      productId,
      customerName,
      customerPhone,
      customerEmail = '',
      invoiceNumber = '',
      issueDescription,
      claimStatus = 'received',
      technicianNotes = '',
      resolution = '',
      supplierRmaNumber = '',
      supplierId,
      handledByName = 'Service Technician',
    } = body;

    if (id) {
      // Update claim status
      const [updated] = await db
        .update(warrantyClaims)
        .set({
          claimStatus: claimStatus as any,
          technicianNotes,
          resolution,
          supplierRmaNumber,
          resolvedDate: ['repaired', 'replaced', 'closed_rejected'].includes(claimStatus)
            ? new Date().toISOString().slice(0, 10)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(warrantyClaims.id, String(id)))
        .returning();

      return NextResponse.json({
        success: true,
        message: `Warranty claim #${updated.claimNumber} updated to "${claimStatus}".`,
        claim: updated,
      });
    }

    // New Claim
    if (!customerName || !customerPhone || !issueDescription) {
      return NextResponse.json(
        { success: false, error: 'Customer name, phone, and issue description are required.' },
        { status: 400 }
      );
    }

    const claimNumber = `RMA-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    let resolvedSerialId: string | null = null;
    let resolvedProductId: string | null = productId ? String(productId) : null;

    if (serialNumber) {
      const [s] = await db
        .select()
        .from(productSerials)
        .where(eq(productSerials.serialNumber, serialNumber.trim()))
        .limit(1);

      if (s) {
        resolvedSerialId = s.id;
        resolvedProductId = s.productId;
        // Update serial status
        await db
          .update(productSerials)
          .set({ status: 'under_repair', updatedAt: new Date() })
          .where(eq(productSerials.id, s.id));
      }
    }

    if (!resolvedProductId) {
      return NextResponse.json(
        { success: false, error: 'Valid product ID or serial number is required to register a warranty claim.' },
        { status: 400 }
      );
    }

    const [newClaim] = await db
      .insert(warrantyClaims)
      .values({
        claimNumber,
        serialId: resolvedSerialId,
        productId: resolvedProductId,
        customerName,
        customerPhone,
        customerEmail,
        invoiceNumber,
        issueDescription,
        warrantyStatus: 'under_warranty',
        claimStatus: 'received',
        technicianNotes,
        supplierRmaNumber,
        supplierId: supplierId ? String(supplierId) : null,
        receivedDate: new Date().toISOString().slice(0, 10),
        handledByName,
      })
      .returning();

    await db.insert(auditLogs).values({
      action: 'warranty.claim_created',
      entityType: 'warranty_claim',
      entityId: newClaim.id,
      metadata: { claimNumber, serialNumber, customerName, handledByName },
    });

    return NextResponse.json({
      success: true,
      message: `Warranty claim ${claimNumber} registered successfully.`,
      claim: newClaim,
    });
  } catch (error: any) {
    console.error('Failed to save warranty claim:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
