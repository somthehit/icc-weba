// db/seed-facets.ts
//
// The seeded catalogue's structured facet data: attribute definitions, their
// option lists, and the filter tags — plus the rules that read a value off a
// product.
//
// Every value here is *derived from data the product already carries*, never
// invented. A laptop's RAM facet comes from its own `RAM` spec line, its warranty
// facet from its own warranty text, its "Best Seller" tag from its own
// `isBestSeller` flag. Where a product has nothing to derive from, it gets no row
// and the facet count for it stays at zero.
//
// That matters because the whole point of the attributes registry is comparable
// values. `product_specs` already holds the prose ("16GB DDR4 3200MHz
// (Expandable up to 32GB)"); it cannot be filtered on because no two products
// write it the same way. These derivations pull the *comparable* part out ("16GB")
// and only when it matches an option exactly — a near-miss is dropped rather than
// guessed at, because a wrong facet value is worse than a missing one.
//
// Coverage is therefore uneven and honestly so: only 6 of the 30 seeded products
// are laptops, so the RAM facet covers 6. Warranty covers nearly all 30, which is
// why it is the one attribute with no category restriction.

import type { Product } from '@/types';

export type FacetDataType = 'text' | 'number' | 'boolean' | 'select';

export interface SeedAttribute {
  name: string;
  slug: string;
  description: string;
  dataType: FacetDataType;
  /** Only meaningful for `number`. Kept out of the value so figures compare. */
  unit: string | null;
  isFilterable: boolean;
  /** Category slugs the attribute applies to. Empty means every category. */
  categorySlugs: string[];
  /** The allowed values, for `select` only. Order here is display order. */
  options: string[];
  /**
   * Reads one product and returns the value to store, or `null` for "this
   * product has no answer". For a `select` attribute the string must appear in
   * `options` verbatim; the caller drops anything that does not match rather
   * than inventing an option for it.
   */
  derive: (product: Product) => string | null;
}

export interface SeedFilterTag {
  name: string;
  slug: string;
  description: string;
  color: string;
  /** The product flag this tag mirrors. */
  applies: (product: Product) => boolean;
}

/** Reads a spec line by key, tolerating both the list and map spec shapes. */
const readSpec = (product: Product, ...keys: string[]): string => {
  const specs = product.specifications;
  if (!specs) return '';
  for (const key of keys) {
    if (Array.isArray(specs)) {
      const hit = specs.find((entry) => entry.key === key);
      if (hit?.value) return hit.value;
    } else {
      const value = (specs as Record<string, unknown>)[key];
      if (value != null && String(value) !== '') return String(value);
    }
  }
  return '';
};

/**
 * "16GB DDR4 3200MHz (Expandable up to 32GB)" -> "16GB".
 *
 * Anchored at the start on purpose: that trailing "up to 32GB" is a ceiling, not
 * what is in the machine, and an unanchored match would file a 16GB laptop under
 * the 32GB facet.
 */
const leadingCapacity = (text: string): string | null => {
  const match = text.match(/^(\d+)\s*(GB|TB)\b/i);
  return match ? `${match[1]}${match[2].toUpperCase()}` : null;
};

/** "13.6-inch (diagonal) LED-backlit…" -> "13.6"; `43 Inch` -> "43"; `16" WQXGA` -> "16". */
const diagonalInches = (text: string): string | null => {
  const match = text.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:"|inch)/i);
  return match ? match[1] : null;
};

/** "2 Years Lenovo Official…" -> 24. "Lifetime Limited…" -> 0. Mirrors seed.ts. */
const warrantyMonths = (text: string): number => {
  const years = text.match(/(\d+)\s*Year/i);
  if (years) return parseInt(years[1], 10) * 12;
  const months = text.match(/(\d+)\s*Month/i);
  if (months) return parseInt(months[1], 10);
  return 0;
};

const WARRANTY_LABEL: Record<number, string> = {
  0: 'Lifetime',
  12: '1 Year',
  24: '2 Years',
  36: '3 Years',
  60: '5 Years',
};

export const SEED_ATTRIBUTES: SeedAttribute[] = [
  {
    name: 'System RAM',
    slug: 'system-ram',
    description: 'Installed memory, as shipped — not the maximum the board accepts.',
    dataType: 'select',
    unit: null,
    isFilterable: true,
    categorySlugs: ['computers-laptops'],
    options: ['8GB', '16GB', '32GB'],
    derive: (product) => leadingCapacity(readSpec(product, 'RAM', 'Memory')),
  },
  {
    name: 'Storage Capacity',
    slug: 'storage-capacity',
    description: 'Size of the primary drive the machine ships with.',
    dataType: 'select',
    unit: null,
    isFilterable: true,
    categorySlugs: ['computers-laptops', 'pc-components', 'cctv-security'],
    options: ['256GB', '512GB', '1TB', '4TB'],
    derive: (product) => {
      const direct = readSpec(product, 'Storage');
      if (direct !== '') return leadingCapacity(direct);
      // Bare drives report their size under `Capacity` instead. So does a memory
      // kit, and 32GB of RAM is not 32GB of storage — so a product that declares
      // memory-kit specs is skipped rather than filed under a storage facet.
      const isMemoryKit = readSpec(product, 'Memory Type', 'Tested Speed') !== '';
      if (isMemoryKit) return null;
      return leadingCapacity(readSpec(product, 'Capacity'));
    },
  },
  {
    name: 'Processor Brand',
    slug: 'processor-brand',
    description: 'Who makes the CPU. The single most common way people narrow a laptop search.',
    dataType: 'select',
    unit: null,
    isFilterable: true,
    categorySlugs: ['computers-laptops', 'pc-components'],
    options: ['Intel', 'AMD', 'Apple'],
    derive: (product) => {
      // A boxed CPU has no `Processor` line — it *is* the processor — but it is the
      // only thing in the catalogue that declares a bare `Socket`, so that is a
      // safe signal to fall back on the product's own brand. Without the guard an
      // Intel-branded SSD would acquire a processor brand.
      const cpu = readSpec(product, 'Processor');
      const text = cpu !== '' ? cpu : readSpec(product, 'Socket') !== '' ? product.brand : '';
      if (/\bintel\b/i.test(text)) return 'Intel';
      if (/\b(amd|ryzen)\b/i.test(text)) return 'AMD';
      if (/\bapple\b|\bM[1-4]\b/.test(text)) return 'Apple';
      return null;
    },
  },
  {
    name: 'Screen Size',
    slug: 'screen-size',
    description: 'Diagonal panel size. Numeric so a range filter can work on it.',
    dataType: 'number',
    unit: 'inch',
    isFilterable: true,
    categorySlugs: ['computers-laptops', 'peripherals-accessories', 'electronics-appliances'],
    options: [],
    derive: (product) =>
      diagonalInches(readSpec(product, 'Display', 'Screen Size', 'Display Size')),
  },
  {
    name: 'Dedicated Graphics',
    slug: 'dedicated-graphics',
    description: 'Discrete GPU rather than the one built into the CPU.',
    dataType: 'boolean',
    unit: null,
    isFilterable: true,
    categorySlugs: ['computers-laptops'],
    options: [],
    derive: (product) => {
      const gpu = readSpec(product, 'Graphics');
      if (gpu === '') return null;
      // "Intel Iris Xe" / "Radeon Graphics" with no model number are integrated.
      return /nvidia|geforce|rtx|gtx|radeon\s+rx|arc\s+a\d/i.test(gpu) ? 'true' : 'false';
    },
  },
  {
    name: 'Warranty Period',
    slug: 'warranty-period',
    description:
      'Length of cover as written on the product. The one attribute with no category limit — every product has a warranty.',
    dataType: 'select',
    unit: null,
    isFilterable: true,
    categorySlugs: [],
    options: ['Lifetime', '1 Year', '2 Years', '3 Years', '5 Years'],
    derive: (product) => {
      const text = product.warranty ?? '';
      if (text === '') return null;
      return WARRANTY_LABEL[warrantyMonths(text)] ?? null;
    },
  },
];

/**
 * Merchandising labels, each mirroring a boolean the product already carries.
 *
 * These are deliberately not attributes: "Best Seller" is a decision the shop
 * makes and reverses, not a fact about the hardware.
 */
export const SEED_FILTER_TAGS: SeedFilterTag[] = [
  {
    name: 'Best Seller',
    slug: 'best-seller',
    description: 'Mirrors the product’s Best Seller flag.',
    color: 'amber',
    applies: (product) => product.isBestSeller === true,
  },
  {
    name: 'New Arrival',
    slug: 'new-arrival',
    description: 'Mirrors the product’s New Arrival flag.',
    color: 'emerald',
    applies: (product) => product.isNewArrival === true,
  },
  {
    name: 'Trending Now',
    slug: 'trending-now',
    description: 'Mirrors the product’s Trending flag.',
    color: 'rose',
    applies: (product) => product.isTrending === true,
  },
  {
    name: 'Deal of the Day',
    slug: 'deal-of-the-day',
    description: 'Mirrors the product’s Deal of the Day flag.',
    color: 'violet',
    applies: (product) => product.isDealOfDay === true,
  },
  {
    name: 'Featured',
    slug: 'featured',
    description: 'Mirrors the product’s Featured flag — what the homepage rails pull from.',
    color: 'blue',
    applies: (product) => product.isFeatured === true,
  },
];
