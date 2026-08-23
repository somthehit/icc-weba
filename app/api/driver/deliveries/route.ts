import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryRoutes, orders, users } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { createDeliveryRouteSchema, deliveryQuerySchema } from '@/lib/validation/commerce';
import { isForeignKeyViolation } from '@/lib/db/errors';

/**
 * Who works the delivery endpoints. Mirrors the `/api/driver` entry in the Edge
 * middleware policy table; the guard is repeated here so the route is never one
 * matcher edit away from being open.
 */
const DRIVERS = ['admin', 'service_technician'] as const;

/** Roles a delivery may be assigned to. */
const ASSIGNABLE_ROLES = ['service_technician', 'admin'];

/**
 * A driver's manifest.
 *
 * `?driverId=` used to be taken at face value, so any technician could read
 * another driver's round — order numbers, totals, customer notes and delivery
 * addresses included. A technician now always sees their own; only an owner may
 * look at someone else's.
 */
export const GET = withRole([...DRIVERS], async (request, { user }) => {
  try {
    const query = parseQuery(request.url, deliveryQuerySchema);
    if (!query.ok) return query.response;

    const { status } = query.data;
    const driverId = user.role === 'admin' ? query.data.driverId ?? user.userId : user.userId;

    const deliveries = await db
      .select({
        id: deliveryRoutes.id,
        orderId: deliveryRoutes.orderId,
        driverId: deliveryRoutes.driverId,
        status: deliveryRoutes.status,
        assignedAt: deliveryRoutes.assignedAt,
        pickedUpAt: deliveryRoutes.pickedUpAt,
        inTransitAt: deliveryRoutes.inTransitAt,
        deliveredAt: deliveryRoutes.deliveredAt,
        estimatedArrival: deliveryRoutes.estimatedArrival,
        distanceKm: deliveryRoutes.distanceKm,
        stopSequence: deliveryRoutes.stopSequence,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        customerNote: orders.customerNote,
        shippingAddressId: orders.shippingAddressId,
      })
      .from(deliveryRoutes)
      .innerJoin(orders, eq(deliveryRoutes.orderId, orders.id))
      .where(
        and(
          eq(deliveryRoutes.driverId, driverId),
          status ? eq(deliveryRoutes.status, status) : undefined,
        ),
      )
      .orderBy(asc(deliveryRoutes.stopSequence));

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 },
    );
  }
});

/**
 * Assign an order to a driver.
 *
 * Dispatch is an owner action, not a driver one: a technician handing themselves
 * — or a colleague — someone else's delivery is not a thing the shop wants.
 */
export const POST = withRole(['admin'], async (request) => {
  try {
    const parsed = await parseJson(request, createDeliveryRouteSchema);
    if (!parsed.ok) return parsed.response;
    const { orderId, driverId, ...route } = parsed.data;

    const [driver] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, driverId))
      .limit(1);

    if (!driver || !ASSIGNABLE_ROLES.includes(driver.role)) {
      return NextResponse.json(
        { error: 'That user is not a driver' },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(deliveryRoutes)
      .values({ ...route, orderId, driverId, status: 'assigned' })
      .returning();

    return NextResponse.json({ success: true, route: created }, { status: 201 });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: 'orderId or deliveryPartnerId does not exist' },
        { status: 400 },
      );
    }
    console.error('Error creating delivery route:', error);
    return NextResponse.json(
      { error: 'Failed to create delivery route' },
      { status: 500 },
    );
  }
});
