'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { CATALOG_STATUS_BADGE } from './shared';
import { CatalogRegistries, type RegistrySubTab } from './catalog/CatalogRegistries';
import { Boxes, Download, Edit, Plus, Search, Trash2 } from 'lucide-react';

/**
 * Module 2 — the product catalogue, plus the four reference-data registries it
 * depends on.
 *
 * The registry tabs are not derived from the product list: they load their own rows
 * from `/api/categories?view=admin`, `/api/brands?view=admin`,
 * `/api/catalog/attributes` and `/api/catalog/filter-tags`. The storefront payloads
 * this module already holds publish a category or brand's *slug* as its `id` and
 * drop `isFeatured` entirely, so an edit form built on them would have no key to
 * address a row with and no way to see half the fields it edits.
 */
export interface CatalogModuleProps {
  products: Product[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setAuditProduct: (product: Product | null) => void;
  handleExportProductsCsv: () => void;
  handleOpenAddProduct: () => void;
  handleOpenEditProduct: (product: Product) => void;
  handleDeleteProduct: (productId: string, productName: string, permanent?: boolean) => void;
  handleSoftDeleteProduct?: (productId: string, productName: string) => void;
}

const SUB_TABS: Array<{ id: 'products' | RegistrySubTab; label: string }> = [
  { id: 'products', label: 'Products SKU Catalog' },
  { id: 'categories', label: 'Category Tree' },
  { id: 'brands', label: 'Brand Directory' },
  { id: 'attributes', label: 'Attributes & Specs' },
  { id: 'tags', label: 'Faceted Filter Tags' },
];

export const CatalogModule: React.FC<CatalogModuleProps> = ({
  products,
  searchQuery,
  setSearchQuery,
  setAuditProduct,
  handleExportProductsCsv,
  handleOpenAddProduct,
  handleOpenEditProduct,
  handleDeleteProduct,
  handleSoftDeleteProduct,
}) => {
  const [catalogSubTab, setCatalogSubTab] = useState<'products' | RegistrySubTab>('products');

  return (
    <div className="space-y-6">
      {/* Sub Tab Buttons */}
      <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCatalogSubTab(tab.id)}
            aria-pressed={catalogSubTab === tab.id}
            className={`px-4 py-2 rounded-xl border transition-colors whitespace-nowrap ${
              catalogSubTab === tab.id
                ? 'bg-[#0056b3] text-white border-[#0056b3]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-view: Products */}
      {catalogSubTab === 'products' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product name, brand, SKU..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0056b3] outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportProductsCsv}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Catalog CSV</span>
              </button>

              <button
                onClick={handleOpenAddProduct}
                className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider font-extrabold bg-gray-50/50">
                  <th className="py-3 px-3">Item Photo</th>
                  <th className="py-3 px-3">Product Name &amp; SKU</th>
                  <th className="py-3 px-3">Brand</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Selling Price</th>
                  <th className="py-3 px-3">Stock Units</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {products
                  .filter((p) => {
                    // The placeholder above offers SKU search, so it has to
                    // actually look there.
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.brand.toLowerCase().includes(q) ||
                      (p.sku ?? '').toLowerCase().includes(q)
                    );
                  })
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-contain rounded-lg border bg-white p-0.5" />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        {/* The column is "Name & SKU" — show the SKU, not the row id. */}
                        {p.sku ? (
                          <div className="text-[10px] text-gray-500 font-mono font-bold">{p.sku}</div>
                        ) : (
                          <div className="text-[10px] text-amber-600 font-mono font-bold" title="This product has no SKU — add one before stocking or selling it.">
                            no SKU
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{p.brand}</td>
                      <td className="py-2.5 px-3 capitalize">{p.category.replace('-', ' ')}</td>
                      <td className="py-2.5 px-3 font-bold text-[#0056b3]">NPR {p.sellingPrice.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        {/* The product's own threshold, not a fixed 3 — that is the
                            number the form writes and the reorder report reads. */}
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          p.stockQuantity <= 0
                            ? 'bg-rose-100 text-rose-800'
                            : p.stockQuantity <= (p.lowStockThreshold ?? 5)
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {p.stockQuantity} in stock
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          CATALOG_STATUS_BADGE[p.status ?? 'active'].tone
                        }`}>
                          {CATALOG_STATUS_BADGE[p.status ?? 'active'].label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setAuditProduct(p)}
                            title="Adjust Stock"
                            className="p-1.5 hover:bg-blue-50 text-[#0056b3] rounded-lg transition-colors"
                          >
                            <Boxes className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            title="Edit Product"
                            className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => (handleDeleteProduct ? handleDeleteProduct(p.id, p.name, true) : handleSoftDeleteProduct?.(p.id, p.name))}
                            title="Delete Product Permanently"
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-views: the four reference-data registries.
          They own their own fetch, their own modals and their own error states —
          nothing here is derived from the product list above. */}
      {catalogSubTab !== 'products' && <CatalogRegistries subTab={catalogSubTab} />}
    </div>
  );
};
