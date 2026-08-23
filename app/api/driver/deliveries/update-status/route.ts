import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryRoutes, orders, orderStatusHistory } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { updateDeliveryStatusSchema } from '@/lib/validation/commerce';

const DRIVERS = ['admin', 'service_technician'] as const;

/** What each delivery state means for the order the customer is watching. */
const ORDER_STATUS_FOR: Record<string, 'dispatched' | 'out_for_delivery' | 'delivered'> = {
  picked_up: 'dispatched',
  in_transit: 'out_for_delivery',
  delivered: 'delivered',
};

/**
 * Move a delivery along.
 *
 * Two holes closed here: the handler had no guard, so anybody at all could mark
 * any route delivered, and `routeId` was never checked against the caller — one
 * technician could close out another's round. A driver may only touch a route
 * assigned to them; an owner may touch any.
 */
export const POST = withRole([...DRIVERS], async (request, { user }) => {
  try {
    const parsed = await parseJson(request, updateDeliveryStatusSchema);
    if (!parsed.ok) return parsed.response;
    const { routeId, status, notes, proofOfDelivery, failureReason } = parsed.data;

    const isOwner = user.role === 'admin';
    /** "Not your route" and "no such route" answer the same, so ids can't be probed. */
    const scope = isOwner
      ? eq(deliveryRoutes.id, routeId)
      : and(eq(deliveryRoutes.id, routeId), eq(deliveryRoutes.driverId, user.userId));

    const now = new Date();
    const [updatedRoute] = await db
      .update(deliveryRoutes)
      .set({
        status,
        ...(status === 'picked_up' ? { pickedUpAt: now } : {}),
        ...(status === 'in_transit' ? { inTransitAt: now } : {}),
        ...(status === 'delivered' ? { deliveredAt: now, proofOfDelivery } : {}),
        ...(status === 'failed' ? { failedAt: now, failureReason } : {}),
        ...(notes ? { deliveryNotes: notes } : {}),
      })
      .where(scope)
      .returning();

    if (!updatedRoute) {
      return NextResponse.json(
        { error: 'Delivery route not found' },
        { status: 404 },
      );
    }

    // Keep the order in step with the round. The history row already claimed
    // "delivered"; the order it belongs to was left sitting at its old status,
    // so the customer's timeline and their order disagreed.
    const orderStatus = ORDER_STATUS_FOR[status];
    if (orderStatus) {
      await db
        .update(orders)
        .set({ status: orderStatus, updatedAt: now })
        .where(eq(orders.id, updatedRoute.orderId));
    }

    await db.insert(orderStatusHistory).values({
      orderId: updatedRoute.orderId,
      status: orderStatus ?? 'out_for_delivery',
      note:
        notes ||
        (status === 'failed'
          ? `Delivery attempt failed${failureReason ? `: ${failureReason}` : ''}`
          : `Status updated to ${status}`),
      changedBy: user.userId,
    });

    return NextResponse.json({ success: true, route: updatedRoute });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { error: 'Failed to update delivery status' },
      { status: 500 },
    );
  }
});
