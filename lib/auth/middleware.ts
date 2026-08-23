// lib/auth/middleware.ts
//
// Route-handler guards. The Edge middleware already rejects unauthenticated
// traffic, but these run again inside the handler so a route is never one
// matcher edit away from being wide open, and so the handler has verified
// claims to work with.

import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest, JWTPayload } from '@/lib/auth/utils';

export type UserRole = 'customer' | 'admin' | 'sales' | 'inventory_manager' | 'service_technician';

/** Every role that may reach the admin console. */
export const STAFF_ROLES: UserRole[] = [
  'admin',
  'sales',
  'inventory_manager',
  'service_technician',
];

export interface AuthContext {
  user: JWTPayload;
}

/**
 * `RouteContext` is whatever Next passes as the second handler argument — for
 * dynamic segments that is `{ params }`, which the guard forwards untouched.
 */
type Guarded<Ctx> = (
  request: NextRequest,
  auth: AuthContext,
  context: Ctx,
) => Promise<NextResponse> | NextResponse;

export function withAuth<Ctx = unknown>(handler: Guarded<Ctx>) {
  return async (request: NextRequest, context: Ctx) => {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return handler(request, { user }, context);
  };
}

/** The same context, for routes a guest is allowed to reach. */
export interface OptionalAuthContext {
  user: JWTPayload | null;
}

type MaybeGuarded<Ctx> = (
  request: NextRequest,
  auth: OptionalAuthContext,
  context: Ctx,
) => Promise<NextResponse> | NextResponse;

/**
 * For a route a guest may use but which behaves differently once signed in — the
 * checkout quote, where an anonymous shopper prices the basket in their browser
 * and a member prices the one saved in the database.
 *
 * Unlike `withAuth` this never rejects, so the handler must decide what an absent
 * session means. Reach for it only where a guest genuinely has a use for the
 * route; the Edge middleware's rule has to be relaxed to match.
 */
export function withOptionalAuth<Ctx = unknown>(handler: MaybeGuarded<Ctx>) {
  return async (request: NextRequest, context: Ctx) => {
    const user = await getUserFromRequest(request);
    return handler(request, { user }, context);
  };
}

export function withRole<Ctx = unknown>(roles: UserRole[], handler: Guarded<Ctx>) {
  return async (request: NextRequest, context: Ctx) => {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!roles.includes(user.role as UserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    return handler(request, { user }, context);
  };
}

export function withAdmin<Ctx = unknown>(handler: Guarded<Ctx>) {
  return withRole<Ctx>(STAFF_ROLES, handler);
}

export function withSuperAdmin<Ctx = unknown>(handler: Guarded<Ctx>) {
  return withRole<Ctx>(['admin'], handler);
}

export function withSales<Ctx = unknown>(handler: Guarded<Ctx>) {
  return withRole<Ctx>(['admin', 'sales'], handler);
}

export function withInventory<Ctx = unknown>(handler: Guarded<Ctx>) {
  return withRole<Ctx>(['admin', 'inventory_manager'], handler);
}

export function withService<Ctx = unknown>(handler: Guarded<Ctx>) {
  return withRole<Ctx>(['admin', 'service_technician'], handler);
}
