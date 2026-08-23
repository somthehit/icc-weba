import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import {
  addresses,
  coupons,
  orderItems,
  orderStatusHistory,
  orders,
  paymentMethodSettings,
  payments,
  users,
  type ShippingAddressSnapshot,
} from '@/db/schema';
import { STAFF_ROLES, withAuth } from '@/lib/auth/middleware';
import { decrementStock } from '@/lib/orders/stock';
import { clearCart, loadCartLines, quoteOrder, quoteTotals, toRupees } from '@/lib/pricing/quote';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { createOrderSchema, orderListQuerySchema } from '@/lib/validation/commerce';

const orderListColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  userId: orders.userId,
  status: orders.status,
  subtotal: orders.subtotal,
  vatAmount: orders.vatAmount,
  deliveryFee: orders.deliveryFee,
  discountAmount: orders.discountAmount,
  totalAmount: orders.totalAmount,
  paymentMethod: orders.paymentMethod,
  paymentStatus: orders.paymentStatus,
  customerNote: orders.customerNote,
  // The frozen copy, not the FK: the address book row it points at may since have
  // been edited or deleted, so this is the only reliable record of where the
  // parcel was actually sent.
  shippingAddressSnapshot: orders.shippingAddressSnapshot,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
  userName: users.name,
  userEmail: users.email,
} as const;

/**
 * Order reads, scoped to the caller.
 *
 * Staff see everything and may filter by `?userId=`. A customer's own id is
 * substituted regardless of what they ask for: the previous version took
 * `?userId=` at face value, so any signed-in customer could list somebody
 * else's orders — names, emails and totals included — or fetch a single order
 * by guessing its id.
 */
export const GET = withAuth(async (request, { user }) => {
  try {
    const query = parseQuery(request.url, orderListQuerySchema);
    if (!query.ok) return query.response;

    const isStaff = STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]);
    const { id, orderNumber, status, limit, offset } = query.data;
    // A customer is pinned to their own orders; staff may narrow to one customer.
    const scopedUserId = isStaff ? query.data.userId : user.userId;

    /** Same treatment for "not yours" as for "doesn't exist" — no probing. */
    const ownerScope: SQL | undefined = isStaff ? undefined : eq(orders.userId, user.userId);

    if (id !== undefined || orderNumber) {
      const identity =
        id !== undefined ? eq(orders.id, id) : eq(orders.orderNumber, orderNumber as string);

      const [order] = await db
        .select()
        .from(orders)
        .where(ownerScope ? and(identity, ownerScope) : identity)
        .limit(1);

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, order.id))
        .orderBy(desc(orderStatusHistory.createdAt));

      return NextResponse.json({ ...order, items, history });
    }

    const conditions: SQL[] = [];
    if (scopedUserId !== undefined) conditions.push(eq(orders.userId, scopedUserId));
    if (status) conditions.push(eq(orders.status, status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select(orderListColumns)
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Lines for the whole page in one query. Both the customer's order history and
    // the dashboard list show what was bought, and fetching them per order would
    // be `limit` round trips.
    const lineItems =
      results.length > 0
        ? await db
            .select()
            .from(orderItems)
            .where(
              inArray(
                orderItems.orderId,
                results.map((order) => order.id),
              ),
            )
        : [];

    const itemsByOrder = new Map<number, typeof lineItems>();
    for (const item of lineItems) {
      const bucket = itemsByOrder.get(item.orderId);
      if (bucket) bucket.push(item);
      else itemsByOrder.set(item.orderId, [item]);
    }

    // Counted with the same filter — this used to count every order in the
    // table, so a customer's "1 of 2 orders" page claimed the store's total.
    const [stats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where);

    return NextResponse.json({
      orders: results.map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) ?? [],
      })),
      total: stats?.count ?? results.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
});

/**
 * Raised inside the order transaction so a business failure rolls back the whole
 * thing — a decremented stock count with no order row is worse than no order.
 */
class OrderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

/**
 * Place an order.
 *
 * Every figure on the order is computed from the database. The previous version
 * summed `item.unitPrice` from the request body, put a hardcoded 13% VAT on top
 * of prices the store already sells VAT-inclusive, accepted `deliveryFee`,
 * `discountAmount` and an unchecked `couponId`, never verified the delivery
 * address belonged to the caller, never touched stock, and minted its order
 * number from four random digits against a unique index.
 *
 * The whole write is one transaction: stock, order, lines, history, the pending
 * payment row and the coupon's usage counter either all land or none do.
 */
export const POST = withAuth(async (request, { user }) => {
  const parsed = await parseJson(request, createOrderSchema);
  if (!parsed.ok) return parsed.response;

  const {
    items,
    fromCart,
    shippingAddressId,
    deliveryZoneId,
    paymentMethod,
    couponCode,
    customerNote,
  } = parsed.data;

  try {
    // Only methods the owner has switched on. Without this an order could be
    // placed against eSewa on a store that has never configured it.
    const [method] = await db
      .select({ isEnabled: paymentMethodSettings.isEnabled })
      .from(paymentMethodSettings)
      .where(eq(paymentMethodSettings.method, paymentMethod))
      .limit(1);

    if (!method?.isEnabled) {
      return NextResponse.json(
        { error: 'That payment method is not available right now' },
        { status: 400 },
      );
    }

    // Someone else's address id reads as "not found" — an order must not be
    // shippable to an address the customer cannot see. The row is read in full so
    // it can be frozen onto the order: the FK is `set null` and customers may
    // edit or delete their address book, which would otherwise rewrite where a
    // past order went.
    let addressSnapshot: ShippingAddressSnapshot | undefined;
    if (shippingAddressId !== undefined) {
      const [address] = await db
        .select({
          label: addresses.label,
          fullName: addresses.fullName,
          phone: addresses.phone,
          province: addresses.province,
          district: addresses.district,
          municipality: addresses.municipality,
          wardNo: addresses.wardNo,
          streetAddress: addresses.streetAddress,
          landmark: addresses.landmark,
        })
        .from(addresses)
        .where(and(eq(addresses.id, shippingAddressId), eq(addresses.userId, user.userId)))
        .limit(1);

      if (!address) {
        return NextResponse.json({ error: 'Delivery address not found' }, { status: 404 });
      }

      addressSnapshot = address;
    }

    const created = await db.transaction(async (tx) => {
      const lines = fromCart ? await loadCartLines(tx, user.userId) : (items ?? []);

      const priced = await quoteOrder(tx, { items: lines, couponCode, deliveryZoneId });
      if (!priced.ok) throw new OrderError(priced.status, priced.error);
      const { quote } = priced;

      const stock = await decrementStock(tx, quote.lines);
      if (!stock.ok) throw new OrderError(stock.status, stock.error);

      if (quote.couponId !== null) {
        // Claimed with an UPDATE rather than a read-then-write, so two checkouts
        // racing for the last redemption cannot both take it.
        const [claimed] = await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(
            and(
              eq(coupons.id, quote.couponId),
              or(isNull(coupons.usageLimit), lt(coupons.usedCount, coupons.usageLimit)),
            ),
          )
          .returning({ id: coupons.id });

        if (!claimed) {
          throw new OrderError(409, 'That coupon has just been fully redeemed');
        }
      }

      const totals = quoteTotals(quote);

      // The order number embeds the row id, which only exists once the row does,
      // so it is inserted under a throwaway value and renamed in the same
      // transaction. `ICE-<year>-<four random digits>` was the old scheme; with a
      // unique index on the column it starts failing after a few dozen orders.
      const [inserted] = await tx
        .insert(orders)
        .values({
          orderNumber: `TMP-${randomUUID().replace(/-/g, '').slice(0, 20)}`,
          userId: user.userId,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          deliveryFee: totals.deliveryFee,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          couponId: quote.couponId,
          shippingAddressId,
          shippingAddressSnapshot: addressSnapshot,
          deliveryZoneId,
          customerNote,
        })
        .returning({ id: orders.id, createdAt: orders.createdAt });

      const [order] = await tx
        .update(orders)
        .set({
          orderNumber: `ICE-${inserted.createdAt.getFullYear()}-${String(inserted.id).padStart(5, '0')}`,
        })
        .where(eq(orders.id, inserted.id))
        .returning();

      const orderedItems = await tx
        .insert(orderItems)
        .values(
          quote.lines.map((line) => ({
            orderId: order.id,
            productId: line.productId,
            variantId: line.variantId,
            productNameSnapshot: line.productNameSnapshot,
            skuSnapshot: line.skuSnapshot,
            quantity: line.quantity,
            unitPrice: toRupees(line.unitPricePaisa),
            lineTotal: toRupees(line.lineTotalPaisa),
          })),
        )
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        status: 'pending',
        note: 'Order placed',
        changedBy: user.userId,
      });

      // COD and bank transfer both settle after the fact; the row records what is
      // owed so the finance view has something to reconcile against.
      await tx.insert(payments).values({
        orderId: order.id,
        method: paymentMethod,
        amount: totals.totalAmount,
        status: 'pending',
      });

      if (fromCart) await clearCart(tx, user.userId);

      return { order, items: orderedItems };
    });

    return NextResponse.json({ success: true, ...created }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
});
