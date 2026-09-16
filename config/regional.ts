// config/regional.ts
//
// Where the store actually delivers, and what it is allowed to claim.
//
// The storefront copy used to promise "all 77 districts of Nepal" while the
// warehouse and every rider sit in Dhangadhi. This file is the single source of
// truth for the operating footprint — Sudurpashchim Province (Province No. 7),
// nine districts, with the nationwide rollout staged behind `activeScope`. Both
// the SEO engine (`lib/seo/*`) and the delivery/coverage copy read from here, so
// flipping the scope flag moves the whole site at once instead of leaving stale
// promises in a dozen JSX strings.
//
// Deliberately framework-free (no React, no `server-only`): the admin console,
// the route handlers, the sitemap builder and the seed script all import it.

import { PROVINCE_LABELS, type ProvinceCode } from '@/lib/nepal/provinces';

/** How wide the store is currently claiming to serve. */
export type RegionalScope = 'REGION_EXCLUSIVE' | 'NEPAL_NATIONWIDE';

export interface DistrictCoverage {
  /** District name as printed on an address. */
  name: string;
  /** Delivery hubs / towns served inside the district. */
  hubs: string[];
  /** Human-readable delivery promise shown on the storefront. */
  estTime: string;
  /** Working-day upper bound — what the delivery-zone seed and quote use. */
  estimatedDays: number;
  /** Flat delivery fee in NPR for this district. */
  flatFee: number;
  /** Cash on Delivery available in this district. */
  codAvailable: boolean;
  /** Same-day dispatch hub (Dhangadhi ring). */
  sameDay?: boolean;
}

export const SUDURPASHCHIM_CONFIG = {
  /** Flip to 'NEPAL_NATIONWIDE' when phase 2 ships — nothing else needs editing. */
  activeScope: 'REGION_EXCLUSIVE' as RegionalScope,

  primaryProvinceCode: 'sudurpashchim' as ProvinceCode,
  primaryProvince: 'Sudurpashchim Province (Province No. 7)',
  primaryProvinceShort: 'Sudurpashchim',
  headquartersHub: 'Dhangadhi Main Office & Warehouse',
  headquartersCity: 'Dhangadhi',
  headquartersDistrict: 'Kailali',
  postalCode: '10900',
  countryCode: 'NP',

  /** Dhangadhi Sub-Metropolitan City — used for LocalBusiness geo + map embeds. */
  geo: { latitude: 28.6954, longitude: 80.6060 },

  keyDistricts: [
    {
      name: 'Kailali',
      hubs: ['Dhangadhi', 'Attariya', 'Tikapur', 'Lamki', 'Sukkhad'],
      estTime: 'Same Day - 24 Hrs',
      estimatedDays: 1,
      flatFee: 100,
      codAvailable: true,
      sameDay: true,
    },
    {
      name: 'Kanchanpur',
      hubs: ['Mahendranagar', 'Belauri', 'Jhalari'],
      estTime: '24-36 Hours',
      estimatedDays: 2,
      flatFee: 150,
      codAvailable: true,
      sameDay: true,
    },
    {
      name: 'Dadeldhura',
      hubs: ['Amargadhi', 'Gankhet'],
      estTime: '1-2 Days',
      estimatedDays: 2,
      flatFee: 200,
      codAvailable: true,
    },
    {
      name: 'Doti',
      hubs: ['Sipakhati', 'Dipayal Silgadhi'],
      estTime: '2-3 Days',
      estimatedDays: 3,
      flatFee: 250,
      codAvailable: true,
    },
    {
      name: 'Baitadi',
      hubs: ['Dasharathchand', 'Patan'],
      estTime: '2-3 Days',
      estimatedDays: 3,
      flatFee: 250,
      codAvailable: true,
    },
    {
      name: 'Achham',
      hubs: ['Mangalsen', 'Sanfebagar'],
      estTime: '2-3 Days',
      estimatedDays: 3,
      flatFee: 250,
      codAvailable: true,
    },
    {
      name: 'Bajhang',
      hubs: ['Chainpur'],
      estTime: '3-4 Days',
      estimatedDays: 4,
      flatFee: 300,
      codAvailable: false,
    },
    {
      name: 'Bajura',
      hubs: ['Martadi'],
      estTime: '3-4 Days',
      estimatedDays: 4,
      flatFee: 300,
      codAvailable: false,
    },
    {
      name: 'Darchula',
      hubs: ['Khalanga'],
      estTime: '3-4 Days',
      estimatedDays: 4,
      flatFee: 300,
      codAvailable: false,
    },
  ] as DistrictCoverage[],

  bannerMessage:
    '🚚 Fast Express Delivery Across All 9 Districts of Sudurpashchim Province! (Nepal-wide delivery coming soon)',
  nationwideTeaser: 'Nepal-wide delivery coming soon — Phase 2',
  seoDefaultSuffix:
    '| Best Electronics & Tech Store in Sudurpashchim (Dhangadhi & Mahendranagar)',

  /** Local-intent keywords every page inherits before its own are appended. */
  seoBaseKeywords: [
    'laptop store dhangadhi',
    'computer shop mahendranagar',
    'tech store kailali',
    'sudurpashchim electronics',
    'online shopping dhangadhi',
    'computer price nepal',
    'cctv installation dhangadhi',
    'printer repair kailali',
  ],
} as const;

/** `['Kailali', 'Kanchanpur', …]` — the nine served districts. */
export const SUDURPASHCHIM_DISTRICTS: string[] = SUDURPASHCHIM_CONFIG.keyDistricts.map(
  (d) => d.name,
);

/** Every hub town, flattened — the `areaServed` list for LocalBusiness JSON-LD. */
export const SUDURPASHCHIM_HUBS: string[] = SUDURPASHCHIM_CONFIG.keyDistricts.flatMap(
  (d) => d.hubs,
);

/** Hubs that get same-day / next-morning dispatch, for the express badge. */
export const SAME_DAY_HUBS: string[] = SUDURPASHCHIM_CONFIG.keyDistricts
  .filter((d) => d.sameDay)
  .flatMap((d) => d.hubs)
  .slice(0, 3);

export const isNationwideActive = (): boolean =>
  SUDURPASHCHIM_CONFIG.activeScope === 'NEPAL_NATIONWIDE';

/**
 * Coverage lookup for a district name, case- and suffix-insensitive.
 *
 * Addresses arrive as free text from the checkout form ("kailali ", "Kailali
 * District"), so the comparison is normalised rather than exact.
 */
const normalizeDistrict = (value: string) =>
  value.trim().toLowerCase().replace(/\s+district$/, '');

export function districtCoverage(district: string | null | undefined): DistrictCoverage | null {
  if (!district) return null;
  const target = normalizeDistrict(district);
  return (
    SUDURPASHCHIM_CONFIG.keyDistricts.find((d) => normalizeDistrict(d.name) === target) ?? null
  );
}

/**
 * Whether the store will currently ship to an address.
 *
 * Under `REGION_EXCLUSIVE` only the nine Sudurpashchim districts qualify; under
 * `NEPAL_NATIONWIDE` every province does. Callers that only know the province
 * (a coarse form) can omit the district.
 */
export function isServiceable(address: {
  province?: string | null;
  district?: string | null;
}): boolean {
  if (isNationwideActive()) return true;

  const province = (address.province ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+province.*$/, '');
  const provinceMatches =
    province === SUDURPASHCHIM_CONFIG.primaryProvinceCode || province === 'sudurpaschim' || province === '';

  if (!provinceMatches) return false;
  if (!address.district) return provinceMatches;
  return districtCoverage(address.district) !== null;
}

/** "Same Day - 24 Hrs" for a district, or the nationwide fallback promise. */
export function deliveryPromise(district?: string | null): string {
  const coverage = districtCoverage(district);
  if (coverage) return coverage.estTime;
  return isNationwideActive() ? '3-7 Business Days' : 'Not yet serviceable';
}

/** One-line coverage summary reused by the footer, FAQ and About page. */
export const COVERAGE_SUMMARY = isNationwideActive()
  ? 'Express courier dispatch across all 77 districts of Nepal, with same-day delivery inside Dhangadhi & Kailali.'
  : `Same-day delivery in ${SAME_DAY_HUBS.join(', ')} and 24-96 hour express dispatch across all ${SUDURPASHCHIM_DISTRICTS.length} districts of ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}. Nepal-wide delivery coming soon.`;

/** Province codes the store currently sells into — used to seed delivery zones. */
export const SERVICED_PROVINCE_CODES: ProvinceCode[] = isNationwideActive()
  ? (Object.keys(PROVINCE_LABELS) as ProvinceCode[])
  : [SUDURPASHCHIM_CONFIG.primaryProvinceCode];
