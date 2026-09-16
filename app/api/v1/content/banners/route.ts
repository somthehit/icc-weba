import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { heroSlides } from '@/db/schema';
import { withRole } from '@/lib/auth/middleware';

const optionalDate = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' || value === null ? undefined : value,
  z.coerce.date().optional(),
);
const optionalText = (max: number) => z.preprocess(
  (value) => value === null || value === undefined ? undefined : String(value),
  z.string().max(max).optional(),
);

const bannerSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(1, 'Banner title is required').max(200),
  subtitle: optionalText(400),
  desktopImageUrl: optionalText(500),
  mobileImageUrl: optionalText(500),
  ctaLabel: optionalText(60),
  ctaUrl: optionalText(300),
  startsAt: optionalDate,
  endsAt: optionalDate,
  status: z.enum(['draft', 'published']).default('draft'),
  displayOrder: z.coerce.number().int().min(0).default(0),
}).refine(
  (banner) => !banner.startsAt || !banner.endsAt || banner.endsAt >= banner.startsAt,
  { path: ['endsAt'], message: 'End date must be after the start date' },
);

const validationError = (error: z.ZodError) => NextResponse.json({
  error: error.issues[0]?.message || 'Invalid banner',
  issues: error.flatten().fieldErrors,
}, { status: 400 });
export const GET = withRole(['admin', 'sales'], async () => {
  try {
    const banners = await db.select().from(heroSlides).orderBy(asc(heroSlides.displayOrder));
    return NextResponse.json({ banners });
  } catch (error) {
    console.error('Failed to load content banners:', error);
    return NextResponse.json({ error: 'Could not load content banners.' }, { status: 500 });
  }
});
/**
 * Writes are wrapped because only GET was.
 *
 * An unguarded handler lets a thrown query escape, and Next then answers with an
 * HTML error page — so the browser's `response.json()` dies on "Unexpected end of
 * JSON input" and the real cause never reaches the console. Every path here
 * returns JSON, including the body-parse failure.
 */
const readBody = async (request: NextRequest) => {
  try {
    return { ok: true as const, body: await request.json() };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 }),
    };
  }
};

export const POST = withRole(['admin'], async (request: NextRequest) => {
  const read = await readBody(request);
  if (!read.ok) return read.response;

  const parsed = bannerSchema.safeParse(read.body);
  if (!parsed.success) {
    console.error('Invalid banner payload:', parsed.error.flatten(), read.body);
    return validationError(parsed.error);
  }

  try {
    const [banner] = await db.insert(heroSlides).values(parsed.data).returning();
    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    console.error('Failed to create banner:', error);
    return NextResponse.json({ error: 'Could not save the banner.' }, { status: 500 });
  }
});

export const PUT = withRole(['admin'], async (request: NextRequest) => {
  const read = await readBody(request);
  if (!read.ok) return read.response;

  const parsed = bannerSchema.safeParse(read.body);
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.id) {
    return NextResponse.json({ error: 'Banner id is required' }, { status: 400 });
  }

  try {
    const { id, ...data } = parsed.data;
    const [banner] = await db.update(heroSlides).set(data).where(eq(heroSlides.id, id)).returning();
    // An update matching no row returns nothing; without this the client would set
    // `undefined` into its list and render a blank card.
    if (!banner) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    return NextResponse.json({ banner });
  } catch (error) {
    console.error('Failed to update banner:', error);
    return NextResponse.json({ error: 'Could not save the banner.' }, { status: 500 });
  }
});

export const DELETE = withRole(['admin'], async (request: NextRequest) => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Banner id required' }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(heroSlides)
      .where(eq(heroSlides.id, id))
      .returning({ id: heroSlides.id });
    if (!deleted) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete banner:', error);
    return NextResponse.json({ error: 'Could not delete the banner.' }, { status: 500 });
  }
});
