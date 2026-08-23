import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfile } from '@/lib/services/google-places';
import { STAFF_ROLES } from '@/lib/auth/middleware';
import { getUserFromRequest } from '@/lib/auth/utils';

/**
 * The shop's Google Business profile (rating, reviews, opening hours).
 *
 * Public, because the storefront footer shows it to guests — but `?refresh=true`
 * skips the cache and spends a billed Places API call, so only staff may ask for
 * that. Anonymous callers get whatever is cached.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const placeId = searchParams.get('placeId') || undefined;

    let forceRefresh = false;
    if (searchParams.get('refresh') === 'true') {
      const caller = await getUserFromRequest(request);
      forceRefresh = Boolean(caller && STAFF_ROLES.includes(caller.role as (typeof STAFF_ROLES)[number]));
    }

    const data = await getGoogleBusinessProfile({
      placeId,
      forceRefresh,
    });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Cache-Status': data.cacheMeta?.isCached ? 'HIT' : 'MISS',
      },
    });
  } catch (error) {
    console.error('Error handling Google Places GET request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Google Places profile' },
      { status: 500 }
    );
  }
}
