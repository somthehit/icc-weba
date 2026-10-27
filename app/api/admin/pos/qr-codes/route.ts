import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posBankQrs } from '@/db/schema/pos';
import { eq, desc, asc } from 'drizzle-orm';
import { getUserFromRequest } from '@/lib/auth/utils';
import { STAFF_ROLES } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

async function checkAdminOrStaff(request: NextRequest) {
  const caller = await getUserFromRequest(request);
  if (!caller) return false;
  return STAFF_ROLES.includes(caller.role as (typeof STAFF_ROLES)[number]) || caller.role === 'admin' || caller.role === 'accountant';
}

/**
 * GET /api/admin/pos/qr-codes
 * Returns all bank QRs (active and inactive) for admin management
 */
export async function GET(request: NextRequest) {
  try {
    const list = await db
      .select()
      .from(posBankQrs)
      .orderBy(desc(posBankQrs.isDefault), asc(posBankQrs.displayOrder), desc(posBankQrs.createdAt));

    return NextResponse.json({
      success: true,
      count: list.length,
      qrCodes: list,
    });
  } catch (error: any) {
    console.error('Error fetching admin POS QR codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank QR codes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pos/qr-codes
 * Creates a new Bank or Wallet QR Profile
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthorized = await checkAdminOrStaff(request);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Staff or Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      bankName,
      accountName,
      accountNumber,
      qrType = 'fonepay',
      merchantCode,
      qrImageUrl,
      qrPayloadTemplate,
      chartAccountId,
      isActive = true,
      isDefault = false,
      displayOrder = 0,
      instructions,
    } = body;

    if (!bankName?.trim() || !accountName?.trim() || !accountNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Bank Name, Account Name, and Account/Wallet Number are required.' },
        { status: 400 }
      );
    }

    // If marked default, unset other defaults
    if (isDefault) {
      await db.update(posBankQrs).set({ isDefault: false });
    }

    const [created] = await db
      .insert(posBankQrs)
      .values({
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        qrType: qrType || 'fonepay',
        merchantCode: merchantCode?.trim() || null,
        qrImageUrl: qrImageUrl?.trim() || null,
        qrPayloadTemplate: qrPayloadTemplate?.trim() || null,
        chartAccountId: chartAccountId || null,
        isActive: Boolean(isActive),
        isDefault: Boolean(isDefault),
        displayOrder: Number(displayOrder) || 0,
        instructions: instructions?.trim() || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: `${created.bankName} QR profile created successfully.`,
      qrCode: created,
    });
  } catch (error: any) {
    console.error('Error creating bank QR code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create bank QR profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/pos/qr-codes
 * Updates an existing Bank QR profile (details, active status, default toggle)
 */
export async function PUT(request: NextRequest) {
  try {
    const isAuthorized = await checkAdminOrStaff(request);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Staff or Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'QR Code ID is required.' }, { status: 400 });
    }

    // If making this QR the default, unset default on other records
    if (updates.isDefault === true) {
      await db.update(posBankQrs).set({ isDefault: false });
    }

    const payload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (updates.bankName !== undefined) payload.bankName = updates.bankName.trim();
    if (updates.accountName !== undefined) payload.accountName = updates.accountName.trim();
    if (updates.accountNumber !== undefined) payload.accountNumber = updates.accountNumber.trim();
    if (updates.qrType !== undefined) payload.qrType = updates.qrType;
    if (updates.merchantCode !== undefined) payload.merchantCode = updates.merchantCode?.trim() || null;
    if (updates.qrImageUrl !== undefined) payload.qrImageUrl = updates.qrImageUrl?.trim() || null;
    if (updates.qrPayloadTemplate !== undefined) payload.qrPayloadTemplate = updates.qrPayloadTemplate?.trim() || null;
    if (updates.chartAccountId !== undefined) payload.chartAccountId = updates.chartAccountId || null;
    if (updates.isActive !== undefined) payload.isActive = Boolean(updates.isActive);
    if (updates.isDefault !== undefined) payload.isDefault = Boolean(updates.isDefault);
    if (updates.displayOrder !== undefined) payload.displayOrder = Number(updates.displayOrder) || 0;
    if (updates.instructions !== undefined) payload.instructions = updates.instructions?.trim() || null;

    const [updated] = await db
      .update(posBankQrs)
      .set(payload)
      .where(eq(posBankQrs.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'QR code not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `${updated.bankName} updated successfully.`,
      qrCode: updated,
    });
  } catch (error: any) {
    console.error('Error updating bank QR code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update bank QR profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/pos/qr-codes
 * Deletes a Bank QR profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const isAuthorized = await checkAdminOrStaff(request);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required.' }, { status: 400 });
    }

    const [deleted] = await db
      .delete(posBankQrs)
      .where(eq(posBankQrs.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'QR code not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `${deleted.bankName} deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting bank QR code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete bank QR profile' },
      { status: 500 }
    );
  }
}
