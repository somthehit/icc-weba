import { NextResponse } from 'next/server';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { addresses } from '@/db/schema';
import { withAuth } from '@/lib/auth/middleware';
import { parseJson, parseQuery } from '@/lib/validation/parse';
import {
  addressQuerySchema,
  createAddressSchema,
  updateAddressSchema,
} from '@/lib/validation/commerce';

/**
 * The customer's address book.
 *
 * Checkout needs a `shippingAddressId` that `POST /api/orders` will accept, and
 * that handler only accepts ids belonging to the caller — so this is where those
 * rows come from. Every query below is scoped by `userId` from the session: an id
 * belonging to somebody else matches nothing and reads back as "not found",
 * rather than confirming it exists.
 *
 * Past orders are unaffected by edits here — `orders.shipping_address_snapshot`
 * freezes the address at checkout, so tidying up the book cannot rewrite where a
 * delivered parcel was sent.
 */

/** Enough for home, office and a couple of relatives; not a free key-value store. */
const MAX_ADDRESSES = 20;

const NOT_FOUND = () => NextResponse.json({ error: 'Address not found' }, { status: 404 });

export const GET = withAuth(async (_request, { user }) => {
  try {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, user.userId))
      // Default first, then oldest first, so the checkout form's preselection is
      // stable between visits.
      .orderBy(desc(addresses.isDefault), asc(addresses.id));

    return NextResponse.json({ addresses: rows });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, createAddressSchema);
    if (!parsed.ok) return parsed.response;

    const created = await db.transaction(async (tx) => {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(addresses)
        .where(eq(addresses.userId, user.userId));

      if (count >= MAX_ADDRESSES) return null;

      // The first address is the default whether or not the form said so —
      // otherwise a customer's only address isn't selected for them at checkout.
      const isDefault = parsed.data.isDefault || count === 0;

      if (isDefault) {
        await tx
          .update(addresses)
          .set({ isDefault: false })
          .where(and(eq(addresses.userId, user.userId), eq(addresses.isDefault, true)));
      }

      const [row] = await tx
        .insert(addresses)
        .values({ ...parsed.data, isDefault, userId: user.userId })
        .returning();

      return row;
    });

    if (!created) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.` },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, address: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating address:', error);
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { user }) => {
  try {
    const parsed = await parseJson(request, updateAddressSchema);
    if (!parsed.ok) return parsed.response;

    const { id, ...changes } = parsed.data;
    const owned = and(eq(addresses.id, id), eq(addresses.userId, user.userId));

    const updated = await db.transaction(async (tx) => {
      // Promoting this one demotes the rest first, so `isDefault` stays unique
      // per customer even though the column itself cannot express that.
      if (changes.isDefault === true) {
        await tx
          .update(addresses)
          .set({ isDefault: false })
          .where(and(eq(addresses.userId, user.userId), ne(addresses.id, id)));
      }

      const [row] = await tx.update(addresses).set(changes).where(owned).returning();
      return row ?? null;
    });

    if (!updated) return NOT_FOUND();

    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { user }) => {
  try {
    const query = parseQuery(request.url, addressQuerySchema);
    if (!query.ok) return query.response;

    const removed = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(addresses)
        .where(and(eq(addresses.id, query.data.id), eq(addresses.userId, user.userId)))
        .returning({ id: addresses.id, isDefault: addresses.isDefault });

      if (!row) return null;

      // Deleting the default would otherwise leave the book with none, and
      // checkout with nothing preselected.
      if (row.isDefault) {
        const [next] = await tx
          .select({ id: addresses.id })
          .from(addresses)
          .where(eq(addresses.userId, user.userId))
          .orderBy(asc(addresses.id))
          .limit(1);

        if (next) {
          await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
        }
      }

      return row;
    });

    if (!removed) return NOT_FOUND();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
});
