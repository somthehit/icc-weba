// lib/loyalty/loyaltyPermissions.ts
// Granular RBAC and Permission Enforcement for Loyalty and Membership Operations

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, JWTPayload } from '@/lib/auth/utils';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type LoyaltyAction =
  | 'view'
  | 'points.adjust'
  | 'membership.override'
  | 'level.manage'
  | 'offer.manage'
  | 'customer.merge'
  | 'points.expire';

export function isSuperUser(user: JWTPayload): boolean {
  return user.role === 'admin' || (user.role as string) === 'super_admin';
}

export function canPerformLoyaltyAction(user: JWTPayload, action: LoyaltyAction): boolean {
  if (isSuperUser(user)) return true;

  const role = (user.role || '').toLowerCase();

  switch (action) {
    case 'view':
      return [
        'admin',
        'super_admin',
        'store_manager',
        'manager',
        'supervisor',
        'accountant',
        'cashier',
        'sales',
        'auditor',
      ].includes(role);

    case 'offer.manage':
      return ['admin', 'super_admin', 'store_manager', 'manager'].includes(role);

    case 'level.manage':
      return ['admin', 'super_admin', 'store_manager'].includes(role);

    case 'points.adjust':
      return ['admin', 'super_admin', 'store_manager', 'manager', 'supervisor'].includes(role);

    case 'membership.override':
      return ['admin', 'super_admin', 'store_manager', 'manager'].includes(role);

    case 'customer.merge':
      return ['admin', 'super_admin', 'store_manager'].includes(role);

    case 'points.expire':
      return ['admin', 'super_admin', 'store_manager'].includes(role);

    default:
      return false;
  }
}

/**
 * Guard route handlers with specific loyalty permission check.
 * Allows POS cashiers and managers with appropriate roles.
 */
export async function assertLoyaltyPermission(
  request: NextRequest,
  action: LoyaltyAction
): Promise<{ user: JWTPayload } | NextResponse> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  if (!canPerformLoyaltyAction(user, action)) {
    return NextResponse.json(
      {
        success: false,
        error: `Forbidden: Your role (${user.role}) does not have permission for loyalty action "${action}".`,
      },
      { status: 403 }
    );
  }

  return { user };
}
