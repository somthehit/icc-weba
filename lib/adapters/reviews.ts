// lib/adapters/reviews.ts
//
// Translates review rows into the frontend `Review` contract in types/index.ts.

import type { Review } from '@/types';

export interface DbReviewRow {
  id: number;
  productId: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  images?: unknown;
  adminResponse?: string | null;
  adminResponseAt?: Date | string | null;
  userName?: string | null;
  userCity?: string | null;
  hardwareSetup?: string | null;
  componentAspect?: string | null;
  componentRatings?: unknown;
  pros?: unknown;
  cons?: unknown;
  isVerifiedPurchase?: boolean | null;
  helpfulCount?: number | null;
  createdAt?: Date | string | null;
}

const list = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;

const ratings = (v: unknown): Review['componentRatings'] | undefined => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/** The storefront renders dates as 'YYYY-MM-DD'. */
const day = (v: Date | string | null | undefined): string => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

export function mapDbReviewToReview(row: DbReviewRow): Review {
  return {
    id: String(row.id),
    // String(dbId) on both sides, matching mapDbProductToProduct.
    productId: String(row.productId),
    userName: row.userName ?? 'Verified Customer',
    userCity: row.userCity ?? '',
    rating: Number(row.rating) || 0,
    comment: row.comment ?? '',
    images: Array.isArray(row.images) ? row.images.filter((item): item is { url: string; caption?: string } => Boolean(item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string')) : [],
    date: day(row.createdAt),
    verifiedPurchase: row.isVerifiedPurchase ?? false,
    title: row.title ?? undefined,
    hardwareSetup: row.hardwareSetup ?? undefined,
    componentAspect: row.componentAspect ?? undefined,
    componentRatings: ratings(row.componentRatings),
    pros: list(row.pros),
    cons: list(row.cons),
    helpfulCount: row.helpfulCount ?? 0,
    adminResponse: row.adminResponse ?? undefined,
  };
}
