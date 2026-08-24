'use client';

// components/admin/useProductForm.ts
//
// All of the add/edit product form's state, derived values and handlers.
//
// Extracted from the admin shell because the modal needs about fifty of them: as
// props that is a declaration list longer than most of the markup, and every one
// is a chance for the shell and the modal to disagree about a name. The shell
// calls this once and hands the bundle down whole.

import React, { useMemo, useState } from 'react';

import { fetchProductRow, type ProductWriteInput } from '@/lib/api/storefront';
import { buildSku, uniqueSku, validateSku } from '@/lib/catalog/sku';
import type { Brand, CategoryItem, Product } from '@/types';

import {
  LOADED_ONLY_STATES,
  PRODUCT_TABS,
  PUBLISH_STATES,
  decimalToInput,
  emptyProductForm,
  linesToList,
  listToLines,
  specsFromProduct,
  tabForField,
  type ImageDraft,
  type ProductFormState,
  type ProductTab,
  type SpecDraft,
} from './productForm';
import { genAdminId, slugify, toNumber, type PublishState } from './shared';

export interface UseProductFormOptions {
  products: Product[];
  brands: Brand[];
  categories: CategoryItem[];
  saveProduct: (
    input: ProductWriteInput,
    productId?: string,
  ) => Promise<{ ok: true; product: Product } | { ok: false; error: string }>;
  logAuditAction: (module: string, action: string, details: string) => void;
}

export const useProductForm = ({
  products,
  brands,
  categories,
  saveProduct,
  logAuditAction,
}: UseProductFormOptions) => {
  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // New Product Form
  const [prodForm, setProdForm] = useState<ProductFormState>(emptyProductForm);
  /** Gallery and spec-sheet repeaters — separate arrays because they are row lists, not fields. */
  const [imageRows, setImageRows] = useState<ImageDraft[]>([]);
  const [specRows, setSpecRows] = useState<SpecDraft[]>([]);
  /**
   * Which gallery row the storefront should use as the thumbnail.
   *
   * Held as the row's key rather than its index: rows get added, removed and
   * reordered, and an index would silently start pointing at a different image.
   */
  const [primaryImageKey, setPrimaryImageKey] = useState<string | null>(null);
  const [activeProductTab, setActiveProductTab] = useState<ProductTab>('basic');
  /** Per-field messages, keyed by form field. Cleared on every save attempt. */
  const [productFieldErrors, setProductFieldErrors] = useState<Record<string, string>>({});
  /** Whatever the API said when a save was refused. */
  const [productSaveError, setProductSaveError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  /** True while the full row is being fetched for an edit — see `handleOpenEditProduct`. */
  const [isLoadingProductRow, setIsLoadingProductRow] = useState(false);

  const patchProdForm = (changes: Partial<ProductFormState>) =>
    setProdForm((prev) => ({ ...prev, ...changes }));

  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // ------------------------------------------------------------------ SKU
  //
  // `products.sku` is NOT NULL behind a unique index, so the form has to produce
  // one. It is suggested from brand + title while the field is untouched, and left
  // strictly alone the moment a staff member types their own.

  /** True once the SKU has been typed in by hand — stops the suggestion overwriting it. */
  const [isSkuEdited, setIsSkuEdited] = useState(false);

  /**
   * Every SKU in the catalogue apart from the product being edited.
   *
   * The exclusion matters: re-saving an unchanged product must not report its own
   * SKU as a duplicate of itself.
   */
  const otherSkus = useMemo(
    () =>
      products
        .filter((p) => p.id !== editingProduct?.id)
        .map((p) => p.sku)
        .filter((sku): sku is string => Boolean(sku)),
    [products, editingProduct?.id],
  );

  /**
   * The brand the SKU suggestion and the live preview should use.
   *
   * The form stores the slug — that is what `PUT /api/products/:id` resolves —
   * but `buildSku` and the preview card want the display name.
   */
  const selectedBrandName = useMemo(
    () => brands.find((b) => b.id === prodForm.brandSlug)?.name ?? '',
    [brands, prodForm.brandSlug],
  );

  /**
   * The SKU a new product would get from its current brand and title.
   *
   * Only offered while creating. An existing product's SKU is printed on order
   * lines and stock adjustments, so renaming the product must not silently
   * renumber the stock it has already shipped.
   */
  const suggestedSku = useMemo(() => {
    if (editingProduct) return '';
    const base = buildSku(selectedBrandName, prodForm.name);
    return base ? uniqueSku(base, otherSkus) : '';
  }, [editingProduct, selectedBrandName, prodForm.name, otherSkus]);

  /** What the field shows: the typed value, or the live suggestion. */
  const skuValue = isSkuEdited ? prodForm.sku : suggestedSku || prodForm.sku;

  // ----------------------------------------------------------------- slug
  //
  // `products.slug` is the storefront product URL and is unique, so it gets the
  // same treatment as the SKU: derived from the title until someone types over
  // it, and never re-derived for a product that is already published under it.

  const [isSlugEdited, setIsSlugEdited] = useState(false);

  const otherSlugs = useMemo(
    () => products.filter((p) => p.id !== editingProduct?.id).map((p) => p.slug),
    [products, editingProduct?.id],
  );

  const suggestedSlug = useMemo(() => {
    const base = slugify(prodForm.name);
    if (!base) return '';
    if (!otherSlugs.includes(base)) return base;
    // The server would also de-duplicate, but showing `-2` here means the URL in
    // the SEO tab is the URL the product actually gets.
    for (let n = 2; n < 100; n += 1) {
      const candidate = `${base}-${n}`;
      if (!otherSlugs.includes(candidate)) return candidate;
    }
    return base;
  }, [prodForm.name, otherSlugs]);

  const slugValue = isSlugEdited ? prodForm.slug : suggestedSlug || prodForm.slug;

  // ------------------------------------------------------- derived pricing
  const sellingPriceNum = toNumber(prodForm.sellingPrice);
  const mrpNum = toNumber(prodForm.mrp);
  const costPriceNum = toNumber(prodForm.costPrice);
  const stockQuantityNum = toNumber(prodForm.stockQuantity);
  const lowStockThresholdNum = toNumber(prodForm.lowStockThreshold, 5);

  /** What the storefront will print as "-N% OFF" — same arithmetic as `mapDbProductToProduct`. */
  const discountPercent =
    mrpNum > sellingPriceNum && mrpNum > 0
      ? Math.round(((mrpNum - sellingPriceNum) / mrpNum) * 100)
      : 0;

  /** Gross margin on the selling price. Never leaves this modal. */
  const marginPercent =
    costPriceNum > 0 && sellingPriceNum > 0
      ? Math.round(((sellingPriceNum - costPriceNum) / sellingPriceNum) * 100)
      : null;

  /** Mirrors `deriveStockStatus` on the server so the preview badge matches what gets saved. */
  const stockStatusLabel =
    stockQuantityNum <= 0
      ? { text: 'Out of stock', tone: 'bg-rose-100 text-rose-700 border-rose-200' }
      : stockQuantityNum <= lowStockThresholdNum
        ? { text: `Low stock · ${stockQuantityNum} left`, tone: 'bg-amber-100 text-amber-800 border-amber-200' }
        : { text: `In stock · ${stockQuantityNum} units`, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

  /** Rows the operator has actually filled in — blank repeater rows are ignored, not sent. */
  const filledImageRows = imageRows.filter((row) => row.url.trim());
  const filledSpecRows = specRows.filter((row) => row.specKey.trim() || row.specValue.trim());

  /**
   * The row that will be saved with `isPrimary: true`.
   *
   * Falls back to the first filled row, matching `replaceImages` on the server —
   * it promotes the first image when nothing is flagged, so "no selection" and
   * "first selected" have to mean the same thing here too.
   */
  const primaryImageRow =
    filledImageRows.find((row) => row.key === primaryImageKey) ?? filledImageRows[0];

  const previewImage = primaryImageRow?.url ?? '';

  /**
   * The states offered in the header toggle.
   *
   * `inactive` and `discontinued` are appended only when the product already has
   * one: the form does not author them (Pause lives in the catalogue row menu,
   * Archive in the delete action), but showing "Published" for an archived
   * product would misreport what the row says.
   */
  const publishStates: Array<{ value: PublishState; label: string; hint: string }> = [
    ...PUBLISH_STATES.map((state) => ({ ...state, value: state.value as PublishState })),
    ...(LOADED_ONLY_STATES[prodForm.status]
      ? [{ value: prodForm.status, ...LOADED_ONLY_STATES[prodForm.status] }]
      : []),
  ];

  /** The chosen category's own subcategory list, offered as a datalist rather than forced. */
  const subcategoryOptions = useMemo(
    () => categories.find((cat) => cat.id === prodForm.categorySlug)?.subcategories ?? [],
    [categories, prodForm.categorySlug],
  );

  /** Which tabs currently hold a validation error, for the badges on the tab strip. */
  const tabsWithErrors = useMemo(() => {
    const set = new Set<ProductTab>();
    Object.keys(productFieldErrors).forEach((field) => set.add(tabForField(field)));
    return set;
  }, [productFieldErrors]);

  // Product Tag handlers
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!prodForm.tags.includes(newTagInput.trim())) {
      setProdForm({ ...prodForm, tags: [...prodForm.tags, newTagInput.trim()] });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProdForm({ ...prodForm, tags: prodForm.tags.filter((t) => t !== tagToRemove) });
  };

  /* ------------------------------------------------- product form: repeaters */

  const addImageRow = () =>
    setImageRows((rows) => [...rows, { key: genAdminId('img'), url: '', altText: '' }]);

  const removeImageRow = (key: string) =>
    setImageRows((rows) => rows.filter((row) => row.key !== key));

  const patchImageRow = (key: string, changes: Partial<ImageDraft>) =>
    setImageRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  /** Row order is the gallery order, so moving a row is how `displayOrder` gets set. */
  const moveImageRow = (key: string, direction: -1 | 1) =>
    setImageRows((rows) => {
      const index = rows.findIndex((row) => row.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addSpecRow = (specKey = '') =>
    setSpecRows((rows) => [...rows, { key: genAdminId('spec'), specKey, specValue: '' }]);

  const removeSpecRow = (key: string) =>
    setSpecRows((rows) => rows.filter((row) => row.key !== key));

  const patchSpecRow = (key: string, changes: Partial<SpecDraft>) =>
    setSpecRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  const clearProductFieldError = (field: string) =>
    setProductFieldErrors((errors) => {
      if (!(field in errors)) return errors;
      const { [field]: _removed, ...rest } = errors;
      return rest;
    });

  /* ------------------------------------------------ product form: validation */

  /**
   * Everything the API would refuse, checked before the request goes out.
   *
   * The form is split across panels, and a browser does not run `required` on an
   * input that is not currently in the DOM — so pressing Publish from the SEO tab
   * with an empty title would otherwise fail server-side naming a field the
   * operator cannot even see. Each problem records which tab to open.
   */
  const validateProductForm = (): {
    errors: Record<string, string>;
    firstTab: ProductTab | null;
  } => {
    const errors: Record<string, string> = {};
    // The owning tab is looked up from the field name rather than passed in, so
    // the error badges on the tab strip and the tab this jumps to can never
    // disagree about where a problem lives.
    const fail = (field: string, message: string) => {
      if (errors[field]) return;
      errors[field] = message;
    };

    if (prodForm.name.trim().length < 2) {
      fail('name', 'Give the product a title of at least 2 characters.');
    }

    if (!prodForm.brandSlug) {
      fail(
        'brandSlug',
        brands.length === 0
          ? 'No brands have loaded from the database yet — reload before adding a product.'
          : 'Choose the brand this product is sold under.',
      );
    }

    if (!prodForm.categorySlug) {
      fail(
        'categorySlug',
        categories.length === 0
          ? 'No categories have loaded from the database yet — reload before adding a product.'
          : 'Choose a category, or the product will not appear under any shop filter.',
      );
    }

    const skuProblem = validateSku(skuValue.trim(), otherSkus);
    if (skuProblem) fail('sku', skuProblem);

    const slug = slugValue.trim();
    if (slug.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      fail('slug', 'Use lowercase words separated by single hyphens, e.g. legion-pro-5.');
    } else if (otherSlugs.includes(slug)) {
      fail('slug', 'Another product already uses this URL.');
    }

    if (!(sellingPriceNum > 0)) {
      fail('sellingPrice', 'The selling price is what the customer is charged — it cannot be zero.');
    }

    if (mrpNum > 0 && mrpNum < sellingPriceNum) {
      fail('mrp', 'The MRP is the struck-through price, so it cannot be below the selling price.');
    }

    if (prodForm.costPrice.trim() && !(costPriceNum >= 0)) {
      fail('costPrice', 'Cost price must be a number, or left blank.');
    }

    if (!Number.isInteger(stockQuantityNum) || stockQuantityNum < 0) {
      fail('stockQuantity', 'Stock must be a whole number of units, zero or more.');
    }

    if (!Number.isInteger(lowStockThresholdNum) || lowStockThresholdNum < 0) {
      fail('lowStockThreshold', 'The low-stock alert level must be a whole number.');
    }

    // `product_images.url` is validated as a URL server-side; catching it here
    // means the operator is told which row is wrong rather than just "invalid".
    filledImageRows.forEach((row) => {
      let parsed: URL | null = null;
      try {
        parsed = new URL(row.url.trim());
      } catch {
        parsed = null;
      }
      if (!parsed || !/^https?:$/.test(parsed.protocol)) {
        fail(`image:${row.key}`, 'Needs a full http(s) image URL.');
      }
    });

    if (filledImageRows.length === 0) {
      fail(
        'images',
        'Add at least one image — the shop grid and product page both render the primary image.',
      );
    }

    filledSpecRows.forEach((row) => {
      if (!row.specKey.trim() || !row.specValue.trim()) {
        fail(`spec:${row.key}`, 'Fill in both the name and the value, or delete the row.');
      }
    });

    const warrantyMonths = toNumber(prodForm.warrantyMonths);
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 240) {
      fail('warrantyMonths', 'Warranty length must be between 0 and 240 months.');
    }

    const order = PRODUCT_TABS.map((tab) => tab.id);
    const firstTab =
      Object.keys(errors)
        .map(tabForField)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? null;

    return { errors, firstTab };
  };

  /* ---------------------------------------------------- product form: saving */

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setIsSkuEdited(false);
    setIsSlugEdited(false);
    setProductFieldErrors({});
    setProductSaveError(null);
    setActiveProductTab('basic');
  };

  /**
   * Persists the product and pulls the catalogue back in.
   *
   * `status` is passed rather than read from the form so the footer's two buttons
   * — Save as Draft and Publish — can each mean what they say without the
   * operator also having to flip the toggle in the header.
   */
  const submitProduct = async (status: PublishState) => {
    setProductSaveError(null);

    const { errors, firstTab } = validateProductForm();
    setProductFieldErrors(errors);
    if (firstTab) {
      setActiveProductTab(firstTab);
      return;
    }

    const sku = skuValue.trim();
    const primaryKey = primaryImageRow?.key;

    // Keep the header toggle honest about what is being written — the footer
    // buttons name the state explicitly, and a toggle still reading "Draft"
    // after Publish was pressed would contradict the row.
    patchProdForm({ status });

    const input: ProductWriteInput = {
      sku,
      name: prodForm.name.trim(),
      slug: slugValue.trim(),
      brandSlug: prodForm.brandSlug,
      categorySlug: prodForm.categorySlug,
      subcategory: prodForm.subcategory.trim() || undefined,
      basePrice: sellingPriceNum,
      compareAtPrice: mrpNum > 0 ? mrpNum : undefined,
      costPrice: prodForm.costPrice.trim() ? costPriceNum : undefined,
      stockQuantity: stockQuantityNum,
      lowStockThreshold: lowStockThresholdNum,
      warrantyMonths: toNumber(prodForm.warrantyMonths),
      warrantyType: prodForm.warrantyType,
      warrantyText: prodForm.warrantyText.trim() || undefined,
      shortDescription: prodForm.shortDescription.trim() || undefined,
      description: prodForm.description.trim() || undefined,
      tags: prodForm.tags,
      features: linesToList(prodForm.featuresText),
      whatsInTheBox: linesToList(prodForm.boxContentsText),
      metaTitle: prodForm.metaTitle.trim() || undefined,
      metaDescription: prodForm.metaDescription.trim() || undefined,
      status,
      // One switch, not two. `lib/pricing/quote.ts` refuses to sell anything whose
      // `isActive` is false *or* whose status is not `active`, so a draft left
      // `isActive: true` would be a product the storefront hides and the order
      // endpoint happily sells.
      isActive: status === 'active',
      isFeatured: prodForm.isFeatured,
      isNewArrival: prodForm.isNewArrival,
      isBestSeller: prodForm.isBestSeller,
      isTrending: prodForm.isTrending,
      isDealOfDay: prodForm.isDealOfDay,
      // Row order is display order; both lists replace what is in the database.
      specs: filledSpecRows.map((row, index) => ({
        specKey: row.specKey.trim(),
        specValue: row.specValue.trim(),
        displayOrder: index,
      })),
      images: filledImageRows.map((row, index) => ({
        url: row.url.trim(),
        altText: row.altText.trim() || undefined,
        displayOrder: index,
        isPrimary: row.key === primaryKey,
      })),
    };

    setIsSavingProduct(true);
    const result = await saveProduct(input, editingProduct?.id);
    setIsSavingProduct(false);

    if (!result.ok) {
      // Kept open with the message the API gave: a rejected save that closed the
      // modal would look like it had worked.
      setProductSaveError(result.error);
      return;
    }

    const verb = editingProduct?.id ? 'Update Product' : 'Create Product';
    logAuditAction(
      'Catalog',
      verb,
      `${editingProduct?.id ? 'Updated' : 'Created'} ${result.product.name} (SKU ${sku}) — saved as ${
        status === 'active' ? 'published' : status
      }`,
    );

    closeProductModal();
  };

  const handleSaveProductModal = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter inside a field saves with whatever the header toggle says.
    void submitProduct(prodForm.status);
  };

  /**
   * Opens the form on an existing product.
   *
   * Seeded from the catalogue list first so the modal opens without a wait, then
   * replaced with the real `products` row. The mapped `Product` the storefront
   * uses cannot carry cost price, meta tags, per-image alt text, the warranty type
   * or the draft/paused distinction — editing from it alone would blank all of
   * that out on the next save.
   */
  const handleOpenEditProduct = async (p: Product) => {
    setEditingProduct(p);
    // An existing product's SKU is already on its order lines and stock
    // adjustments, and its slug is already a published URL, so neither is
    // re-derived from the title.
    setIsSkuEdited(true);
    setIsSlugEdited(true);
    setProductFieldErrors({});
    setProductSaveError(null);
    setActiveProductTab('basic');

    setProdForm({
      ...emptyProductForm(),
      name: p.name,
      // Products carry the brand *name*; the form and the API work in slugs.
      brandSlug: brands.find((b) => b.name.toLowerCase() === p.brand.toLowerCase())?.id ?? '',
      categorySlug: p.category,
      subcategory: p.subcategory ?? '',
      sku: p.sku ?? '',
      slug: p.slug,
      mrp: p.mrp > p.sellingPrice ? String(p.mrp) : '',
      sellingPrice: String(p.sellingPrice),
      stockQuantity: String(p.stockQuantity),
      lowStockThreshold: String(p.lowStockThreshold ?? 5),
      shortDescription: p.shortDescription ?? '',
      description: p.longDescription ?? p.fullDescription ?? '',
      warrantyMonths: String(p.warrantyMonths ?? 12),
      warrantyText: p.warranty ?? '',
      featuresText: listToLines(p.features),
      boxContentsText: listToLines(p.whatsInTheBox),
      tags: p.tags ?? [],
      status: p.status ?? 'active',
      isFeatured: Boolean(p.isFeatured),
      isNewArrival: Boolean(p.isNewArrival),
      isBestSeller: Boolean(p.isBestSeller),
      isTrending: Boolean(p.isTrending),
      isDealOfDay: Boolean(p.isDealOfDay),
    });
    setImageRows(
      (p.images.length > 0 ? p.images : ['']).map((url) => ({
        key: genAdminId('img'),
        url,
        altText: '',
      })),
    );
    setSpecRows(specsFromProduct(p));
    setPrimaryImageKey(null);
    setIsProductModalOpen(true);

    const numericId = Number(p.id);
    // Products created locally before the API existed have ids like `p-3`; there
    // is no row to fetch, so the seeded values are all there is.
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    setIsLoadingProductRow(true);
    const result = await fetchProductRow(numericId);
    setIsLoadingProductRow(false);

    if (!result.ok) {
      setProductSaveError(
        `Showing only what the catalogue list holds — the full record could not be loaded (${result.error}). Cost price and SEO fields may look empty; saving now would leave them untouched.`,
      );
      return;
    }

    const row = result.data;
    setProdForm({
      name: row.name,
      brandSlug: row.brandSlug ?? '',
      categorySlug: row.categorySlug ?? '',
      subcategory: row.subcategory ?? '',
      sku: row.sku,
      slug: row.slug,
      mrp: decimalToInput(row.compareAtPrice),
      sellingPrice: decimalToInput(row.basePrice),
      costPrice: decimalToInput(row.costPrice),
      stockQuantity: String(row.stockQuantity),
      lowStockThreshold: String(row.lowStockThreshold),
      shortDescription: row.shortDescription ?? '',
      description: row.description ?? '',
      warrantyMonths: String(row.warrantyMonths ?? 0),
      warrantyType: row.warrantyType ?? 'official_np',
      warrantyText: row.warrantyText ?? '',
      featuresText: listToLines(row.features),
      boxContentsText: listToLines(row.whatsInTheBox),
      tags: row.tags ?? [],
      metaTitle: row.metaTitle ?? '',
      metaDescription: row.metaDescription ?? '',
      status: row.status,
      isFeatured: row.isFeatured,
      isNewArrival: row.isNewArrival,
      isBestSeller: row.isBestSeller,
      isTrending: row.isTrending,
      isDealOfDay: row.isDealOfDay,
    });

    const loadedImages: ImageDraft[] =
      row.images.length > 0
        ? row.images.map((image) => ({
            key: genAdminId('img'),
            url: image.url,
            altText: image.altText ?? '',
          }))
        : [{ key: genAdminId('img'), url: '', altText: '' }];
    setImageRows(loadedImages);
    setPrimaryImageKey(
      loadedImages[row.images.findIndex((image) => image.isPrimary)]?.key ?? null,
    );
    setSpecRows(
      row.specs.map((spec) => ({
        key: genAdminId('spec'),
        specKey: spec.specKey,
        specValue: spec.specValue,
      })),
    );
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    // Back to suggesting the SKU and the URL from brand + title.
    setIsSkuEdited(false);
    setIsSlugEdited(false);
    setProductFieldErrors({});
    setProductSaveError(null);
    setActiveProductTab('basic');
    // Brand and category are left unset on purpose. Defaulting to whichever row
    // happens to come back first from the API is how a catalogue ends up full of
    // Dell printers.
    setProdForm(emptyProductForm());
    setImageRows([{ key: genAdminId('img'), url: '', altText: '' }]);
    setSpecRows([{ key: genAdminId('spec'), specKey: '', specValue: '' }]);
    setPrimaryImageKey(null);
    setIsProductModalOpen(true);
  };

  return {
    // modal visibility
    isProductModalOpen,
    editingProduct,
    isLoadingProductRow,
    // the form itself
    prodForm,
    patchProdForm,
    imageRows,
    specRows,
    primaryImageKey,
    setPrimaryImageKey,
    activeProductTab,
    setActiveProductTab,
    productFieldErrors,
    clearProductFieldError,
    productSaveError,
    isSavingProduct,
    // tags
    newTagInput,
    setNewTagInput,
    isAddingTag,
    setIsAddingTag,
    handleAddTag,
    handleRemoveTag,
    // SKU and slug
    isSkuEdited,
    setIsSkuEdited,
    selectedBrandName,
    suggestedSku,
    skuValue,
    setIsSlugEdited,
    slugValue,
    // derived pricing and stock
    sellingPriceNum,
    mrpNum,
    costPriceNum,
    discountPercent,
    marginPercent,
    stockStatusLabel,
    // repeater rows
    filledImageRows,
    filledSpecRows,
    primaryImageRow,
    previewImage,
    addImageRow,
    removeImageRow,
    patchImageRow,
    moveImageRow,
    addSpecRow,
    removeSpecRow,
    patchSpecRow,
    // options and error badges
    publishStates,
    subcategoryOptions,
    tabsWithErrors,
    // open / close / save
    handleOpenAddProduct,
    handleOpenEditProduct,
    closeProductModal,
    submitProduct,
    handleSaveProductModal,
  };
};

/**
 * The bundle `useProductForm` hands back.
 *
 * Inferred rather than hand-written so the hook stays the single definition — a
 * separate interface would be one more thing to keep in step.
 */
export type ProductFormController = ReturnType<typeof useProductForm>;
