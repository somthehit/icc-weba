import { NextRequest, NextResponse } from 'next/server';
import { mapDbBrandToBrand } from '@/lib/adapters/catalog';
import { queryBrands } from '@/lib/queries/catalog';

/**
 * Brand list, mapped to the frontend `Brand` contract. Returns every active brand
 * (so the shop's brand filter can offer them all); pass ?partners=true for just
 * the curated brands merchandised on the Brands page.
 */
export async function GET(request: NextRequest) {
  try {
    const partnersOnly = new URL(request.url).searchParams.get('partners') === 'true';
    const rows = await queryBrands({ partnersOnly });
    return NextResponse.json({ brands: rows.map(mapDbBrandToBrand) });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}
