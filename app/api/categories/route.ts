import { NextResponse } from 'next/server';
import { mapDbCategoryToCategoryItem } from '@/lib/adapters/catalog';
import { queryCategories } from '@/lib/queries/catalog';

/**
 * Storefront category taxonomy, mapped to the frontend `CategoryItem` contract.
 * `productCount` is a live count of active products, not a stored figure.
 */
export async function GET() {
  try {
    const rows = await queryCategories();
    return NextResponse.json({ categories: rows.map(mapDbCategoryToCategoryItem) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
