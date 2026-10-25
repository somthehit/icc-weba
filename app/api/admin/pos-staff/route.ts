import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staff } from '@/db/schema/pos-enterprise';
import { eq, desc } from 'drizzle-orm';
import { hashCredential } from '@/lib/security/crypto';

// GET: List all POS staff members for Admin Control Panel
export async function GET(request: NextRequest) {
  try {
    const list = await db
      .select({
        id: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        active: staff.active,
        hasPin: staff.pinHash,
        mustChangePassword: staff.mustChangePassword,
        mustChangePin: staff.mustChangePin,
        failedAttempts: staff.failedAttempts,
        lockedUntil: staff.lockedUntil,
        failedPinAttempts: staff.failedPinAttempts,
        pinLockedUntil: staff.pinLockedUntil,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt,
      })
      .from(staff)
      .orderBy(staff.role, desc(staff.createdAt));

    const enriched = list.map((item) => {
      const now = Date.now();
      const isPasswordLocked = Boolean(item.lockedUntil && item.lockedUntil.getTime() > now);
      const isPinLocked = Boolean(item.pinLockedUntil && item.pinLockedUntil.getTime() > now);

      return {
        ...item,
        hasPin: Boolean(item.hasPin),
        isPasswordLocked,
        isPinLocked,
        isLocked: isPasswordLocked || isPinLocked,
      };
    });

    return NextResponse.json({
      success: true,
      staff: enriched,
    });
  } catch (error: any) {
    console.error('Failed to list POS staff for admin:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create a new POS staff member (Cashier / Supervisor / Manager / Admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      staffCode,
      email,
      phone,
      role = 'cashier',
      password,
      pin,
    } = body;

    if (!name || !staffCode) {
      return NextResponse.json(
        { success: false, error: 'Staff name and staff code are required.' },
        { status: 400 }
      );
    }

    const cleanCode = String(staffCode).trim().toUpperCase();
    if (cleanCode.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Staff code must be at least 2 characters.' },
        { status: 400 }
      );
    }

    // Default password if not specified is 'Pos@12345'
    const cleanPassword = password ? String(password) : 'Pos@12345';
    if (cleanPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashCredential(cleanPassword);

    let pinHash: string | null = null;
    if (pin && String(pin).trim()) {
      const cleanPin = String(pin).trim();
      if (!/^\d{4,6}$/.test(cleanPin)) {
        return NextResponse.json(
          { success: false, error: 'PIN must be 4 to 6 numeric digits.' },
          { status: 400 }
        );
      }
      pinHash = await hashCredential(cleanPin);
    }

    // Check duplicate staff code
    const [existing] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.staffCode, cleanCode))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Staff code "${cleanCode}" is already in use.` },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(staff)
      .values({
        name: String(name).trim(),
        staffCode: cleanCode,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        role: role as any,
        passwordHash,
        pinHash,
        mustChangePassword: false,
        mustChangePin: false,
        active: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: `Staff member "${created.name}" created successfully.`,
      staff: {
        id: created.id,
        staffCode: created.staffCode,
        name: created.name,
        role: created.role,
        email: created.email,
        phone: created.phone,
        hasPin: Boolean(created.pinHash),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create POS staff:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Manage POS Staff (Unlock, Set PIN, Reset Password, Toggle Active, Edit Details)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Staff ID is required.' },
        { status: 400 }
      );
    }

    const [target] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Staff record not found.' },
        { status: 404 }
      );
    }

    // 1. UNLOCK ACCOUNT (Clear failed password & PIN lockouts)
    if (action === 'unlock') {
      await db
        .update(staff)
        .set({
          failedAttempts: 0,
          lockedUntil: null,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, id));

      return NextResponse.json({
        success: true,
        message: `Account for ${target.name} has been unlocked and failed attempts reset.`,
      });
    }

    // 2. SET / UPDATE PIN
    if (action === 'set-pin') {
      const { pin } = body;
      const cleanPin = String(pin || '').trim();

      if (!/^\d{4,6}$/.test(cleanPin)) {
        return NextResponse.json(
          { success: false, error: 'PIN must be between 4 and 6 numeric digits.' },
          { status: 400 }
        );
      }

      const pinHash = await hashCredential(cleanPin);
      await db
        .update(staff)
        .set({
          pinHash,
          failedPinAttempts: 0,
          pinLockedUntil: null,
          mustChangePin: false,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, id));

      return NextResponse.json({
        success: true,
        message: `Fast-action PIN updated successfully for ${target.name}.`,
      });
    }

    // 3. RESET PASSWORD
    if (action === 'reset-password') {
      const { password } = body;
      const cleanPassword = String(password || '').trim();

      if (cleanPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters.' },
          { status: 400 }
        );
      }

      const passwordHash = await hashCredential(cleanPassword);
      await db
        .update(staff)
        .set({
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, id));

      return NextResponse.json({
        success: true,
        message: `Password reset successfully for ${target.name}.`,
      });
    }

    // 4. TOGGLE ACTIVE STATUS
    if (action === 'toggle-active') {
      const nextActive = !target.active;
      await db
        .update(staff)
        .set({
          active: nextActive,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, id));

      return NextResponse.json({
        success: true,
        message: `Staff member ${target.name} is now ${nextActive ? 'ACTIVE' : 'DEACTIVATED'}.`,
        active: nextActive,
      });
    }

    // 5. UPDATE DETAILS (Name, Email, Phone, Role)
    if (action === 'update' || !action) {
      const { name, email, phone, role } = body;

      await db
        .update(staff)
        .set({
          name: name ? String(name).trim() : target.name,
          email: email ? String(email).trim().toLowerCase() : target.email,
          phone: phone ? String(phone).trim() : target.phone,
          role: role ? (role as any) : target.role,
          updatedAt: new Date(),
        })
        .where(eq(staff.id, id));

      return NextResponse.json({
        success: true,
        message: `Staff member ${target.name} updated successfully.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update POS staff:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove or permanently deactivate staff member
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
    }

    const [target] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Staff not found.' }, { status: 404 });
    }

    // Soft-deactivate to preserve historical shift & transaction foreign keys
    await db
      .update(staff)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(staff.id, id));

    return NextResponse.json({
      success: true,
      message: `Staff member "${target.name}" deactivated from POS access.`,
    });
  } catch (error: any) {
    console.error('Failed to delete POS staff:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
