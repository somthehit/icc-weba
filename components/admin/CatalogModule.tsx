'use client';

import React, { useMemo, useState } from 'react';
import { Product, type CategoryItem, type Brand } from '@/types';
import { CATALOG_STATUS_BADGE } from './shared';
import {
  Award,
  Boxes,
  Download,
  Edit,
  FolderTree,
  Plus,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';

/**
 * Module 2 — the product catalogue, plus the read-only category, brand,
 * attribute and tag views derived from it.
 */
export interface CatalogModuleProps {
  products: Product[];
  brands: Brand[];
  categories: CategoryItem[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setAuditProduct: (product: Product | null) => void;
  handleExportProductsCsv: () => void;
  handleOpenAddProduct: () => void;
  handleOpenEditProduct: (product: Product) => void;
  handleSoftDeleteProduct: (productId: string, productName: string) => void;
}

export const CatalogModule: React.FC<CatalogModuleProps> = ({
  products,
  brands,
  categories,
  searchQuery,
  setSearchQuery,
  setAuditProduct,
  handleExportProductsCsv,
  handleOpenAddProduct,
  handleOpenEditProduct,
  handleSoftDeleteProduct,
}) => {
  const [catalogSubTab, setCatalogSubTab] = useState<
    'products' | 'categories' | 'brands' | 'attributes' | 'tags'
  >('products');

  // Categories list — from the database, not a hardcoded copy. `CategoryItem.id`
  // is the slug (see `mapDbCategoryToCategoryItem`), which is what the product
  // rows carry, so the counts line up without a join.
  const categoriesList = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.id,
        parent: 'None',
        count: products.filter((p) => p.category === cat.id).length,
      })),
    [categories, products],
  );

  // Brands list — likewise from `/api/brands`, where `Brand.id` is the slug.
  // Products only carry the brand *name*, so the count matches on that.
  const brandsList = useMemo(
    () =>
      brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.id,
        logo: brand.logo,
        isPartner: brand.isPartner,
        count: products.filter((p) => p.brand.toLowerCase() === brand.name.toLowerCase()).length,
      })),
    [brands, products],
  );

  return (
    <div className="space-y-6">
      {/* Sub Tab Buttons */}
      <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
        <button
          onClick={() => setCatalogSubTab('products')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            catalogSubTab === 'products' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Products SKU Catalog
        </button>
        <button
          onClick={() => setCatalogSubTab('categories')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            catalogSubTab === 'categories' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Category Tree
        </button>
        <button
          onClick={() => setCatalogSubTab('brands')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            catalogSubTab === 'brands' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Brand Directory
        </button>
        <button
          onClick={() => setCatalogSubTab('attributes')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            catalogSubTab === 'attributes' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Attributes &amp; Specs
        </button>
        <button
          onClick={() => setCatalogSubTab('tags')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            catalogSubTab === 'tags' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Faceted Filter Tags
        </button>
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
                            onClick={() => handleSoftDeleteProduct(p.id, p.name)}
                            title="Discontinue Product"
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

      {/* Sub-view: Categories */}
      {catalogSubTab === 'categories' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Category Hierarchy &amp; Navigation Tree</h3>
            <button
              onClick={() => alert('New category dialog created.')}
              className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="space-y-3">
            {categoriesList.map((cat) => (
              <div key={cat.id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-[#0056b3]" />
                    <span>{cat.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Slug: <code className="bg-gray-200 px-1 py-0.5 rounded text-[11px]">{cat.slug}</code> &bull; {cat.count} active products assigned
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    Active Menu Item
                  </span>
                  <button
                    onClick={() => {
                      if (cat.count > 0) {
                        alert(`Cannot delete category "${cat.name}". It contains ${cat.count} products. Reassign or remove products first.`);
                      } else {
                        alert(`Category "${cat.name}" deleted.`);
                      }
                    }}
                    className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg border border-transparent hover:border-rose-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-view: Brands */}
      {catalogSubTab === 'brands' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Official Brand Partners Directory</h3>
            <button
              onClick={() => alert('Brand creation form opened.')}
              className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {brandsList.map((brand) => (
              <div key={brand.id} className="p-4 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-base text-gray-900">{brand.name}</span>
                  {brand.isPartner && <Award className="w-4 h-4 text-[#0056b3]" />}
                </div>
                <div className="text-xs text-gray-500">
                  {brand.count} {brand.count === 1 ? 'SKU' : 'SKUs'} in catalog
                </div>
                <div className="pt-2 border-t flex justify-between items-center text-xs">
                  {/* `brands.is_partner` — not every brand carried is an authorized
                      partner, and claiming it on all of them makes the badge worthless. */}
                  {brand.isPartner ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Authorized Partner
                    </span>
                  ) : (
                    <span className="text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded">
                      Stocked Brand
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (brand.count > 0) {
                        alert(`Cannot delete brand "${brand.name}". Contains ${brand.count} products.`);
                      } else {
                        alert(`Brand "${brand.name}" removed.`);
                      }
                    }}
                    className="text-rose-600 hover:underline font-bold text-[11px]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-view: Attributes & Specs */}
      {catalogSubTab === 'attributes' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="font-extrabold text-base text-[#1a1a1a]">Product Specifications &amp; Filter Attributes</h3>
              <p className="text-xs text-gray-500">Drives dynamic faceted shop filters automatically without code changes</p>
            </div>
            <button onClick={() => alert('Attribute key added.')} className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Attribute</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
              <div className="font-bold text-gray-900 text-sm">Processor Generation / CPU</div>
              <div className="text-gray-500">Scope: Computers &amp; Laptops &bull; Type: Select Filter &bull; Filterable: Yes</div>
            </div>
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
              <div className="font-bold text-gray-900 text-sm">System RAM Memory</div>
              <div className="text-gray-500">Scope: Computers &amp; Laptops &bull; Type: Select Filter &bull; Filterable: Yes</div>
            </div>
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
              <div className="font-bold text-gray-900 text-sm">CCTV Camera Resolution (Megapixels)</div>
              <div className="text-gray-500">Scope: CCTV &amp; Security &bull; Type: Number &bull; Filterable: Yes</div>
            </div>
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
              <div className="font-bold text-gray-900 text-sm">Printer Ink Type (Tank / Laser)</div>
              <div className="text-gray-500">Scope: Printers &amp; Scanners &bull; Type: Select Filter &bull; Filterable: Yes</div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view: Tags */}
      {catalogSubTab === 'tags' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Cross-Cutting Faceted Filter Tags</h3>
          <p className="text-xs text-gray-500">Tags enable custom cross-category filter pills like &quot;Gaming&quot;, &quot;Business&quot;, &quot;Student Pick&quot;, &quot;Hot Deal&quot;.</p>

          <div className="flex flex-wrap gap-2 pt-2">
            {['Core i5', 'Core i7', '16GB RAM', 'Gaming Laptop', 'Student Pick', 'Office Printer', 'IP Camera', '4K CCTV', 'Nepal Warranty'].map((t, idx) => (
              <span key={idx} className="bg-blue-50 text-[#0056b3] border border-blue-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>{t}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
