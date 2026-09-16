import { NextResponse } from 'next/server';

import { withInventory } from '@/lib/auth/middleware';
import { queryMovements } from '@/lib/queries/inventory';
import { parseQuery } from '@/lib/validation/parse';
import { movementQuerySchema } from '@/lib/validation/inventory';

/**
 * The append-only stock ledger.
 *
 * Read-only by design, and not merely by omission: `inventory_movements` carries a
 * `BEFORE UPDATE OR DELETE` trigger that raises, so there is no `PUT` or `DELETE` here
 * because the database would refuse one. Corrections go through
 * `POST /api/inventory/adjust/reverse`, which appends.
 *
 * The response carries `facets` — the staff and reasons actually present in the ledger —
 * so the filter dropdowns can be populated without the client calling `/api/users`,
 * which is owner-only. An `inventory_manager` would get a 403 and an empty staff filter.
 */
export const GET = withInventory(async (request) => {
  try {
    const query = parseQuery(request.url, movementQuerySchema);
    if (!query.ok) return query.response;

    return NextResponse.json(await queryMovements(query.data));
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json({ error: 'Failed to fetch stock movements' }, { status: 500 });
  }
});
