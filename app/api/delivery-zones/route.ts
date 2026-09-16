import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { deliveryZones } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(120),
  provinces: z.string().trim().max(300).optional(),
  districts: z.string().trim().max(500).optional(),
  municipalities: z.string().trim().max(1000).optional(),
  flatFee: z.coerce.number().min(0).max(100000),
  estimatedDays: z.coerce.number().int().min(1).max(30).default(1),
  isActive: z.boolean().default(true),
});

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
        districts: deliveryZones.districts,
        municipalities: deliveryZones.municipalities,
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
        districts: (zone.districts ?? '').split(',').map((value) => value.trim()).filter(Boolean),
        municipalities: (zone.municipalities ?? '').split(',').map((value) => value.trim()).filter(Boolean),
      })),
    });
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 });
  }
}

export const POST = withRole(['admin'], async (request) => {
  const parsed = await parseJson(request, zoneSchema);
  if (!parsed.ok) return parsed.response;
  const [zone] = await db.insert(deliveryZones).values({ ...parsed.data, flatFee: String(parsed.data.flatFee) }).returning();
  return NextResponse.json({ success: true, zone }, { status: 201 });
});
