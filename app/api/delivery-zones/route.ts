import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { deliveryZones } from '@/db/schema';

/**
 * Delivery zones the checkout can charge against.
 *
 * Public and read-only: the fee shown here is advisory. Whatever zone the client
 * picks, `POST /api/orders` looks the row up again and charges its `flatFee`, so a
 * tampered response cannot change what the customer is billed — see
 * `lib/pricing/quote.ts`.
 *
 * `provinces` is a comma-separated list of `provinceEnum` values, split here so
 * the form can preselect the zone covering the chosen address.
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: deliveryZones.id,
        name: deliveryZones.name,
        provinces: deliveryZones.provinces,
        flatFee: deliveryZones.flatFee,
        estimatedDays: deliveryZones.estimatedDays,
      })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .orderBy(asc(deliveryZones.flatFee), asc(deliveryZones.name));

    return NextResponse.json({
      zones: rows.map((zone) => ({
        ...zone,
        provinces: (zone.provinces ?? '')
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
      })),
    });
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 });
  }
}
