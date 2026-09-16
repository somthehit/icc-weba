import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, reviews, users } from '@/db/schema';
import { STAFF_ROLES, withRole } from '@/lib/auth/middleware';

export const GET = withRole(['admin', 'sales'], async (request: NextRequest) => {
  const status = new URL(request.url).searchParams.get('status');
  const conditions = status === 'PENDING' ? [eq(reviews.isApproved, false)] : status === 'APPROVED' ? [eq(reviews.isApproved, true)] : [];
  const rows = await db.select({ id: reviews.id, productId: reviews.productId, productName: products.name, userName: users.name, rating: reviews.rating, title: reviews.title, comment: reviews.comment, images: reviews.images, isApproved: reviews.isApproved, isVerifiedPurchase: reviews.isVerifiedPurchase, userCity: reviews.userCity, createdAt: reviews.createdAt, adminResponse: reviews.adminResponse }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).innerJoin(users, eq(users.id, reviews.userId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(reviews.createdAt)).limit(200);
  return NextResponse.json({ reviews: rows });
});
