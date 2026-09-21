// components/admin/productForm.ts
//
// The shape of the add/edit product form: its panels, its draft row types, and
// the conversions between a `products` row and the string-valued fields the form
// edits. Kept apart from the modal markup so the form hook and the modal can
// both import them without either owning the other.

import { Product } from '@/types';
import { genAdminId, PublishState } from './shared';

/**
 * The panels of the add/edit product form.
 *
 * A product row plus its gallery, spec sheet and SEO metadata is far too much to
 * put in one scroll — the previous single-column modal only exposed nine of the
 * ~35 writable columns, so everything else silently kept its default.
 */
export const PRODUCT_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'images', label: 'Images' },
  { id: 'pricing', label: 'Pricing & Stock' },
  { id: 'shipping', label: 'Shipping & Delivery' },
  { id: 'specs', label: 'Specifications' },
  { id: 'content', label: 'Description & Warranty' },
  { id: 'seo', label: 'SEO' },
] as const;

export type ProductTab = (typeof PRODUCT_TABS)[number]['id'];

/**
 * A row in the gallery or spec-sheet repeater.
 *
 * `key` exists only so React can keep inputs stable while rows are inserted and
 * removed above them — it is never sent to the server.
 */
export interface ImageDraft {
  key: string;
  url: string;
  altText: string;
}

export interface SpecDraft {
  key: string;
  specKey: string;
  specValue: string;
}

/** `products.warranty_type`, which is a free varchar but only ever holds these. */
export const WARRANTY_TYPES = [
  { value: 'official_np', label: 'Official Nepal warranty' },
  { value: 'international', label: 'International warranty' },
  { value: 'seller', label: 'Seller / shop warranty' },
  { value: 'none', label: 'No warranty' },
] as const;

/** The two states the form authors in; `inactive`/`discontinued` are only ever loaded. */
export const PUBLISH_STATES = [
  { value: 'draft', label: 'Draft', hint: 'Saved to the catalog but hidden from the storefront' },
  { value: 'active', label: 'Published', hint: 'Live on the storefront and orderable' },
] as const;

export const LOADED_ONLY_STATES: Record<string, { label: string; hint: string }> = {
  inactive: { label: 'Paused', hint: 'Hidden from the storefront without being retired' },
  discontinued: { label: 'Archived', hint: 'Retired — kept only so past orders still resolve' },
};

/** One item per line, blanks dropped — how the form edits `tags`/`features`/`whats_in_the_box`. */
export const linesToList = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export const listToLines = (value: string[] | null | undefined): string =>
  Array.isArray(value) ? value.join('\n') : '';

/**
 * Numerics arrive from postgres as strings (`"84999.00"`). An empty optional
 * column reads back as null and must stay empty in the form rather than becoming
 * a literal 0 the operator never typed.
 */
export const decimalToInput = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : String(Number(value));

export const PRODUCT_FORM_DEFAULTS = {
  name: '',
  brandSlug: '',
  categorySlug: '',
  subcategory: '',
  sku: '',
  slug: '',
  /** `compare_at_price` — the struck-through list price. */
  mrp: '',
  /** `base_price` — what the customer actually pays. */
  sellingPrice: '',
  /** `cost_price` — internal only; drives the margin readout and nothing else. */
  costPrice: '',
  stockQuantity: '0',
  lowStockThreshold: '5',
  shortDescription: '',
  description: '',
  warrantyMonths: '12',
  warrantyType: 'official_np',
  warrantyText: '',
  featuresText: '',
  boxContentsText: '',
  tags: [] as string[],
  metaTitle: '',
  metaDescription: '',
  status: 'draft' as PublishState,
  isFeatured: false,
  isNewArrival: true,
  isBestSeller: false,
  isTrending: false,
  isDealOfDay: false,
  /** Shipping & Delivery configurations */
  isPhysicalProduct: true,
  requiresShipping: true,
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  isFreeShipping: false,
  fixedShippingFee: '',
};

export type ProductFormState = typeof PRODUCT_FORM_DEFAULTS;

export const emptyProductForm = (): ProductFormState => ({ ...PRODUCT_FORM_DEFAULTS, tags: [] });

/**
 * Spec rows seeded from a product already in local state.
 *
 * `Product.specifications` is either the ordered array the API returns or the
 * plain object the older seed data used, so both shapes have to be accepted.
 */
export const specsFromProduct = (product: Product): SpecDraft[] => {
  const spec = product.specifications;
  const entries: Array<[string, string]> = Array.isArray(spec)
    ? spec.map((row) => [row.key, row.value])
    : spec
      ? Object.entries(spec).map(([key, value]) => [key, String(value)])
      : [];
  if (entries.length === 0) return [{ key: genAdminId('spec'), specKey: '', specValue: '' }];
  return entries.map(([specKey, specValue]) => ({
    key: genAdminId('spec'),
    specKey,
    specValue,
  }));
};

/** Offered as one-tap chips in the spec repeater — the keys a hardware sheet almost always has. */
export const COMMON_SPEC_KEYS = [
  'Processor',
  'RAM',
  'Storage',
  'Graphics',
  'Display',
  'Battery',
  'Ports',
  'Operating System',
  'Weight',
  'Color',
] as const;

/**
 * Which panel each validation error belongs to, so a refused save can open the
 * tab holding the problem instead of leaving the operator to hunt for it.
 */
const FIELD_TAB: Record<string, ProductTab> = {
  name: 'basic',
  brandSlug: 'basic',
  categorySlug: 'basic',
  subcategory: 'basic',
  sku: 'basic',
  images: 'images',
  sellingPrice: 'pricing',
  mrp: 'pricing',
  costPrice: 'pricing',
  stockQuantity: 'pricing',
  lowStockThreshold: 'pricing',
  weightKg: 'shipping',
  lengthCm: 'shipping',
  widthCm: 'shipping',
  heightCm: 'shipping',
  fixedShippingFee: 'shipping',
  warrantyMonths: 'content',
  slug: 'seo',
  metaTitle: 'seo',
  metaDescription: 'seo',
};

/** Repeater rows are keyed `image:<key>` / `spec:<key>`, so they are matched by prefix. */
export const tabForField = (field: string): ProductTab =>
  field.startsWith('image:')
    ? 'images'
    : field.startsWith('spec:')
      ? 'specs'
      : (FIELD_TAB[field] ?? 'basic');
