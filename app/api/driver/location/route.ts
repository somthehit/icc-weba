import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driverLocations } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withRole } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import { deliveryQuerySchema, driverLocationSchema } from '@/lib/validation/commerce';

const DRIVERS = ['admin', 'service_technician'] as const;

/**
 * Record where the van is.
 *
 * `driverId` now comes from the session. It used to come from the body, which
 * meant one technician could file GPS pings under another driver's name — enough
 * to fake an arrival, or to bury a real position under invented ones.
 */
export const POST = withRole([...DRIVERS], async (request, { user }) => {
  try {
    const parsed = await parseJson(request, driverLocationSchema);
    if (!parsed.ok) return parsed.response;

    const [location] = await db
      .insert(driverLocations)
      .values({ ...parsed.data, driverId: user.userId })
      .returning();

    return NextResponse.json({
      success: true,
      location: {
        id: location.id,
        driverId: location.driverId,
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        timestamp: location.timestamp,
      },
    });
  } catch (error) {
    console.error('Error updating driver location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 },
    );
  }
});

/**
 * A driver's recent track. Their own by default; only an owner may ask for
 * another driver's, since a movement history is a record of where a person has
 * been all day.
 */
export const GET = withRole([...DRIVERS], async (request, { user }) => {
  try {
    const query = parseQuery(request.url, deliveryQuerySchema);
    if (!query.ok) return query.response;

    const driverId = user.role === 'admin' ? query.data.driverId ?? user.userId : user.userId;

    const locations = await db
      .select()
      .from(driverLocations)
      .where(eq(driverLocations.driverId, driverId))
      .orderBy(desc(driverLocations.timestamp))
      .limit(100);

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error fetching driver locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 },
    );
  }
});
