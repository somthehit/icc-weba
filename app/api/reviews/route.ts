import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { reviews, users, products } from '@/db/schema';
import { eq, desc, and, sql, type SQL } from 'drizzle-orm';
import { mapDbReviewToReview } from '@/lib/adapters/reviews';
import { STAFF_ROLES, withAuth } from '@/lib/auth/middleware';
import { getUserFromRequest } from '@/lib/auth/utils';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { createReviewSchema, reviewQuerySchema } from '@/lib/validation/commerce';

const reviewColumns = {
  id: reviews.id,
  productId: reviews.productId,
  rating: reviews.rating,
  title: reviews.title,
  comment: reviews.comment,
  images: reviews.images,
  userCity: reviews.userCity,
  hardwareSetup: reviews.hardwareSetup,
  componentAspect: reviews.componentAspect,
  componentRatings: reviews.componentRatings,
  pros: reviews.pros,
  cons: reviews.cons,
  isVerifiedPurchase: reviews.isVerifiedPurchase,
  helpfulCount: reviews.helpfulCount,
  adminResponse: reviews.adminResponse,
  createdAt: reviews.createdAt,
  userName: users.name,
} as const;

/**
 * Public review feed, mapped to the frontend `Review` contract.
 *
 * Only approved reviews are returned. ?includePending=true is the admin
 * moderation queue and now requires a staff session — before, any visitor could
 * read submissions that had not been through moderation yet.
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(request.url, reviewQuerySchema);
    if (!query.ok) return query.response;
    const { productId, includePending, limit, offset } = query.data;

    if (includePending) {
      const caller = await getUserFromRequest(request);
      if (!caller || !STAFF_ROLES.includes(caller.role as (typeof STAFF_ROLES)[number])) {
        return NextResponse.json(
          { error: 'Pending reviews are only visible to staff' },
          { status: 403 },
        );
      }
    }

    const conditions: SQL[] = [];
    if (!includePending) conditions.push(eq(reviews.isApproved, true));
    if (productId) conditions.push(eq(reviews.productId, productId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select(reviewColumns)
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(where)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(limit)
      .offset(offset);

    const [stats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`,
      })
      .from(reviews)
      .where(where);

    return NextResponse.json({
      reviews: rows.map(mapDbReviewToReview),
      total: stats?.count ?? rows.length,
      averageRating: stats?.avg ?? 0,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 },
    );
  }
}

/**
 * Submit a review as the signed-in user.
 *
 * The author is taken from the session. The previous version read `userId` out
 * of the request body, so any signed-in customer could post a review under
 * anybody else's name.
 */
export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, createReviewSchema);
    if (!parsed.ok) return parsed.response;
    const { productId, ...review } = parsed.data;

    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.userId, user.userId)))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(reviews)
      .values({
        ...review,
        productId,
        userId: user.userId,
        // isApproved and isVerifiedPurchase stay at their column defaults —
        // a reviewer does not get to mark their own review approved or verified.
      })
      .returning();

    return NextResponse.json({ success: true, review: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 },
    );
  }
});
