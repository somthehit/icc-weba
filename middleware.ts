// middleware.ts
//
// Edge gate in front of every /api route.
//
// The previous version listed '/' as a public route and matched with
// `pathname.startsWith(route)`, so every single API path was treated as public
// and the token check never ran. To make that class of mistake impossible the
// policy is now an explicit table: each rule states its own match mode, and
// anything not covered is denied to everyone but a full admin.
//
// Route handlers re-verify with the `withAuth`/`withRole` guards. This layer is
// the coarse net, not the only one.

import { NextRequest, NextResponse } from 'next/server';

import { AUTH_COOKIE, verifyToken } from '@/lib/auth/jwt';

type Role = 'customer' | 'admin' | 'sales' | 'inventory_manager' | 'service_technician';

/** Anyone, signed in or not. */
const PUBLIC = 'public' as const;
/** Any valid session, regardless of role. */
const SIGNED_IN = 'signed-in' as const;

type Access = typeof PUBLIC | typeof SIGNED_IN | readonly Role[];

interface Rule {
  path: string;
  /** 'exact' matches only that path; 'prefix' also matches its children. */
  match: 'exact' | 'prefix';
  /** GET and HEAD. */
  read: Access;
  /** POST, PUT, PATCH, DELETE and anything else. */
  write: Access;
}

const CATALOG_EDITORS: readonly Role[] = ['admin', 'sales', 'inventory_manager'];
const SALES: readonly Role[] = ['admin', 'sales'];
const INVENTORY: readonly Role[] = ['admin', 'inventory_manager'];
const DRIVERS: readonly Role[] = ['admin', 'service_technician'];
const OWNER_ONLY: readonly Role[] = ['admin'];

/**
 * First match wins, so specific paths precede the prefixes that contain them
 * (`/api/users` before `/api/users/`).
 */
const RULES: readonly Rule[] = [
  // Sign-in surface. Rate limited below rather than access controlled.
  { path: '/api/auth/login', match: 'exact', read: PUBLIC, write: PUBLIC },
  { path: '/api/auth/register', match: 'exact', read: PUBLIC, write: PUBLIC },
  { path: '/api/auth/logout', match: 'exact', read: PUBLIC, write: PUBLIC },
  { path: '/api/auth/me', match: 'exact', read: SIGNED_IN, write: SIGNED_IN },

  // Public catalogue: the storefront reads it without a session, staff edit it.
  { path: '/api/products', match: 'prefix', read: PUBLIC, write: CATALOG_EDITORS },
  { path: '/api/categories', match: 'prefix', read: PUBLIC, write: CATALOG_EDITORS },
  { path: '/api/brands', match: 'prefix', read: PUBLIC, write: CATALOG_EDITORS },
  { path: '/api/offers', match: 'prefix', read: PUBLIC, write: SALES },
  { path: '/api/settings', match: 'prefix', read: PUBLIC, write: OWNER_ONLY },
  { path: '/api/google-places', match: 'prefix', read: PUBLIC, write: OWNER_ONLY },
  // Delivery fees are shop-window information; the fee actually charged is looked
  // up again server-side when the order is priced.
  { path: '/api/delivery-zones', match: 'prefix', read: PUBLIC, write: OWNER_ONLY },

  // Reviews are public to read; posting one requires an account so it can be
  // attributed and checked against the reviewer's orders.
  { path: '/api/reviews', match: 'prefix', read: PUBLIC, write: SIGNED_IN },

  // The storefront assistant answers guests, so it stays public and leans on the
  // rate limit to keep the Gemini key from being farmed.
  { path: '/api/gemini', match: 'prefix', read: PUBLIC, write: PUBLIC },

  // Per-customer data. Ownership is enforced in the handlers, which know who the
  // row belongs to; this layer only insists on a valid session.
  { path: '/api/cart', match: 'prefix', read: SIGNED_IN, write: SIGNED_IN },
  // Ahead of /api/orders: pricing a basket writes nothing, and a guest checkout
  // needs the same figures a member sees rather than browser arithmetic. Pricing
  // the *saved* cart still needs a session, which the handler checks.
  { path: '/api/orders/quote', match: 'exact', read: PUBLIC, write: PUBLIC },
  { path: '/api/orders', match: 'prefix', read: SIGNED_IN, write: SIGNED_IN },
  { path: '/api/addresses', match: 'prefix', read: SIGNED_IN, write: SIGNED_IN },

  // Back office.
  { path: '/api/inventory', match: 'prefix', read: INVENTORY, write: INVENTORY },
  { path: '/api/driver', match: 'prefix', read: DRIVERS, write: DRIVERS },

  // Listing or creating users is staff-only; a customer may still reach their
  // own record, which the handler verifies.
  { path: '/api/users', match: 'exact', read: OWNER_ONLY, write: OWNER_ONLY },
  { path: '/api/users/', match: 'prefix', read: SIGNED_IN, write: SIGNED_IN },
];

/**
 * Applied to any /api path no rule covers. Denying by default means a new route
 * fails loudly in development instead of shipping unprotected.
 */
const FALLBACK: Rule = {
  path: '',
  match: 'prefix',
  read: OWNER_ONLY,
  write: OWNER_ONLY,
};

function matches(pathname: string, rule: Rule): boolean {
  if (rule.match === 'exact') return pathname === rule.path;
  // A trailing-slash-aware prefix, so '/api/products' cannot match
  // '/api/products-secret'.
  const base = rule.path.endsWith('/') ? rule.path.slice(0, -1) : rule.path;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function ruleFor(pathname: string): Rule {
  return RULES.find((rule) => matches(pathname, rule)) ?? FALLBACK;
}

// ---------------------------------------------------------------------------
// Rate limiting
//
// A fixed window in module memory. On a single node this is a real limit; on a
// multi-instance deployment each instance keeps its own counter, so it degrades
// into a per-instance limit rather than a global one. Good enough to stop
// credential stuffing and Gemini key farming from one address; a shared store
// (Redis/Upstash) is the upgrade path if this ever runs on more than one node.
// ---------------------------------------------------------------------------

interface Budget {
  limit: number;
  windowMs: number;
}

const LOGIN_BUDGET: Budget = { limit: 10, windowMs: 15 * 60 * 1000 };
const AI_BUDGET: Budget = { limit: 20, windowMs: 5 * 60 * 1000 };
const WRITE_BUDGET: Budget = { limit: 60, windowMs: 60 * 1000 };

function budgetFor(pathname: string, method: string): Budget | null {
  if (pathname === '/api/auth/login' || pathname === '/api/auth/register') return LOGIN_BUDGET;
  // Both of these spend somebody else's metered quota on our key, so they are
  // capped on reads too — a public GET that proxies a billed API is farmable.
  if (pathname.startsWith('/api/gemini')) return AI_BUDGET;
  if (pathname.startsWith('/api/google-places')) return AI_BUDGET;
  if (method !== 'GET' && method !== 'HEAD') return WRITE_BUDGET;
  return null;
}

const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Returns seconds to wait when the caller is over budget, otherwise null. */
function overBudget(key: string, budget: Budget, now: number): number | null {
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + budget.windowMs });
    // Opportunistic sweep: without it the map grows with every distinct IP.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return null;
  }

  entry.count += 1;
  if (entry.count > budget.limit) {
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }
  return null;
}

// ---------------------------------------------------------------------------

function allowed(access: Access, role: string | null): boolean {
  if (access === PUBLIC) return true;
  if (role === null) return false;
  if (access === SIGNED_IN) return true;
  return (access as readonly string[]).includes(role);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Strip any identity headers that arrived from outside. Only this middleware
  // may set them, otherwise a caller could simply assert `x-user-role: admin`.
  const headers = new Headers(request.headers);
  headers.delete('x-user-id');
  headers.delete('x-user-email');
  headers.delete('x-user-role');

  const budget = budgetFor(pathname, method);
  if (budget) {
    const retryAfter = overBudget(`${clientIp(request)}:${pathname}`, budget, Date.now());
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
  }

  const rule = ruleFor(pathname);
  const access = method === 'GET' || method === 'HEAD' ? rule.read : rule.write;

  // Only verify when it can change the outcome — a public GET should not pay for
  // a signature check, and an invalid token must not turn one into a 401.
  let payload = null;
  if (access !== PUBLIC) {
    const token =
      request.cookies.get(AUTH_COOKIE)?.value ??
      request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();

    payload = token ? await verifyToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: token ? 'Invalid or expired session' : 'Authentication required' },
        { status: 401 },
      );
    }
  }

  if (!allowed(access, payload?.role ?? null)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (payload) {
    headers.set('x-user-id', String(payload.userId));
    headers.set('x-user-email', payload.email);
    headers.set('x-user-role', payload.role);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*'],
};
