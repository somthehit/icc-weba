import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, orderStatusHistory } from '@/db/schema';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { STAFF_ROLES, withAuth, withRole } from '@/lib/auth/middleware';
import { restockOrder } from '@/lib/orders/stock';
import { parseJson } from '@/lib/validation/parse';
import { updateOrderSchema } from '@/lib/validation/commerce';
import { idParamSchema } from '@/lib/validation/schemas';

type RouteContext = { params: Promise<{ id: string }> };

/** Fulfilment states a customer is allowed to walk away from. */
const CANCELLABLE = ['pending', 'confirmed'] as const;

/** Who may move an order through fulfilment. */
const FULFILMENT_STAFF = ['admin', 'sales', 'service_technician'] as const;

/** Who may declare money received or refunded. */
const FINANCE_STAFF = ['admin', 'sales'] as const;

/**
 * Reaching one of these puts the goods back on the shelf.
 *
 * `refunded` is deliberately absent: it usually follows `returned`, and
 * restocking on both would count the same units twice.
 */
const RELEASES_STOCK = ['cancelled', 'returned'] as const;

/** States whose stock has already gone back, so it must not go back again. */
const STOCK_ALREADY_RELEASED = ['cancelled', 'returned', 'refunded'] as const;

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = idParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

const BAD_ID = NextResponse.json({ error: 'Order id must be a positive integer' }, { status: 400 });
const NOT_FOUND = () => NextResponse.json({ error: 'Order not found' }, { status: 404 });

/**
 * One order, with items and status history.
 *
 * Scoped to the caller unless they are staff. Before, the id alone was enough:
 * anyone could read any order — delivery address id, totals, customer note.
 */
export const GET = withAuth<RouteContext>(async (_request, { user }, context) => {
  try {
    const orderId = await readId(context);
    if (orderId === null) return BAD_ID;

    const isStaff = STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]);
    const [order] = await db
      .select()
      .from(orders)
      .where(
        isStaff
          ? eq(orders.id, orderId)
          : and(eq(orders.id, orderId), eq(orders.userId, user.userId)),
      )
      .limit(1);

    if (!order) return NOT_FOUND();

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const history = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(desc(orderStatusHistory.createdAt));

    return NextResponse.json({ ...order, items, history });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 },
    );
  }
});

/**
 * Move an order through fulfilment, or record a payment outcome.
 *
 * Staff only, and split by responsibility: a service technician can mark a
 * delivery done but cannot mark an unpaid COD order as paid. This handler had
 * no guard at all, so a customer could set their own order to `delivered` and
 * `paid`.
 */
export const PUT = withRole<RouteContext>([...FULFILMENT_STAFF], async (request, { user }, context) => {
  try {
    const orderId = await readId(context);
    if (orderId === null) return BAD_ID;

    const parsed = await parseJson(request, updateOrderSchema);
    if (!parsed.ok) return parsed.response;
    const { status, paymentStatus, note } = parsed.data;

    if (paymentStatus && !FINANCE_STAFF.includes(user.role as (typeof FINANCE_STAFF)[number])) {
      return NextResponse.json(
        { error: 'Only sales or an owner may change payment status' },
        { status: 403 },
      );
    }

    const [current] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current) return NOT_FOUND();

    const releasesStock =
      status !== undefined &&
      RELEASES_STOCK.includes(status as (typeof RELEASES_STOCK)[number]) &&
      !STOCK_ALREADY_RELEASED.includes(current.status as (typeof STOCK_ALREADY_RELEASED)[number]);

    const updated = await db.transaction(async (tx) => {
      // When this move releases stock the update is conditional on the order not
      // already being in a released state, so two staff cancelling at once put the
      // units back exactly once.
      const scope = releasesStock
        ? and(eq(orders.id, orderId), notInArray(orders.status, [...STOCK_ALREADY_RELEASED]))
        : eq(orders.id, orderId);

      const [row] = await tx
        .update(orders)
        .set({
          ...(status ? { status } : {}),
          ...(paymentStatus ? { paymentStatus } : {}),
          updatedAt: new Date(),
        })
        .where(scope)
        .returning();

      if (!row) return null;

      if (releasesStock) await restockOrder(tx, orderId);

      if (status) {
        await tx.insert(orderStatusHistory).values({
          orderId,
          status,
          note: note || `Status updated to ${status}`,
          changedBy: user.userId,
        });
      }

      return row;
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'This order has already been cancelled or returned' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 },
    );
  }
});

/**
 * Cancel an order.
 *
 * Staff may cancel any order; a customer may cancel their own while it is still
 * pending or confirmed — once it is out for delivery, cancelling is a
 * conversation, not a button.
 */
export const DELETE = withAuth<RouteContext>(async (_request, { user }, context) => {
  try {
    const orderId = await readId(context);
    if (orderId === null) return BAD_ID;

    const isStaff = STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]);

    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(
        isStaff
          ? eq(orders.id, orderId)
          : and(eq(orders.id, orderId), eq(orders.userId, user.userId)),
      )
      .limit(1);

    if (!order) return NOT_FOUND();

    if (order.status === 'cancelled') {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    if (!isStaff && !CANCELLABLE.includes(order.status as (typeof CANCELLABLE)[number])) {
      return NextResponse.json(
        { error: 'This order has already been dispatched — contact us to arrange a return' },
        { status: 409 },
      );
    }

    const [cancelled] = await db.transaction(async (tx) => {
      // Guarded on the current status so a double-cancel cannot restock twice.
      const rows = await tx
        .update(orders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), notInArray(orders.status, [...STOCK_ALREADY_RELEASED])))
        .returning({ id: orders.id, status: orders.status });

      if (rows.length === 0) return rows;

      // The units were taken off the shelf when the order was placed; a
      // cancellation that doesn't put them back leaks stock the shop still has.
      await restockOrder(tx, orderId);

      await tx.insert(orderStatusHistory).values({
        orderId,
        status: 'cancelled',
        note: isStaff ? 'Order cancelled by staff' : 'Order cancelled by customer',
        changedBy: user.userId,
      });

      return rows;
    });

    if (!cancelled) {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    return NextResponse.json({ success: true, order: cancelled });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 },
    );
  }
});
