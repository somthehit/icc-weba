import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryZones } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';
import { parseJson } from '@/lib/validation/parse';
import { z } from 'zod';

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), provinces: z.string().trim().max(300).optional(), districts: z.string().trim().max(500).optional(), municipalities: z.string().trim().max(1000).optional(), flatFee: z.coerce.number().min(0).max(100000).optional(), estimatedDays: z.coerce.number().int().min(1).max(30).optional(), isActive: z.boolean().optional() });
type Context = { params: Promise<{ id: string }> };

export const PUT = withRole<Context>(['admin'], async (request, _auth, context) => {
  const { id } = await context.params;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId < 1) return NextResponse.json({ error: 'Invalid zone id' }, { status: 400 });
  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;
  const update: { name?: string; provinces?: string; districts?: string; municipalities?: string; flatFee?: string; estimatedDays?: number; isActive?: boolean } = {
    name: parsed.data.name,
    provinces: parsed.data.provinces,
    districts: parsed.data.districts,
    municipalities: parsed.data.municipalities,
    flatFee: parsed.data.flatFee === undefined ? undefined : String(parsed.data.flatFee),
    estimatedDays: parsed.data.estimatedDays,
    isActive: parsed.data.isActive,
  };
  const [zone] = await db.update(deliveryZones).set(update).where(eq(deliveryZones.id, parsedId)).returning();
  return zone ? NextResponse.json({ success: true, zone }) : NextResponse.json({ error: 'Zone not found' }, { status: 404 });
});
