import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  staff,
  staffLimits,
  limitOverrides,
  staffAuditLog,
} from '@/db/schema/pos-enterprise';
import { eq, desc, and, or, sql, lte, gt } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export interface RoleLimitDefaults {
  maxLineDiscountPct: number;
  maxInvoiceDiscountAmount: number;
  maxRefundAmount: number;
  maxVoidAmount: number;
  canOverridePrice: boolean;
  canNoSaleOpen: boolean;
  maxCashPayout: number;
  canCreditSale: boolean;
  returnWindowDays: number;
}

export const ROLE_LIMIT_DEFAULTS: Record<string, RoleLimitDefaults> = {
  cashier: {
    maxLineDiscountPct: 5.0,
    maxInvoiceDiscountAmount: 500.0,
    maxRefundAmount: 2000.0,
    maxVoidAmount: 1500.0,
    canOverridePrice: false,
    canNoSaleOpen: false,
    maxCashPayout: 1000.0,
    canCreditSale: false,
    returnWindowDays: 7,
  },
  senior_cashier: {
    maxLineDiscountPct: 10.0,
    maxInvoiceDiscountAmount: 2000.0,
    maxRefundAmount: 5000.0,
    maxVoidAmount: 5000.0,
    canOverridePrice: false,
    canNoSaleOpen: true,
    maxCashPayout: 3000.0,
    canCreditSale: true,
    returnWindowDays: 14,
  },
  supervisor: {
    maxLineDiscountPct: 15.0,
    maxInvoiceDiscountAmount: 5000.0,
    maxRefundAmount: 15000.0,
    maxVoidAmount: 20000.0,
    canOverridePrice: true,
    canNoSaleOpen: true,
    maxCashPayout: 10000.0,
    canCreditSale: true,
    returnWindowDays: 30,
  },
  store_manager: {
    maxLineDiscountPct: 25.0,
    maxInvoiceDiscountAmount: 20000.0,
    maxRefundAmount: 50000.0,
    maxVoidAmount: 50000.0,
    canOverridePrice: true,
    canNoSaleOpen: true,
    maxCashPayout: 25000.0,
    canCreditSale: true,
    returnWindowDays: 60,
  },
  admin: {
    maxLineDiscountPct: 50.0,
    maxInvoiceDiscountAmount: 100000.0,
    maxRefundAmount: 200000.0,
    maxVoidAmount: 200000.0,
    canOverridePrice: true,
    canNoSaleOpen: true,
    maxCashPayout: 100000.0,
    canCreditSale: true,
    returnWindowDays: 90,
  },
  inventory_manager: {
    maxLineDiscountPct: 0.0,
    maxInvoiceDiscountAmount: 0.0,
    maxRefundAmount: 0.0,
    maxVoidAmount: 0.0,
    canOverridePrice: false,
    canNoSaleOpen: false,
    maxCashPayout: 0.0,
    canCreditSale: false,
    returnWindowDays: 0,
  },
  sales_manager: {
    maxLineDiscountPct: 20.0,
    maxInvoiceDiscountAmount: 15000.0,
    maxRefundAmount: 25000.0,
    maxVoidAmount: 25000.0,
    canOverridePrice: true,
    canNoSaleOpen: true,
    maxCashPayout: 15000.0,
    canCreditSale: true,
    returnWindowDays: 45,
  },
  accountant: {
    maxLineDiscountPct: 0.0,
    maxInvoiceDiscountAmount: 0.0,
    maxRefundAmount: 10000.0,
    maxVoidAmount: 10000.0,
    canOverridePrice: false,
    canNoSaleOpen: true,
    maxCashPayout: 50000.0,
    canCreditSale: true,
    returnWindowDays: 30,
  },
  auditor: {
    maxLineDiscountPct: 0.0,
    maxInvoiceDiscountAmount: 0.0,
    maxRefundAmount: 0.0,
    maxVoidAmount: 0.0,
    canOverridePrice: false,
    canNoSaleOpen: false,
    maxCashPayout: 0.0,
    canCreditSale: false,
    returnWindowDays: 0,
  },
};

export const MATRIX_CAPABILITIES = [
  {
    domain: 'POS Counter Operations',
    description: 'Direct register sales, discounts, refunds, and cash drawer actions',
    items: [
      { key: 'create_sale', label: 'Scan & Create Sales Bills', desc: 'Process items and create cash/QR retail invoices' },
      { key: 'line_discount', label: 'Item-Level Line Discount', desc: 'Apply percentage markdown on individual cart items' },
      { key: 'invoice_discount', label: 'Invoice Subtotal Discount', desc: 'Apply lump-sum or percentage discount on entire bill' },
      { key: 'price_override', label: 'Manual Price Override', desc: 'Change catalog selling price during checkout' },
      { key: 'void_line_cart', label: 'Void Line / Cancel Cart', desc: 'Remove scanned item or void unfinalized bill' },
      { key: 'void_invoice', label: 'Void Completed Invoice', desc: 'Issue credit note / void finalized tax bill' },
      { key: 'cash_refund', label: 'Issue Cash Refund', desc: 'Hand physical cash back to customer for returned items' },
      { key: 'no_sale_open', label: 'No-Sale Drawer Kick', desc: 'Pop open cash till without an active transaction' },
      { key: 'cash_payout', label: 'Till Cash Payout / Drop', desc: 'Pay out vendor cash or transfer cash from drawer' },
      { key: 'credit_sale', label: 'Credit Sale (Khata Ledger)', desc: 'Issue bill against customer credit without immediate payment' },
      { key: 'return_window', label: 'Return Window Acceptance', desc: 'Accept customer return within permitted policy days' },
      { key: 'shift_reconciliation', label: 'Shift Close & Cash Count', desc: 'Perform shift end cash denomination declaration' },
    ],
  },
  {
    domain: 'Central Inventory & Warehouse',
    description: 'Stock level checks, warehouse adjustments, and transfers',
    items: [
      { key: 'view_stock', label: 'View Branch Stock Levels', desc: 'Lookup SKU inventory quantities across branches' },
      { key: 'stock_adjust', label: 'Stock Discrepancy Adjustments', desc: 'Write-in or write-out damaged or missing items' },
      { key: 'stock_transfer', label: 'Initiate Inter-Branch Transfer', desc: 'Dispatch stock to another branch or counter' },
      { key: 'receive_po', label: 'Receive Vendor Purchase Orders', desc: 'Check in newly received supplier shipments' },
      { key: 'barcode_print', label: 'Reprint Barcodes & Price Tags', desc: 'Generate thermal shelf labels and price stickers' },
    ],
  },
  {
    domain: 'Accounting & Store Governance',
    description: 'Financial ledgers, VAT compliance, audit trail, and staff control',
    items: [
      { key: 'view_financials', label: 'View Daily EOD & Sales Reports', desc: 'Access store revenue, tax summaries, and margins' },
      { key: 'approve_variance', label: 'Approve Cash Discrepancies', desc: 'Sign off on shift cash shortages or overages' },
      { key: 'gl_posting', label: 'Post to General Ledger (GL)', desc: 'Commit daily journal vouchers to central accounts' },
      { key: 'bank_recon', label: 'Bank Statement Reconciliation', desc: 'Match bank feed deposits against POS card/QR batches' },
      { key: 'audit_log', label: 'View Tamper-Evident Audit Trail', desc: 'Inspect immutable cryptographic system event ledger' },
      { key: 'manage_staff', label: 'Staff & Terminal Access Control', desc: 'Provision cashiers, reset PINs, and grant elevations' },
    ],
  },
];

/**
 * GET /api/accounting/limits
 * Fetches:
 * 1. Role defaults
 * 2. All staff with their current configured limits
 * 3. Active time-bound elevations and recent elevation history
 * 4. Visual matrix capabilities
 */
export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  try {
    const now = new Date();

    // 1. Auto-expire any outdated active elevations
    await db
      .update(limitOverrides)
      .set({ status: 'expired' })
      .where(and(eq(limitOverrides.status, 'active'), lte(limitOverrides.expiresAt, now)));

    // 2. Fetch all staff members
    const allStaff = await db
      .select({
        id: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        role: staff.role,
        branchId: staff.branchId,
        status: staff.status,
      })
      .from(staff)
      .orderBy(staff.role, staff.name);

    // 3. Fetch existing configured limits
    const existingLimits = await db.select().from(staffLimits);
    const limitsMap = new Map(existingLimits.map((l) => [l.staffId, l]));

    // 4. Fetch all elevations (active and recent history)
    const elevations = await db
      .select({
        id: limitOverrides.id,
        staffId: limitOverrides.staffId,
        grantedById: limitOverrides.grantedById,
        permissionKey: limitOverrides.permissionKey,
        overrideValue: limitOverrides.overrideValue,
        reason: limitOverrides.reason,
        status: limitOverrides.status,
        expiresAt: limitOverrides.expiresAt,
        createdAt: limitOverrides.createdAt,
        staffName: staff.name,
        staffCode: staff.staffCode,
        staffRole: staff.role,
      })
      .from(limitOverrides)
      .leftJoin(staff, eq(limitOverrides.staffId, staff.id))
      .orderBy(desc(limitOverrides.createdAt));

    // Map granted-by names
    const staffMap = new Map(allStaff.map((s) => [s.id, s]));
    const elevationsWithGranter = elevations.map((e) => {
      const granter = staffMap.get(e.grantedById);
      return {
        ...e,
        grantedByName: granter ? granter.name : 'System Administrator',
        grantedByRole: granter ? granter.role : 'admin',
        isCurrentlyActive: e.status === 'active' && new Date(e.expiresAt) > now,
        minutesRemaining: Math.max(0, Math.round((new Date(e.expiresAt).getTime() - now.getTime()) / 60000)),
      };
    });

    const activeElevations = elevationsWithGranter.filter((e) => e.isCurrentlyActive);
    const elevationHistory = elevationsWithGranter.slice(0, 30);

    // 5. Build combined staff profiles with effective limits
    const staffLimitsList = allStaff.map((st) => {
      const custom = limitsMap.get(st.id);
      const roleDef = ROLE_LIMIT_DEFAULTS[st.role] || ROLE_LIMIT_DEFAULTS.cashier;
      const staffActiveElevations = activeElevations.filter((ae) => ae.staffId === st.id);

      const effective = {
        maxLineDiscountPct: custom?.maxLineDiscountPct !== undefined && custom.maxLineDiscountPct !== null
          ? Number(custom.maxLineDiscountPct)
          : roleDef.maxLineDiscountPct,
        maxInvoiceDiscountAmount: custom?.maxInvoiceDiscountAmount !== undefined && custom.maxInvoiceDiscountAmount !== null
          ? Number(custom.maxInvoiceDiscountAmount)
          : roleDef.maxInvoiceDiscountAmount,
        maxRefundAmount: custom?.maxRefundAmount !== undefined && custom.maxRefundAmount !== null
          ? Number(custom.maxRefundAmount)
          : roleDef.maxRefundAmount,
        maxVoidAmount: custom?.maxVoidAmount !== undefined && custom.maxVoidAmount !== null
          ? Number(custom.maxVoidAmount)
          : roleDef.maxVoidAmount,
        canOverridePrice: custom?.canOverridePrice !== undefined && custom.canOverridePrice !== null
          ? custom.canOverridePrice
          : roleDef.canOverridePrice,
        canNoSaleOpen: custom?.canNoSaleOpen !== undefined && custom.canNoSaleOpen !== null
          ? custom.canNoSaleOpen
          : roleDef.canNoSaleOpen,
        maxCashPayout: custom?.maxCashPayout !== undefined && custom.maxCashPayout !== null
          ? Number(custom.maxCashPayout)
          : roleDef.maxCashPayout,
        canCreditSale: custom?.canCreditSale !== undefined && custom.canCreditSale !== null
          ? custom.canCreditSale
          : roleDef.canCreditSale,
        returnWindowDays: custom?.returnWindowDays !== undefined && custom.returnWindowDays !== null
          ? Number(custom.returnWindowDays)
          : roleDef.returnWindowDays,
      };

      // Check if limits differ from role defaults
      const hasCustomLimits = Boolean(
        custom &&
          (Number(custom.maxLineDiscountPct) !== roleDef.maxLineDiscountPct ||
            Number(custom.maxInvoiceDiscountAmount) !== roleDef.maxInvoiceDiscountAmount ||
            Number(custom.maxRefundAmount) !== roleDef.maxRefundAmount ||
            Number(custom.maxVoidAmount) !== roleDef.maxVoidAmount ||
            custom.canOverridePrice !== roleDef.canOverridePrice ||
            custom.canNoSaleOpen !== roleDef.canNoSaleOpen ||
            Number(custom.maxCashPayout) !== roleDef.maxCashPayout ||
            custom.canCreditSale !== roleDef.canCreditSale ||
            Number(custom.returnWindowDays) !== roleDef.returnWindowDays)
      );

      return {
        staffId: st.id,
        staffCode: st.staffCode,
        name: st.name,
        role: st.role,
        status: st.status,
        hasCustomLimits,
        limits: effective,
        roleDefaults: roleDef,
        updatedAt: custom?.updatedAt || null,
        activeElevations: staffActiveElevations,
      };
    });

    return NextResponse.json({
      success: true,
      roleDefaults: ROLE_LIMIT_DEFAULTS,
      matrixCapabilities: MATRIX_CAPABILITIES,
      staffLimits: staffLimitsList,
      activeElevations,
      elevationHistory,
    });
  } catch (err: any) {
    console.error('Error fetching staff limits:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

/**
 * POST /api/accounting/limits
 * Supported actions:
 * - UPDATE_STAFF_LIMITS: Updates limits for a specific staff member
 * - GRANT_ELEVATION: Manager grants temporary time-bound elevation
 * - REVOKE_ELEVATION: Early revocation of an active elevation
 * - RESET_ROLE_DEFAULT: Reverts a staff member's limits to their role defaults
 */
export const POST = withRole(['admin', 'sales'], async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action } = body;
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. UPDATE_STAFF_LIMITS
    if (action === 'UPDATE_STAFF_LIMITS') {
      const { staffId, limits, updatedById } = body;
      if (!staffId || !limits) {
        return NextResponse.json(
          { success: false, error: 'Staff ID and limits object are required.' },
          { status: 400 }
        );
      }

      const targetStaff = await db.select().from(staff).where(eq(staff.id, staffId));
      if (targetStaff.length === 0) {
        return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
      }

      // Upsert into staff_limits
      const existing = await db.select().from(staffLimits).where(eq(staffLimits.staffId, staffId));

      const payload = {
        staffId,
        maxLineDiscountPct: Number(limits.maxLineDiscountPct ?? 10.0),
        maxInvoiceDiscountAmount: Number(limits.maxInvoiceDiscountAmount ?? 1000.0),
        maxRefundAmount: Number(limits.maxRefundAmount ?? 5000.0),
        maxVoidAmount: Number(limits.maxVoidAmount ?? 5000.0),
        canOverridePrice: Boolean(limits.canOverridePrice),
        canNoSaleOpen: Boolean(limits.canNoSaleOpen),
        maxCashPayout: Number(limits.maxCashPayout ?? 2000.0),
        canCreditSale: Boolean(limits.canCreditSale),
        returnWindowDays: Number(limits.returnWindowDays ?? 7),
        updatedById: updatedById || null,
        updatedAt: new Date(),
      };

      if (existing.length === 0) {
        await db.insert(staffLimits).values(payload);
      } else {
        await db
          .update(staffLimits)
          .set(payload)
          .where(eq(staffLimits.staffId, staffId));
      }

      // Log in audit log
      await db.insert(staffAuditLog).values({
        actorName: 'Administrator',
        actorRole: 'admin',
        action: 'STAFF_LIMITS_UPDATED',
        targetId: `staff:${targetStaff[0].staffCode}`,
        targetType: 'staff_limits',
        details: {
          staffName: targetStaff[0].name,
          updatedLimits: payload,
        },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: `Updated operational limits for ${targetStaff[0].name} (${targetStaff[0].staffCode}).`,
      });
    }

    // 2. GRANT_ELEVATION (Maker-Checker temporary permission elevation)
    if (action === 'GRANT_ELEVATION') {
      const { staffId, grantedById, permissionKey, overrideValue, reason, durationMinutes, customExpiresAt } = body;

      if (!staffId || !permissionKey || overrideValue === undefined || !reason) {
        return NextResponse.json(
          { success: false, error: 'Staff, permission key, elevated value, and reason are required.' },
          { status: 400 }
        );
      }

      const targetStaff = await db.select().from(staff).where(eq(staff.id, staffId));
      if (targetStaff.length === 0) {
        return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
      }

      // Compute expiration timestamp
      let expiresAt: Date;
      if (customExpiresAt) {
        expiresAt = new Date(customExpiresAt);
      } else {
        const mins = Number(durationMinutes) || 120; // Default 2 hours
        expiresAt = new Date(Date.now() + mins * 60 * 1000);
      }

      // Find granter staff ID
      let granterId = grantedById;
      if (!granterId) {
        const adminUser = await db.select({ id: staff.id }).from(staff).where(eq(staff.role, 'admin')).limit(1);
        granterId = adminUser[0]?.id || staffId;
      }

      const granter = await db.select().from(staff).where(eq(staff.id, granterId));

      const newOverride = await db
        .insert(limitOverrides)
        .values({
          staffId,
          grantedById: granterId,
          permissionKey,
          overrideValue: String(overrideValue),
          reason,
          status: 'active',
          expiresAt,
        })
        .returning();

      // Log in audit log
      await db.insert(staffAuditLog).values({
        actorId: granterId,
        actorName: granter[0]?.name || 'Authorizing Supervisor',
        actorRole: granter[0]?.role || 'supervisor',
        action: 'ELEVATION_GRANTED',
        targetId: `staff:${targetStaff[0].staffCode}`,
        targetType: 'limit_override',
        details: {
          staffName: targetStaff[0].name,
          permissionKey,
          overrideValue: String(overrideValue),
          reason,
          expiresAt: expiresAt.toISOString(),
          elevationId: newOverride[0]?.id,
        },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: `Granted temporary elevation for ${targetStaff[0].name} until ${expiresAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`,
        elevation: newOverride[0],
      });
    }

    // 3. REVOKE_ELEVATION
    if (action === 'REVOKE_ELEVATION') {
      const { elevationId, reason } = body;
      if (!elevationId) {
        return NextResponse.json({ success: false, error: 'Elevation ID is required.' }, { status: 400 });
      }

      const target = await db.select().from(limitOverrides).where(eq(limitOverrides.id, elevationId));
      if (target.length === 0) {
        return NextResponse.json({ success: false, error: 'Elevation not found.' }, { status: 404 });
      }

      await db
        .update(limitOverrides)
        .set({ status: 'revoked' })
        .where(eq(limitOverrides.id, elevationId));

      // Audit log
      await db.insert(staffAuditLog).values({
        actorName: 'Administrator',
        actorRole: 'admin',
        action: 'ELEVATION_REVOKED',
        targetId: `elevation:${elevationId}`,
        targetType: 'limit_override',
        details: {
          elevationId,
          permissionKey: target[0].permissionKey,
          revokedReason: reason || 'Manual early revocation by manager',
        },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: 'Temporary elevation successfully revoked.',
      });
    }

    // 4. RESET_ROLE_DEFAULT
    if (action === 'RESET_ROLE_DEFAULT') {
      const { staffId } = body;
      if (!staffId) {
        return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
      }

      const targetStaff = await db.select().from(staff).where(eq(staff.id, staffId));
      if (targetStaff.length === 0) {
        return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
      }

      const roleDef = ROLE_LIMIT_DEFAULTS[targetStaff[0].role] || ROLE_LIMIT_DEFAULTS.cashier;

      await db
        .insert(staffLimits)
        .values({
          staffId,
          ...roleDef,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: staffLimits.staffId,
          set: {
            ...roleDef,
            updatedAt: new Date(),
          },
        });

      await db.insert(staffAuditLog).values({
        actorName: 'Administrator',
        actorRole: 'admin',
        action: 'STAFF_LIMITS_RESET_DEFAULT',
        targetId: `staff:${targetStaff[0].staffCode}`,
        targetType: 'staff_limits',
        details: {
          staffName: targetStaff[0].name,
          role: targetStaff[0].role,
          resetToDefaults: roleDef,
        },
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: `Limits for ${targetStaff[0].name} reset to ${targetStaff[0].role} role defaults.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error handling staff limits action:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
