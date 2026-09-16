// lib/api/catalog-admin.ts
//
// Browser-side calls to the four catalog reference-data registries: categories,
// brands, attributes and filter tags.
//
// Kept apart from ./storefront.ts because these are a different audience. Every
// endpoint below is staff-only, and the row shapes are the *admin* shapes — the
// public `/api/categories` and `/api/brands` responses publish a row's slug as its
// `id` and drop `isFeatured` entirely, so a form built on those has no key to
// address a row with and no way to see half the fields it is meant to edit. Hence
// the `?view=admin` branch and the `Admin*` types re-declared here.
//
// The `request` helper is imported rather than reimplemented: it already unwraps
// Zod's `details` array into a single readable line, which is what makes a refused
// save show "slug: Use lowercase letters..." instead of "Request failed (400)".

import { request, type ApiResult } from './storefront';
import type { AttributeDataType, FilterTagColor } from '@/lib/validation/catalog-admin';

/* --------------------------------------------------------------- row shapes */

/**
 * Mirrors `AdminCategory` in lib/queries/registry.ts.
 *
 * `parentId` is the whole reason the Category Tree can be a tree: it is the
 * self-reference the nesting is built from, and it is absent from the public
 * payload.
 */
export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  imageUrl: string | null;
  subcategories: string[];
  parentId: number | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

/** Mirrors `AdminBrand` in lib/queries/registry.ts. */
export interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isPartner: boolean;
  isFeatured: boolean;
  categorySlugs: string[];
  isActive: boolean;
  productCount: number;
}

export interface AdminAttributeOption {
  id: number;
  value: string;
  slug: string;
  displayOrder: number;
}

/** Mirrors `AdminAttribute` in lib/queries/registry.ts. */
export interface AdminAttribute {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  dataType: AttributeDataType;
  unit: string | null;
  isFilterable: boolean;
  displayOrder: number;
  isActive: boolean;
  categoryIds: number[];
  options: AdminAttributeOption[];
  /** How many products have answered this attribute. Blocks a hard delete. */
  valueCount: number;
}

/** Mirrors `AdminFilterTag` in lib/queries/registry.ts. */
export interface AdminFilterTag {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: FilterTagColor;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

/* ------------------------------------------------------------ write payloads */

/**
 * What the category form sends.
 *
 * Nullable rather than merely optional on the text columns: omitting a field means
 * "leave it alone", sending `null` means "clear it". A cleared image URL has to be
 * expressible, and `''` would fail the endpoint's `.url()` check.
 */
export interface CategoryWriteInput {
  name: string;
  slug: string;
  description?: string | null;
  iconName?: string | null;
  imageUrl?: string | null;
  subcategories?: string[];
  parentId?: number | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface BrandWriteInput {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  isPartner?: boolean;
  isFeatured?: boolean;
  categorySlugs?: string[];
  isActive?: boolean;
}

/**
 * One option row on the way back to the server.
 *
 * `id` present means "this is the existing row, renamed" — which keeps every
 * product that chose it pointing at the same row. Dropping the id would delete and
 * re-insert, clearing the value off every product that had picked it.
 */
export interface AttributeOptionWriteInput {
  id?: number;
  value: string;
  displayOrder?: number;
}

export interface AttributeWriteInput {
  name: string;
  slug: string;
  description?: string | null;
  dataType?: AttributeDataType;
  unit?: string | null;
  isFilterable?: boolean;
  displayOrder?: number;
  isActive?: boolean;
  /** Empty array means "applies to every category". */
  categoryIds?: number[];
  /** Only meaningful for `select`; the endpoint refuses options on other types. */
  options?: AttributeOptionWriteInput[];
}

export interface FilterTagWriteInput {
  name: string;
  slug: string;
  description?: string | null;
  color?: FilterTagColor;
  displayOrder?: number;
  isActive?: boolean;
}

/* ------------------------------------------------------------------ deletes */

/**
 * What a registry DELETE reports back.
 *
 * Deleting a row something depends on would take data with it — a category clears
 * `products.category_id`, an attribute cascades away every product's value for it —
 * so the endpoints count references first and deactivate instead when the count is
 * non-zero. `outcome` says which happened and `message` explains why, so the UI can
 * tell the difference instead of claiming a delete that did not occur.
 */
export interface DeleteResult {
  success: true;
  outcome: 'deleted' | 'deactivated';
  message?: string;
  productCount?: number;
  childCount?: number;
  valueCount?: number;
}

/* ------------------------------------------------------------------- shared */

const listQuery = (includeInactive: boolean) => (includeInactive ? '?includeInactive=true' : '');

/** Unwraps `{ categories: [...] }`-style envelopes to the array itself. */
async function listOf<T>(
  url: string,
  key: string,
): Promise<ApiResult<T[]>> {
  const result = await request<Record<string, T[]>>(url);
  if (!result.ok) return result;
  return { ok: true, data: result.data?.[key] ?? [] };
}

const write = <T>(url: string, method: 'POST' | 'PUT', body: unknown) =>
  request<T>(url, { method, body: JSON.stringify(body) });

/* --------------------------------------------------------------- categories */

/**
 * The admin category list, flat. `view=admin` is what switches the response from
 * the storefront's slug-keyed `CategoryItem` to the row shape above; the endpoint
 * checks the caller's role before honouring it.
 */
export const fetchAdminCategories = (includeInactive = true) =>
  listOf<AdminCategory>(
    `/api/categories?view=admin${includeInactive ? '&includeInactive=true' : ''}`,
    'categories',
  );

export const createCategory = (input: CategoryWriteInput) =>
  write<{ success: true; category: AdminCategory }>('/api/categories', 'POST', input);

export const updateCategory = (id: number, input: Partial<CategoryWriteInput>) =>
  write<{ success: true; category: AdminCategory }>(`/api/categories/${id}`, 'PUT', input);

export const deleteCategory = (id: number) =>
  request<DeleteResult>(`/api/categories/${id}`, { method: 'DELETE' });

/* -------------------------------------------------------------------- brands */

export const fetchAdminBrands = (includeInactive = true) =>
  listOf<AdminBrand>(
    `/api/brands?view=admin${includeInactive ? '&includeInactive=true' : ''}`,
    'brands',
  );

export const createBrand = (input: BrandWriteInput) =>
  write<{ success: true; brand: AdminBrand }>('/api/brands', 'POST', input);

export const updateBrand = (id: number, input: Partial<BrandWriteInput>) =>
  write<{ success: true; brand: AdminBrand }>(`/api/brands/${id}`, 'PUT', input);

export const deleteBrand = (id: number) =>
  request<DeleteResult>(`/api/brands/${id}`, { method: 'DELETE' });

/* ---------------------------------------------------------------- attributes */

export const fetchAdminAttributes = (includeInactive = true) =>
  listOf<AdminAttribute>(
    `/api/catalog/attributes${listQuery(includeInactive)}`,
    'attributes',
  );

export const createAttribute = (input: AttributeWriteInput) =>
  write<{ success: true; attribute: AdminAttribute }>('/api/catalog/attributes', 'POST', input);

export const updateAttribute = (id: number, input: Partial<AttributeWriteInput>) =>
  write<{ success: true; attribute: AdminAttribute }>(
    `/api/catalog/attributes/${id}`,
    'PUT',
    input,
  );

export const deleteAttribute = (id: number) =>
  request<DeleteResult>(`/api/catalog/attributes/${id}`, { method: 'DELETE' });

/* -------------------------------------------------------------- filter tags */

export const fetchAdminFilterTags = (includeInactive = true) =>
  listOf<AdminFilterTag>(
    `/api/catalog/filter-tags${listQuery(includeInactive)}`,
    'filterTags',
  );

export const createFilterTag = (input: FilterTagWriteInput) =>
  write<{ success: true; filterTag: AdminFilterTag }>('/api/catalog/filter-tags', 'POST', input);

export const updateFilterTag = (id: number, input: Partial<FilterTagWriteInput>) =>
  write<{ success: true; filterTag: AdminFilterTag }>(
    `/api/catalog/filter-tags/${id}`,
    'PUT',
    input,
  );

export const deleteFilterTag = (id: number) =>
  request<DeleteResult>(`/api/catalog/filter-tags/${id}`, { method: 'DELETE' });

/* ------------------------------------------------------------ all four at once */

export interface RegistrySnapshot {
  categories: AdminCategory[];
  brands: AdminBrand[];
  attributes: AdminAttribute[];
  filterTags: AdminFilterTag[];
}

/**
 * Loads all four registries in parallel and reports the first failure.
 *
 * They load together because the forms cross-reference each other: the category
 * modal's parent picker needs the category list, the brand modal's scope chips need
 * it too, and the attribute modal's applicable-categories chips need it a third
 * time. Fetching per-tab would mean the same list arriving three times.
 */
export async function fetchRegistries(
  includeInactive = true,
): Promise<ApiResult<RegistrySnapshot>> {
  const [categories, brands, attributes, filterTags] = await Promise.all([
    fetchAdminCategories(includeInactive),
    fetchAdminBrands(includeInactive),
    fetchAdminAttributes(includeInactive),
    fetchAdminFilterTags(includeInactive),
  ]);

  const failure = [categories, brands, attributes, filterTags].find((r) => !r.ok);
  if (failure && !failure.ok) return failure;

  return {
    ok: true,
    data: {
      categories: categories.ok ? categories.data : [],
      brands: brands.ok ? brands.data : [],
      attributes: attributes.ok ? attributes.data : [],
      filterTags: filterTags.ok ? filterTags.data : [],
    },
  };
}
