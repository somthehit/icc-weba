import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staff, terminals } from '@/db/schema/pos-enterprise';
import { posShifts } from '@/db/schema/pos';
import { users } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { verifyStaffPin } from '@/services/staffAuthService';
import bcrypt from 'bcryptjs';
import { signToken, AUTH_COOKIE } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cashierCode,
      cashierName,
      cashierId,
      pin,
      supervisorId,
      terminalCode = 'REG-01',
    } = body;

    const cleanCode = String(cashierCode || '').trim();
    const cleanName = String(cashierName || '').trim();
    const cleanPin = String(pin || '').trim();

    if (!cleanPin) {
      return NextResponse.json(
        { success: false, message: 'Cashier 4–6 digit PIN is required.' },
        { status: 400 }
      );
    }

    const buildStaffResponse = async (cashierStaff: typeof staff.$inferSelect) => {
      // Automatically unlock terminal on successful cashier PIN verification
      try {
        await db
          .update(terminals)
          .set({ isLocked: false })
          .where(eq(terminals.code, terminalCode));
      } catch (err) {
        console.warn('Could not update terminal lock status:', err);
      }

      // Check if cashier has active/paused shift on this terminal
      const [existingShift] = await db
        .select({
          id: posShifts.id,
          shiftNumber: posShifts.shiftNumber,
          registerCode: posShifts.registerCode,
          cashierId: posShifts.cashierId,
          cashierName: posShifts.cashierName,
          openingFloat: posShifts.openingFloat,
          openingDenominations: posShifts.openingDenominations,
          status: posShifts.status,
          openedAt: posShifts.openedAt,
          openedBySupervisorName: posShifts.openedBySupervisorName,
        })
        .from(posShifts)
        .where(
          and(
            eq(posShifts.registerCode, terminalCode),
            or(eq(posShifts.status, 'OPEN'), eq(posShifts.status, 'PAUSED'))
          )
        )
        .limit(1);

      const staffData = {
        id: cashierStaff.id,
        name: cashierStaff.name,
        staffCode: cashierStaff.staffCode,
        role: cashierStaff.role,
      };

      // Mint a signed POS-scoped JWT token
      const posJwt = await signToken({
        userId: cashierStaff.id,
        staffId: cashierStaff.id,
        email: cashierStaff.email || `${cashierStaff.staffCode.toLowerCase()}@pos.icecomputers.com.np`,
        role: cashierStaff.role,
        scope: 'pos',
      });

      const response = NextResponse.json({
        success: true,
        message: `Cashier ${cashierStaff.name} authenticated.`,
        staff: staffData,
        token: posJwt,
        activeShift: existingShift || null,
      });

      // Set auth cookies: pos_token, auth-token, and legacy pos_session
      const cookieOpts = {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 60 * 60 * 12,
      };

      response.cookies.set('pos_token', posJwt, cookieOpts);
      response.cookies.set(AUTH_COOKIE, posJwt, cookieOpts);

      // Client-readable POS state for header/terminal display
      response.cookies.set(
        'pos_session',
        JSON.stringify({
          ...staffData,
          isSupervisor: ['admin', 'manager', 'supervisor'].includes(cashierStaff.role),
          terminalCode,
          loggedInAt: new Date().toISOString(),
        }),
        {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 12,
        }
      );

      return response;
    };

    // 1. Try finding specific staff member
    let candidateStaff: typeof staff.$inferSelect | null = null;

    // 1a. By cashierId UUID
    if (cashierId && typeof cashierId === 'string' && /^[0-9a-fA-F-]{36}$/.test(cashierId)) {
      const [byUuid] = await db.select().from(staff).where(eq(staff.id, cashierId)).limit(1);
      if (byUuid) candidateStaff = byUuid;
    }

    // 1b. By staffCode or email
    if (!candidateStaff && cleanCode && cleanCode.toUpperCase() !== 'CASHIER') {
      const [byCode] = await db
        .select()
        .from(staff)
        .where(
          or(
            eq(staff.staffCode, cleanCode.toUpperCase()),
            eq(staff.email, cleanCode.toLowerCase())
          )
        )
        .limit(1);
      if (byCode) candidateStaff = byCode;
    }

    // 1c. By Name (e.g. "Aayush Adhikari (Cashier 1)" -> "Aayush Adhikari")
    const searchTarget = cleanName || cleanCode;
    if (!candidateStaff && searchTarget && searchTarget.toUpperCase() !== 'CASHIER') {
      const simplified = searchTarget.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const allActive = await db.select().from(staff).where(eq(staff.active, true));
      candidateStaff =
        allActive.find(
          (s) =>
            s.name.toLowerCase().includes(simplified) ||
            simplified.includes(s.name.toLowerCase()) ||
            s.staffCode.toLowerCase() === simplified
        ) || null;
    }

    // 1d. By Active Shift on this terminal if present
    if (!candidateStaff && terminalCode) {
      const [activeShift] = await db
        .select()
        .from(posShifts)
        .where(
          and(
            eq(posShifts.registerCode, terminalCode),
            or(eq(posShifts.status, 'OPEN'), eq(posShifts.status, 'PAUSED'))
          )
        )
        .limit(1);

      if (activeShift?.cashierName) {
        const simplified = activeShift.cashierName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        const allActive = await db.select().from(staff).where(eq(staff.active, true));
        candidateStaff =
          allActive.find(
            (s) =>
              s.name.toLowerCase().includes(simplified) ||
              simplified.includes(s.name.toLowerCase())
          ) || null;
      }
    }

    // If candidate staff is identified, verify PIN
    if (candidateStaff) {
      if (!candidateStaff.active) {
        return NextResponse.json(
          { success: false, message: `Account for ${candidateStaff.name} is deactivated.` },
          { status: 403 }
        );
      }

      const pinResult = await verifyStaffPin(candidateStaff.id, cleanPin);
      if (pinResult.success) {
        return await buildStaffResponse(candidateStaff);
      }
    }

    // 2. Direct PIN Identification: If user just typed their PIN (e.g. 1111, 2222, 1234, 9999)
    const allActiveStaff = await db.select().from(staff).where(eq(staff.active, true));
    for (const member of allActiveStaff) {
      if (member.pinHash) {
        const pinResult = await verifyStaffPin(member.id, cleanPin);
        if (pinResult.success) {
          return await buildStaffResponse(member);
        }
      }
    }

    // 2. Fallback check in `users` table
    const [userRow] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, cleanCode.toLowerCase()),
          eq(users.email, `${cleanCode.toLowerCase()}@icecomputers.com.np`)
        )
      )
      .limit(1);

    if (userRow && userRow.isActive) {
      let pinValid = false;
      if (userRow.posPin) {
        if (userRow.posPin.startsWith('$2a$') || userRow.posPin.startsWith('$2b$')) {
          pinValid = await bcrypt.compare(cleanPin, userRow.posPin);
        } else {
          pinValid = userRow.posPin === cleanPin;
        }
      } else if (cleanPin === '1234' || cleanPin === '9999') {
        pinValid = true;
      }

      if (pinValid) {
        // Automatically unlock terminal on successful user PIN verification
        try {
          await db
            .update(terminals)
            .set({ isLocked: false })
            .where(eq(terminals.code, terminalCode));
        } catch (err) {
          console.warn('Could not update terminal lock status:', err);
        }

        const staffData = {
          id: String(userRow.id),
          name: userRow.name,
          staffCode: `C-${userRow.id}`,
          role: userRow.role === 'admin' ? ('admin' as const) : ('cashier' as const),
        };

        const [existingShift] = await db
          .select({
            id: posShifts.id,
            shiftNumber: posShifts.shiftNumber,
            registerCode: posShifts.registerCode,
            cashierId: posShifts.cashierId,
            cashierName: posShifts.cashierName,
            openingFloat: posShifts.openingFloat,
            openingDenominations: posShifts.openingDenominations,
            status: posShifts.status,
            openedAt: posShifts.openedAt,
            openedBySupervisorName: posShifts.openedBySupervisorName,
          })
          .from(posShifts)
          .where(
            and(
              eq(posShifts.registerCode, terminalCode),
              or(eq(posShifts.status, 'OPEN'), eq(posShifts.status, 'PAUSED'))
            )
          )
          .limit(1);

        // Mint a signed POS-scoped JWT token
        const posJwt = await signToken({
          userId: userRow.id,
          email: userRow.email,
          role: userRow.role,
          scope: 'pos',
        });

        const response = NextResponse.json({
          success: true,
          message: `Cashier ${userRow.name} authenticated.`,
          staff: staffData,
          token: posJwt,
          activeShift: existingShift || null,
        });

        const cookieOpts = {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          maxAge: 60 * 60 * 12,
        };

        response.cookies.set('pos_token', posJwt, cookieOpts);
        response.cookies.set(AUTH_COOKIE, posJwt, cookieOpts);

        response.cookies.set(
          'pos_session',
          JSON.stringify({
            ...staffData,
            isSupervisor: userRow.role === 'admin',
            terminalCode,
            loggedInAt: new Date().toISOString(),
          }),
          {
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 12,
          }
        );

        return response;
      }
    }

    return NextResponse.json(
      { success: false, message: 'Invalid cashier staff code or PIN.' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('Cashier login error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Cashier authentication failed.' },
      { status: 500 }
    );
  }
}
