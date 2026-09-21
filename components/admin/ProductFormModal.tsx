'use client';

import React from 'react';

import { SKU_MAX_LENGTH } from '@/lib/catalog/sku';
import type { Brand, CategoryItem } from '@/types';

import {
  COMMON_SPEC_KEYS,
  LOADED_ONLY_STATES,
  PRODUCT_TABS,
  WARRANTY_TYPES,
} from './productForm';
import { CharCount, FormField, ToggleRow, inputClass, npr, slugify } from './shared';
import type { ProductFormController } from './useProductForm';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Check,
  Info,
  Loader2,
  Package,
  Percent,
  Plus,
  Scale,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';

import { UploadButton } from './ImageUploadField';

export interface ProductFormModalProps {
  /** The bundle from `useProductForm`, owned by the admin shell. */
  form: ProductFormController;
  brands: Brand[];
  categories: CategoryItem[];
}

/**
 * The add/edit product form: six tabs plus a live storefront preview.
 *
 * Purely presentational — every piece of state and every handler comes in through
 * `form`, so this file is markup and nothing else.
 */
export const ProductFormModal: React.FC<ProductFormModalProps> = ({ form, brands, categories }) => {
  const {
    editingProduct,
    isLoadingProductRow,
    prodForm,
    patchProdForm,
    imageRows,
    specRows,
    setPrimaryImageKey,
    activeProductTab,
    setActiveProductTab,
    productFieldErrors,
    clearProductFieldError,
    productSaveError,
    isSavingProduct,
    newTagInput,
    setNewTagInput,
    isAddingTag,
    setIsAddingTag,
    handleAddTag,
    handleRemoveTag,
    isSkuEdited,
    setIsSkuEdited,
    selectedBrandName,
    suggestedSku,
    skuValue,
    setIsSlugEdited,
    slugValue,
    sellingPriceNum,
    mrpNum,
    costPriceNum,
    discountPercent,
    marginPercent,
    stockStatusLabel,
    filledImageRows,
    filledSpecRows,
    primaryImageRow,
    previewImage,
    addImageRow,
    appendImageRows,
    removeImageRow,
    patchImageRow,
    moveImageRow,
    addSpecRow,
    removeSpecRow,
    patchSpecRow,
    publishStates,
    subcategoryOptions,
    tabsWithErrors,
    closeProductModal,
    submitProduct,
    handleSaveProductModal,
  } = form;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start md:items-center justify-center p-3 md:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-6xl my-4 shadow-2xl border border-gray-200 flex flex-col max-h-[94vh] text-xs">

        {/* ---------------------------------------------------- header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base text-gray-900 truncate">
              {editingProduct ? 'Edit Catalog Product' : 'Add New Hardware Product'}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {editingProduct
                ? isLoadingProductRow
                  ? 'Loading the full record…'
                  : `SKU ${skuValue || '—'} · saved changes go live immediately`
                : 'Six panels cover every field the storefront reads. Nothing is written until you save.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {isLoadingProductRow && (
              <Loader2 className="w-4 h-4 text-[#0056b3] animate-spin" aria-label="Loading product" />
            )}

            {/* Publish state — a segmented control rather than a select, so the
                live/hidden distinction is readable without opening anything. */}
            <div
              role="radiogroup"
              aria-label="Publish state"
              className="hidden sm:flex items-center gap-0.5 bg-gray-100 border border-gray-200 rounded-xl p-0.5"
            >
              {publishStates.map((state) => (
                <button
                  key={state.value}
                  type="button"
                  role="radio"
                  aria-checked={prodForm.status === state.value}
                  title={state.hint}
                  onClick={() => patchProdForm({ status: state.value })}
                  className={`px-3 py-1.5 rounded-[10px] font-bold text-[11px] transition-colors ${prodForm.status === state.value
                    ? 'bg-white text-[#0056b3] shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                    }`}
                >
                  {state.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={closeProductModal}
              aria-label="Close"
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveProductModal} className="flex flex-col min-h-0 flex-1">

          {/* ------------------------------------------- save error banner */}
          {productSaveError && (
            <div
              role="alert"
              className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="font-semibold leading-relaxed">{productSaveError}</p>
            </div>
          )}

          {/* ------------------------------------------------- tab strip */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 -mb-px">
              {PRODUCT_TABS.map((tab) => {
                const isActive = activeProductTab === tab.id;
                const hasError = tabsWithErrors.has(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveProductTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 font-bold border-b-2 transition-colors ${isActive
                      ? 'border-[#0056b3] text-[#0056b3]'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                  >
                    <span>{tab.label}</span>
                    {hasError && (
                      <span
                        title="This panel has a problem"
                        className="w-1.5 h-1.5 rounded-full bg-rose-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------- body: panels + preview */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_290px] gap-6 px-6 py-5 overflow-y-auto flex-1 min-h-0">

            <div className="min-w-0 space-y-4">

              {/* ============================================ BASIC INFO */}
              {activeProductTab === 'basic' && (
                <>
                  <FormField
                    label="Product title"
                    htmlFor="prod-name"
                    required
                    error={productFieldErrors.name}
                    hint={
                      <span className="flex items-center justify-between gap-2">
                        <span>Exactly as it should read on the shop grid and product page.</span>
                        <CharCount value={prodForm.name} max={200} />
                      </span>
                    }
                  >
                    <input
                      id="prod-name"
                      type="text"
                      value={prodForm.name}
                      onChange={(e) => {
                        clearProductFieldError('name');
                        patchProdForm({ name: e.target.value });
                      }}
                      maxLength={200}
                      placeholder="Lenovo Legion Pro 5 16IRX9 Gaming Laptop"
                      className={`${inputClass(Boolean(productFieldErrors.name))} font-bold`}
                    />
                  </FormField>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField
                      label="Brand"
                      htmlFor="prod-brand"
                      required
                      error={productFieldErrors.brandSlug}
                      hint="Drives the SKU prefix and the brand filter on the shop page."
                    >
                      <select
                        id="prod-brand"
                        value={prodForm.brandSlug}
                        onChange={(e) => {
                          clearProductFieldError('brandSlug');
                          patchProdForm({ brandSlug: e.target.value });
                        }}
                        className={`${inputClass(Boolean(productFieldErrors.brandSlug))} font-bold`}
                      >
                        <option value="">Select a brand…</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      label="Category"
                      htmlFor="prod-category"
                      required
                      error={productFieldErrors.categorySlug}
                      hint="Where the product appears in the shop navigation."
                    >
                      <select
                        id="prod-category"
                        value={prodForm.categorySlug}
                        onChange={(e) => {
                          clearProductFieldError('categorySlug');
                          // The old subcategory belongs to the old category's list.
                          patchProdForm({ categorySlug: e.target.value, subcategory: '' });
                        }}
                        className={`${inputClass(Boolean(productFieldErrors.categorySlug))} font-bold`}
                      >
                        <option value="">Select a category…</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <FormField
                    label="Subcategory"
                    htmlFor="prod-subcategory"
                    error={productFieldErrors.subcategory}
                    hint={
                      subcategoryOptions.length > 0
                        ? 'Pick one of the category’s existing subcategories, or type a new one.'
                        : 'Optional — a finer grouping inside the category, e.g. “Gaming Laptops”.'
                    }
                  >
                    <input
                      id="prod-subcategory"
                      type="text"
                      list="prod-subcategory-options"
                      value={prodForm.subcategory}
                      onChange={(e) => {
                        clearProductFieldError('subcategory');
                        patchProdForm({ subcategory: e.target.value });
                      }}
                      maxLength={120}
                      disabled={!prodForm.categorySlug}
                      placeholder={prodForm.categorySlug ? 'Gaming Laptops' : 'Choose a category first'}
                      className={`${inputClass(Boolean(productFieldErrors.subcategory))} disabled:bg-gray-50 disabled:text-gray-400`}
                    />
                    <datalist id="prod-subcategory-options">
                      {subcategoryOptions.map((sub) => (
                        <option key={sub} value={sub} />
                      ))}
                    </datalist>
                  </FormField>

                  {/* SKU — NOT NULL behind a unique index, suggested from brand + title */}
                  <FormField
                    label="SKU"
                    htmlFor="prod-sku"
                    required
                    error={productFieldErrors.sku}
                    hint={
                      editingProduct
                        ? 'Changing this affects stock records and future order lines — past invoices keep the SKU they were printed with.'
                        : 'Generated from brand + title — edit if you use your own scheme. Must be unique across the catalog.'
                    }
                  >
                    <div className="relative">
                      <input
                        id="prod-sku"
                        type="text"
                        value={skuValue}
                        onChange={(e) => {
                          setIsSkuEdited(true);
                          clearProductFieldError('sku');
                          patchProdForm({ sku: e.target.value.toUpperCase() });
                        }}
                        maxLength={SKU_MAX_LENGTH}
                        spellCheck={false}
                        autoCapitalize="characters"
                        aria-invalid={productFieldErrors.sku ? true : undefined}
                        placeholder="LEN-LEGION-PRO-5"
                        className={`${inputClass(Boolean(productFieldErrors.sku))} pr-16 font-mono font-bold tracking-wide`}
                      />
                      {!isSkuEdited && skuValue && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-blue-50 text-[#0056b3] border border-blue-100 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none">
                          auto
                        </span>
                      )}
                      {isSkuEdited && !editingProduct && suggestedSku && suggestedSku !== skuValue.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSkuEdited(false);
                            clearProductFieldError('sku');
                            patchProdForm({ sku: '' });
                          }}
                          title={`Go back to the suggested ${suggestedSku}`}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-gray-500 hover:text-[#0056b3] border border-gray-200 hover:border-blue-200 px-1.5 py-0.5 rounded-md bg-white"
                        >
                          reset
                        </button>
                      )}
                    </div>
                  </FormField>

                  {/* Merchandising flags — every one of these is a real column the
                      storefront reads, so they belong with the basics. */}
                  <div>
                    <p className="font-bold text-gray-700 mb-1.5">Merchandising</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <ToggleRow
                        label="Featured"
                        description="Shown in the featured rail on the home page."
                        checked={prodForm.isFeatured}
                        onChange={(v) => patchProdForm({ isFeatured: v })}
                      />
                      <ToggleRow
                        label="New arrival"
                        description="Carries the “New” badge on the shop grid."
                        checked={prodForm.isNewArrival}
                        onChange={(v) => patchProdForm({ isNewArrival: v })}
                      />
                      <ToggleRow
                        label="Best seller"
                        description="Listed under the best-sellers filter."
                        checked={prodForm.isBestSeller}
                        onChange={(v) => patchProdForm({ isBestSeller: v })}
                      />
                      <ToggleRow
                        label="Trending"
                        description="Surfaced in the trending-now section."
                        checked={prodForm.isTrending}
                        onChange={(v) => patchProdForm({ isTrending: v })}
                      />
                      <ToggleRow
                        label="Deal of the day"
                        description="Pinned to the daily-deal slot on the home page."
                        checked={prodForm.isDealOfDay}
                        onChange={(v) => patchProdForm({ isDealOfDay: v })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ================================================ IMAGES */}
              {activeProductTab === 'images' && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-700">Gallery</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Row order is gallery order. The starred row is the thumbnail used
                        everywhere the product is listed.
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      <UploadButton
                        purpose="product"
                        multiple
                        onUploaded={(urls) => {
                          clearProductFieldError('images');
                          appendImageRows(urls);
                        }}
                        title="Upload one or more images"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload images</span>
                      </UploadButton>
                      <button
                        type="button"
                        onClick={addImageRow}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add URL</span>
                      </button>
                    </div>
                  </div>

                  {productFieldErrors.images && (
                    <p role="alert" className="text-[11px] text-rose-600 font-bold">
                      {productFieldErrors.images}
                    </p>
                  )}

                  <div className="space-y-2.5">
                    {imageRows.map((row, index) => {
                      const rowError = productFieldErrors[`image:${row.key}`];
                      const isPrimary = primaryImageRow?.key === row.key;
                      return (
                        <div
                          key={row.key}
                          className={`rounded-xl border p-3 ${rowError ? 'border-rose-300 bg-rose-50/40' : 'border-gray-200'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-14 h-14 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                              {row.url.trim() ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={row.url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.visibility = 'hidden';
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-gray-300" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="url"
                                  value={row.url}
                                  onChange={(e) => {
                                    clearProductFieldError(`image:${row.key}`);
                                    clearProductFieldError('images');
                                    patchImageRow(row.key, { url: e.target.value });
                                  }}
                                  placeholder="Upload a file, or paste an image URL"
                                  className={`${inputClass(Boolean(rowError))} font-mono text-[11px]`}
                                />
                                <UploadButton
                                  purpose="product"
                                  onUploaded={([url]) => {
                                    clearProductFieldError(`image:${row.key}`);
                                    clearProductFieldError('images');
                                    patchImageRow(row.key, { url });
                                  }}
                                  title="Upload a file for this row"
                                  className="flex-shrink-0 p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                                />
                              </div>
                              <input
                                type="text"
                                value={row.altText}
                                onChange={(e) => patchImageRow(row.key, { altText: e.target.value })}
                                maxLength={200}
                                placeholder="Alt text — describes the image for screen readers and search"
                                className={inputClass()}
                              />
                            </div>

                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setPrimaryImageKey(row.key)}
                                title={isPrimary ? 'This is the thumbnail' : 'Use as the thumbnail'}
                                aria-pressed={isPrimary}
                                className={`p-1.5 rounded-lg border transition-colors ${isPrimary
                                  ? 'border-amber-200 bg-amber-50 text-amber-500'
                                  : 'border-gray-200 text-gray-300 hover:text-amber-400'
                                  }`}
                              >
                                <Star className={`w-3.5 h-3.5 ${isPrimary ? 'fill-current' : ''}`} />
                              </button>
                              <div className="flex gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => moveImageRow(row.key, -1)}
                                  disabled={index === 0}
                                  title="Move up"
                                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveImageRow(row.key, 1)}
                                  disabled={index === imageRows.length - 1}
                                  title="Move down"
                                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  clearProductFieldError(`image:${row.key}`);
                                  removeImageRow(row.key);
                                }}
                                title="Remove this image"
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {rowError && (
                            <p role="alert" className="text-[11px] text-rose-600 font-bold mt-2">
                              {rowError}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {imageRows.length === 0 && (
                      <p className="text-[11px] text-gray-500 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                        No images yet. The shop grid and the product page both render the
                        primary image, so at least one is required.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ======================================== PRICING & STOCK */}
              {activeProductTab === 'pricing' && (
                <>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <FormField
                      label="Selling price"
                      htmlFor="prod-selling-price"
                      required
                      error={productFieldErrors.sellingPrice}
                      hint="What the customer is charged."
                    >
                      <input
                        id="prod-selling-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={prodForm.sellingPrice}
                        onChange={(e) => {
                          clearProductFieldError('sellingPrice');
                          patchProdForm({ sellingPrice: e.target.value });
                        }}
                        placeholder="184999"
                        className={`${inputClass(Boolean(productFieldErrors.sellingPrice))} font-mono font-bold text-[#0056b3]`}
                      />
                    </FormField>

                    <FormField
                      label="MRP"
                      htmlFor="prod-mrp"
                      error={productFieldErrors.mrp}
                      hint="Struck-through list price. Leave blank for no discount badge."
                    >
                      <input
                        id="prod-mrp"
                        type="number"
                        min="0"
                        step="0.01"
                        value={prodForm.mrp}
                        onChange={(e) => {
                          clearProductFieldError('mrp');
                          patchProdForm({ mrp: e.target.value });
                        }}
                        placeholder="199999"
                        className={`${inputClass(Boolean(productFieldErrors.mrp))} font-mono`}
                      />
                    </FormField>

                    <FormField
                      label="Cost price"
                      htmlFor="prod-cost-price"
                      error={productFieldErrors.costPrice}
                      hint="Internal only — never shown to customers."
                    >
                      <input
                        id="prod-cost-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={prodForm.costPrice}
                        onChange={(e) => {
                          clearProductFieldError('costPrice');
                          patchProdForm({ costPrice: e.target.value });
                        }}
                        placeholder="152000"
                        className={`${inputClass(Boolean(productFieldErrors.costPrice))} font-mono`}
                      />
                    </FormField>
                  </div>

                  {/* Derived figures, so the pricing decision is made with the
                      margin visible rather than worked out afterwards. */}
                  <div className="flex flex-wrap gap-2">
                    {discountPercent > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-700">
                        <Percent className="w-3.5 h-3.5" />
                        {discountPercent}% off MRP — saves {npr(mrpNum - sellingPriceNum)}
                      </span>
                    )}
                    {marginPercent !== null && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-bold ${marginPercent <= 0
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : marginPercent < 10
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        {marginPercent}% margin — {npr(sellingPriceNum - costPriceNum)} per unit
                      </span>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField
                      label="Stock on hand"
                      htmlFor="prod-stock"
                      required
                      error={productFieldErrors.stockQuantity}
                      hint="Units available to sell right now."
                    >
                      <input
                        id="prod-stock"
                        type="number"
                        min="0"
                        step="1"
                        value={prodForm.stockQuantity}
                        onChange={(e) => {
                          clearProductFieldError('stockQuantity');
                          patchProdForm({ stockQuantity: e.target.value });
                        }}
                        className={`${inputClass(Boolean(productFieldErrors.stockQuantity))} font-mono`}
                      />
                    </FormField>

                    <FormField
                      label="Low-stock alert at"
                      htmlFor="prod-low-stock"
                      error={productFieldErrors.lowStockThreshold}
                      hint="At or below this count the product is flagged for reorder."
                    >
                      <input
                        id="prod-low-stock"
                        type="number"
                        min="0"
                        step="1"
                        value={prodForm.lowStockThreshold}
                        onChange={(e) => {
                          clearProductFieldError('lowStockThreshold');
                          patchProdForm({ lowStockThreshold: e.target.value });
                        }}
                        className={`${inputClass(Boolean(productFieldErrors.lowStockThreshold))} font-mono`}
                      />
                    </FormField>
                  </div>

                  <p className="flex items-start gap-2 text-[11px] text-gray-500 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                    <span>
                      The stock badge is derived from these two numbers on save — it is not a
                      separate field, so it can never disagree with the count.
                    </span>
                  </p>
                </>
              )}

              {/* ================================== SHIPPING & DELIVERY */}
              {activeProductTab === 'shipping' && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-700">Shipping & Delivery Configuration</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Configure physical parcel weight, volumetric dimensions, and rate overrides for accurate checkout fare calculation.
                      </p>
                    </div>
                  </div>

                  {/* Physical vs Digital toggle */}
                  <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
                    <ToggleRow
                      label="Physical Product (Requires Shipping)"
                      description="When enabled, this item requires physical delivery and checkout will calculate courier freight by weight and zone."
                      checked={prodForm.isPhysicalProduct}
                      onChange={(checked) => {
                        patchProdForm({
                          isPhysicalProduct: checked,
                          requiresShipping: checked,
                        });
                      }}
                    />

                    {!prodForm.isPhysicalProduct && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-blue-900 text-[11px]">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                        <div>
                          <p className="font-bold">Digital / Service Product</p>
                          <p className="text-blue-800 leading-relaxed mt-0.5">
                            This product will skip all shipping fee calculations at checkout. Ideal for software licenses, digital vouchers, and in-store service repairs.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {prodForm.isPhysicalProduct && (
                    <>
                      {/* Presets */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold">
                          Quick Presets (Fill weight & dimensions)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'Laptop', weight: '2.5', l: '38', w: '26', h: '3' },
                            { label: 'Smartphone', weight: '0.4', l: '18', w: '10', h: '5' },
                            { label: 'Monitor / TV', weight: '6.5', l: '60', w: '40', h: '15' },
                            { label: 'Accessory / Mouse', weight: '0.2', l: '12', w: '8', h: '4' },
                            { label: 'Desktop / Tower', weight: '11.0', l: '48', w: '42', h: '22' },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                clearProductFieldError('weightKg');
                                clearProductFieldError('lengthCm');
                                clearProductFieldError('widthCm');
                                clearProductFieldError('heightCm');
                                patchProdForm({
                                  weightKg: preset.weight,
                                  lengthCm: preset.l,
                                  widthCm: preset.w,
                                  heightCm: preset.h,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-blue-300 hover:text-[#0056b3] hover:bg-blue-50/30 transition-colors shadow-2xs"
                            >
                              <Box className="w-3 h-3 text-gray-400" />
                              <span>{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Weight & Dimensions */}
                      <div className="rounded-2xl border border-gray-200 p-4 bg-white space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            label="Actual Weight (kg)"
                            htmlFor="prod-weight-kg"
                            error={productFieldErrors.weightKg}
                            hint="Gross parcel weight in kilograms (e.g. 2.5 for 2500g)."
                          >
                            <div className="relative">
                              <input
                                id="prod-weight-kg"
                                type="number"
                                min="0"
                                step="0.01"
                                value={prodForm.weightKg}
                                onChange={(e) => {
                                  clearProductFieldError('weightKg');
                                  patchProdForm({ weightKg: e.target.value });
                                }}
                                placeholder="2.5"
                                className={`${inputClass(Boolean(productFieldErrors.weightKg))} font-mono pr-10`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                                kg
                              </span>
                            </div>
                          </FormField>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700">
                              Package Dimensions (L × W × H in cm)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={prodForm.lengthCm}
                                  onChange={(e) => {
                                    clearProductFieldError('lengthCm');
                                    patchProdForm({ lengthCm: e.target.value });
                                  }}
                                  placeholder="L (cm)"
                                  title="Length in cm"
                                  className={`${inputClass(Boolean(productFieldErrors.lengthCm))} font-mono text-center text-xs px-1`}
                                />
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={prodForm.widthCm}
                                  onChange={(e) => {
                                    clearProductFieldError('widthCm');
                                    patchProdForm({ widthCm: e.target.value });
                                  }}
                                  placeholder="W (cm)"
                                  title="Width in cm"
                                  className={`${inputClass(Boolean(productFieldErrors.widthCm))} font-mono text-center text-xs px-1`}
                                />
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={prodForm.heightCm}
                                  onChange={(e) => {
                                    clearProductFieldError('heightCm');
                                    patchProdForm({ heightCm: e.target.value });
                                  }}
                                  placeholder="H (cm)"
                                  title="Height in cm"
                                  className={`${inputClass(Boolean(productFieldErrors.heightCm))} font-mono text-center text-xs px-1`}
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-500">
                              Used for volumetric air/road weight calculation (IATA divisor 5000).
                            </p>
                          </div>
                        </div>

                        {/* Volumetric calculation chip */}
                        {(() => {
                          const actW = Number(prodForm.weightKg) || 0;
                          const l = Number(prodForm.lengthCm) || 0;
                          const w = Number(prodForm.widthCm) || 0;
                          const h = Number(prodForm.heightCm) || 0;
                          const volW = l > 0 && w > 0 && h > 0 ? (l * w * h) / 5000 : 0;
                          const chgW = Math.max(actW, volW);

                          if (actW === 0 && volW === 0) return null;

                          return (
                            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <Scale className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                <div>
                                  <span className="text-gray-600">Volumetric: </span>
                                  <span className="font-mono font-bold text-gray-900">
                                    {volW > 0 ? `${volW.toFixed(2)} kg` : '—'}
                                  </span>
                                  <span className="text-gray-400 mx-1.5">|</span>
                                  <span className="text-gray-600">Actual: </span>
                                  <span className="font-mono font-bold text-gray-900">
                                    {actW > 0 ? `${actW.toFixed(2)} kg` : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] w-fit shadow-xs">
                                <span>Chargeable Weight:</span>
                                <span className="font-mono">{chgW.toFixed(2)} kg</span>
                                {volW > actW && actW > 0 && (
                                  <span className="text-[9px] bg-blue-800 text-blue-100 px-1 py-0.5 rounded font-normal ml-1">
                                    Volumetric applied
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Overrides: Free Shipping & Fixed Fee */}
                      <div className="rounded-2xl border border-gray-200 p-4 bg-white space-y-4">
                        <p className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                          Shipping Charge Overrides
                        </p>

                        <ToggleRow
                          label="Free Shipping"
                          description="When enabled, delivery charges for this product are 100% waived across all delivery zones."
                          checked={prodForm.isFreeShipping}
                          onChange={(checked) => patchProdForm({ isFreeShipping: checked })}
                        />

                        {!prodForm.isFreeShipping && (
                          <div className="pt-2 border-t border-gray-100">
                            <FormField
                              label="Fixed Shipping Fee (Optional Flat Rate)"
                              htmlFor="prod-fixed-shipping"
                              error={productFieldErrors.fixedShippingFee}
                              hint="Leave blank to use dynamic weight/zone tariff. If set, this exact NPR amount will be charged regardless of distance/weight."
                            >
                              <div className="relative max-w-xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                                  NPR
                                </span>
                                <input
                                  id="prod-fixed-shipping"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={prodForm.fixedShippingFee}
                                  onChange={(e) => {
                                    clearProductFieldError('fixedShippingFee');
                                    patchProdForm({ fixedShippingFee: e.target.value });
                                  }}
                                  placeholder="e.g. 150"
                                  className={`${inputClass(Boolean(productFieldErrors.fixedShippingFee))} font-mono pl-12`}
                                />
                              </div>
                            </FormField>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ======================================== SPECIFICATIONS */}
              {activeProductTab === 'specs' && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-700">Specification sheet</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Rendered as the spec table on the product page, in this order.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addSpecRow()}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add row</span>
                    </button>
                  </div>

                  {/* One tap per common key beats typing "Processor" on every laptop. */}
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SPEC_KEYS.filter(
                      (key) => !specRows.some((row) => row.specKey.trim().toLowerCase() === key.toLowerCase()),
                    ).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => addSpecRow(key)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-gray-600 hover:border-blue-200 hover:text-[#0056b3]"
                      >
                        <Plus className="w-3 h-3" />
                        {key}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {specRows.map((row) => {
                      const rowError = productFieldErrors[`spec:${row.key}`];
                      return (
                        <div key={row.key}>
                          <div className="flex items-start gap-2">
                            <input
                              type="text"
                              value={row.specKey}
                              onChange={(e) => {
                                clearProductFieldError(`spec:${row.key}`);
                                patchSpecRow(row.key, { specKey: e.target.value });
                              }}
                              maxLength={100}
                              placeholder="Processor"
                              className={`${inputClass(Boolean(rowError))} sm:max-w-[200px] font-bold`}
                            />
                            <input
                              type="text"
                              value={row.specValue}
                              onChange={(e) => {
                                clearProductFieldError(`spec:${row.key}`);
                                patchSpecRow(row.key, { specValue: e.target.value });
                              }}
                              maxLength={300}
                              placeholder="Intel Core i7-14650HX, 16 cores"
                              className={inputClass(Boolean(rowError))}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                clearProductFieldError(`spec:${row.key}`);
                                removeSpecRow(row.key);
                              }}
                              title="Remove this row"
                              className="flex-shrink-0 p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {rowError && (
                            <p role="alert" className="text-[11px] text-rose-600 font-bold mt-1">
                              {rowError}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {specRows.length === 0 && (
                      <p className="text-[11px] text-gray-500 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                        No specifications yet. Products without a spec sheet are noticeably
                        harder to compare.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* =============================== DESCRIPTION & WARRANTY */}
              {activeProductTab === 'content' && (
                <>
                  <FormField
                    label="Short description"
                    htmlFor="prod-short-desc"
                    hint={
                      <span className="flex items-center justify-between gap-2">
                        <span>The one-line summary under the title on the shop grid.</span>
                        <CharCount value={prodForm.shortDescription} max={500} />
                      </span>
                    }
                  >
                    <textarea
                      id="prod-short-desc"
                      value={prodForm.shortDescription}
                      onChange={(e) => patchProdForm({ shortDescription: e.target.value })}
                      maxLength={500}
                      rows={2}
                      placeholder="Intel Core i7 14th Gen · RTX 4060 · 16GB DDR5 · 1TB NVMe SSD · 240Hz WQXGA"
                      className={inputClass()}
                    />
                  </FormField>

                  <FormField
                    label="Full description"
                    htmlFor="prod-desc"
                    hint="The long-form copy on the product page. Plain text; line breaks are kept."
                  >
                    <textarea
                      id="prod-desc"
                      value={prodForm.description}
                      onChange={(e) => patchProdForm({ description: e.target.value })}
                      rows={6}
                      className={inputClass()}
                    />
                  </FormField>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField
                      label="Key features"
                      htmlFor="prod-features"
                      hint="One per line — rendered as the bullet list."
                    >
                      <textarea
                        id="prod-features"
                        value={prodForm.featuresText}
                        onChange={(e) => patchProdForm({ featuresText: e.target.value })}
                        rows={5}
                        placeholder={'240Hz WQXGA display\nRTX 4060 8GB graphics\nPer-key RGB keyboard'}
                        className={inputClass()}
                      />
                    </FormField>

                    <FormField
                      label="What’s in the box"
                      htmlFor="prod-box"
                      hint="One per line — shown under the spec sheet."
                    >
                      <textarea
                        id="prod-box"
                        value={prodForm.boxContentsText}
                        onChange={(e) => patchProdForm({ boxContentsText: e.target.value })}
                        rows={5}
                        placeholder={'Laptop\n300W power adapter\nWarranty card\nUser manual'}
                        className={inputClass()}
                      />
                    </FormField>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField
                      label="Warranty length (months)"
                      htmlFor="prod-warranty-months"
                      error={productFieldErrors.warrantyMonths}
                      hint="0 for no warranty."
                    >
                      <input
                        id="prod-warranty-months"
                        type="number"
                        min="0"
                        max="240"
                        step="1"
                        value={prodForm.warrantyMonths}
                        onChange={(e) => {
                          clearProductFieldError('warrantyMonths');
                          patchProdForm({ warrantyMonths: e.target.value });
                        }}
                        className={`${inputClass(Boolean(productFieldErrors.warrantyMonths))} font-mono`}
                      />
                    </FormField>

                    <FormField label="Warranty type" htmlFor="prod-warranty-type">
                      <select
                        id="prod-warranty-type"
                        value={prodForm.warrantyType}
                        onChange={(e) => patchProdForm({ warrantyType: e.target.value })}
                        className={inputClass()}
                      >
                        {WARRANTY_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <FormField
                    label="Warranty note"
                    htmlFor="prod-warranty-text"
                    hint={
                      <span className="flex items-center justify-between gap-2">
                        <span>The exact wording shown on the product page.</span>
                        <CharCount value={prodForm.warrantyText} max={250} />
                      </span>
                    }
                  >
                    <input
                      id="prod-warranty-text"
                      type="text"
                      value={prodForm.warrantyText}
                      onChange={(e) => patchProdForm({ warrantyText: e.target.value })}
                      maxLength={250}
                      placeholder="2 Years Lenovo Official Nepal Warranty + 1 Year ADP"
                      className={inputClass()}
                    />
                  </FormField>

                  <FormField label="Search tags" hint="Extra words customers might search by.">
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-white min-h-[42px]">
                      {prodForm.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-100 px-2 py-1 font-semibold text-[#0056b3]"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            aria-label={`Remove ${tag}`}
                            className="text-blue-300 hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      {isAddingTag ? (
                        <input
                          autoFocus
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onBlur={handleAddTag}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              // Otherwise Enter submits the form and saves the product.
                              e.preventDefault();
                              handleAddTag();
                            } else if (e.key === 'Escape') {
                              setNewTagInput('');
                              setIsAddingTag(false);
                            }
                          }}
                          placeholder="gaming laptop"
                          className="flex-1 min-w-[120px] px-1 py-0.5 outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingTag(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2 py-1 font-semibold text-gray-500 hover:border-blue-300 hover:text-[#0056b3]"
                        >
                          <Plus className="w-3 h-3" />
                          Add tag
                        </button>
                      )}
                    </div>
                  </FormField>
                </>
              )}

              {/* =================================================== SEO */}
              {activeProductTab === 'seo' && (
                <>
                  <FormField
                    label="Product URL"
                    htmlFor="prod-slug"
                    required
                    error={productFieldErrors.slug}
                    hint={
                      editingProduct
                        ? 'This product is already published under this URL — changing it breaks existing links.'
                        : 'Derived from the title until you type your own.'
                    }
                  >
                    <div className="flex items-stretch">
                      <span className="inline-flex items-center rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 px-2.5 font-mono text-[11px] text-gray-500">
                        /product/
                      </span>
                      <input
                        id="prod-slug"
                        type="text"
                        value={slugValue}
                        onChange={(e) => {
                          setIsSlugEdited(true);
                          clearProductFieldError('slug');
                          patchProdForm({ slug: e.target.value });
                        }}
                        onBlur={(e) => patchProdForm({ slug: slugify(e.target.value) })}
                        maxLength={220}
                        spellCheck={false}
                        className={`${inputClass(Boolean(productFieldErrors.slug))} rounded-l-none font-mono`}
                      />
                    </div>
                  </FormField>

                  <FormField
                    label="Meta title"
                    htmlFor="prod-meta-title"
                    error={productFieldErrors.metaTitle}
                    hint={
                      <span className="flex items-center justify-between gap-2">
                        <span>Falls back to the product title when blank.</span>
                        <CharCount value={prodForm.metaTitle} max={200} />
                      </span>
                    }
                  >
                    <input
                      id="prod-meta-title"
                      type="text"
                      value={prodForm.metaTitle}
                      onChange={(e) => {
                        clearProductFieldError('metaTitle');
                        patchProdForm({ metaTitle: e.target.value });
                      }}
                      maxLength={200}
                      placeholder={prodForm.name || 'Lenovo Legion Pro 5 — ICE Computers Nepal'}
                      className={inputClass(Boolean(productFieldErrors.metaTitle))}
                    />
                  </FormField>

                  <FormField
                    label="Meta description"
                    htmlFor="prod-meta-desc"
                    error={productFieldErrors.metaDescription}
                    hint={
                      <span className="flex items-center justify-between gap-2">
                        <span>The grey text under the link in search results.</span>
                        <CharCount value={prodForm.metaDescription} max={500} />
                      </span>
                    }
                  >
                    <textarea
                      id="prod-meta-desc"
                      value={prodForm.metaDescription}
                      onChange={(e) => {
                        clearProductFieldError('metaDescription');
                        patchProdForm({ metaDescription: e.target.value });
                      }}
                      maxLength={500}
                      rows={3}
                      placeholder={prodForm.shortDescription || 'Buy the Lenovo Legion Pro 5 in Nepal with official warranty and free Kailali delivery.'}
                      className={inputClass(Boolean(productFieldErrors.metaDescription))}
                    />
                  </FormField>

                  {/* A search result is what most customers see first, so show it. */}
                  <div className="rounded-xl border border-gray-200 p-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
                      Search result preview
                    </p>
                    <p className="font-mono text-[11px] text-emerald-700 truncate">
                      icecomputers.com.np › product › {slugValue || 'product-url'}
                    </p>
                    <p className="text-[15px] text-[#1a0dab] leading-snug truncate">
                      {prodForm.metaTitle || prodForm.name || 'Product title'}
                    </p>
                    <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">
                      {prodForm.metaDescription ||
                        prodForm.shortDescription ||
                        'Add a meta description so search engines show your own wording rather than picking a sentence at random.'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* -------------------------------------------- live preview */}
            <aside className="hidden lg:block">
              <div className="sticky top-0 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  Live preview
                </p>

                <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                    {previewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImage}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <div className="text-center px-4">
                        <ImageIcon className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                        <p className="text-[10px] text-gray-400">No image yet</p>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 font-bold truncate">
                      {selectedBrandName || 'Brand'}
                    </p>
                    <p className="font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.4em]">
                      {prodForm.name || 'Product title'}
                    </p>

                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[#0056b3]">
                        {sellingPriceNum > 0 ? npr(sellingPriceNum) : 'NPR —'}
                      </span>
                      {discountPercent > 0 && (
                        <>
                          <span className="font-mono text-[11px] text-gray-400 line-through">
                            {npr(mrpNum)}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-rose-600">
                            -{discountPercent}%
                          </span>
                        </>
                      )}
                    </div>

                    <span
                      className={`inline-block rounded-lg border px-2 py-1 font-bold text-[10px] ${stockStatusLabel.tone}`}
                    >
                      {stockStatusLabel.text}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Images</span>
                    <span className="font-bold text-gray-800">{filledImageRows.length}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Specifications</span>
                    <span className="font-bold text-gray-800">{filledSpecRows.length}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Margin</span>
                    <span className="font-bold text-gray-800">
                      {marginPercent === null ? 'No cost price' : `${marginPercent}%`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Shipping</span>
                    <span className="font-bold text-gray-800">
                      {!prodForm.isPhysicalProduct
                        ? 'Digital (Free)'
                        : prodForm.isFreeShipping
                          ? 'Free Shipping'
                          : prodForm.fixedShippingFee.trim()
                            ? `${npr(Number(prodForm.fixedShippingFee))} Flat`
                            : prodForm.weightKg.trim()
                              ? `${prodForm.weightKg} kg`
                              : 'Standard'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Visibility</span>
                    <span className="font-bold text-gray-800">
                      {publishStates.find((s) => s.value === prodForm.status)?.label ?? prodForm.status}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* ---------------------------------------------------- footer */}
          <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-4 border-t border-gray-200 bg-white rounded-b-3xl">
            <p className="text-[11px] text-gray-500 max-w-xs">
              {prodForm.status === 'active'
                ? 'Publishing makes this orderable on the storefront immediately.'
                : 'A draft is saved to the catalog but stays hidden from customers.'}
            </p>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={closeProductModal}
                disabled={isSavingProduct}
                className="px-5 py-2.5 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>

              {/* Only when the loaded product is paused or archived: saving it
                  through either of the two buttons below would silently change
                  its visibility, which is not what "save" should mean. */}
              {LOADED_ONLY_STATES[prodForm.status] && (
                <button
                  type="button"
                  onClick={() => void submitProduct(prodForm.status)}
                  disabled={isSavingProduct}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Keep {LOADED_ONLY_STATES[prodForm.status].label.toLowerCase()}
                </button>
              )}

              <button
                type="button"
                onClick={() => void submitProduct('draft')}
                disabled={isSavingProduct}
                className="px-5 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-800 hover:bg-gray-100 disabled:opacity-50"
              >
                Save as draft
              </button>

              <button
                type="button"
                onClick={() => void submitProduct('active')}
                disabled={isSavingProduct}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0056b3] text-white font-bold rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-60"
              >
                {isSavingProduct ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Publish to catalog</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
