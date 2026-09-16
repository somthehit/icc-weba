import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { contactInquiries } from '@/db/schema';
import { contactInquirySchema } from '@/lib/validation/inquiries';

/**
 * Public contact form intake.
 *
 * Every exit path returns a JSON body. The previous version had no error
 * handling at all, so a thrown query (the `contact_inquiries` table was missing
 * from the database entirely) escaped the handler and Next replied with a bare
 * 500 and no body — which made the browser fail on `response.json()` with
 * "Unexpected end of JSON input" and hid the actual Postgres error.
 */
export async function POST(request: NextRequest) {
  // `request.json()` throws on a malformed or empty body, which has to be caught
  // separately from the insert or it becomes another bodiless 500.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = contactInquirySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check your contact details.' }, { status: 400 });
  }

  try {
    // `inquiryNumber` is omitted on purpose: Postgres generates it from a
    // sequence-backed default, so concurrent submissions cannot collide.
    const [inquiry] = await db
      .insert(contactInquiries)
      .values({
        ...parsed.data,
        email: parsed.data.email || null,
      })
      .returning({ inquiryNumber: contactInquiries.inquiryNumber });

    return NextResponse.json(
      { success: true, inquiryNumber: inquiry.inquiryNumber },
      { status: 201 },
    );
  } catch (error) {
    // Logged in full server-side; the client gets a generic message rather than
    // a Postgres error string, which can leak schema details.
    console.error('Error saving contact inquiry:', error);
    return NextResponse.json(
      { error: 'Could not submit your inquiry. Please try again.' },
      { status: 500 },
    );
  }
}
