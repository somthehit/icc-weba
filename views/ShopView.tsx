'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import { ProductCard } from '@/components/ProductCard';
import { ProductCategory, FilterState } from '@/types';
import { 
  Filter, 
  Search, 
  SlidersHorizontal, 
  Grid, 
  List, 
  X, 
  ChevronDown, 
  Check, 
  RotateCcw 
} from 'lucide-react';

export const ShopView: React.FC = () => {
  const { products, categories, brands, searchQuery, setSearchQuery, navigateTo } = useStore();

  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: searchQuery || '',
    category: 'all',
    subcategory: 'all',
    brands: [],
    minPrice: 0,
    // 0 means "no cap" — the real ceiling depends on the catalogue, which is
    // still being fetched at first render.
    maxPrice: 0,
    inStockOnly: false,
    onSaleOnly: false,
    minRating: 0,
    sortBy: 'featured',
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const [visibleCount, setVisibleCount] = useState(9);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Effective search query derived from prop/store or local filter state
  const effectiveSearchQuery = searchQuery || filterState.searchQuery;

  // The slider bounds track the catalogue rather than a hardcoded 200k, which
  // used to make anything pricier than that unreachable from the shop.
  const PRICE_STEP = 5000;
  const priceCeiling = useMemo(() => {
    if (products.length === 0) return PRICE_STEP;
    const max = Math.max(...products.map((p) => p.sellingPrice));
    return Math.max(Math.ceil(max / PRICE_STEP) * PRICE_STEP, PRICE_STEP);
  }, [products]);
  /** The active cap: 0 in filterState means "everything". */
  const priceCap = filterState.maxPrice > 0 ? filterState.maxPrice : priceCeiling;

  const updateFilters = (updater: Partial<FilterState> | ((prev: FilterState) => FilterState)) => {
    setVisibleCount(9);
    setFilterState((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
  };

  // Apply filters and sorting
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const query = effectiveSearchQuery.trim().toLowerCase();
      if (query) {
        const nameMatch = p.name.toLowerCase().includes(query);
        const brandMatch = p.brand.toLowerCase().includes(query);
        const skuMatch = p.sku ? p.sku.toLowerCase().includes(query) : false;
        const descMatch = (p.shortDescription || '').toLowerCase().includes(query);
        const tagMatch = p.tags && p.tags.some((t) => t.toLowerCase().includes(query));
        if (!nameMatch && !brandMatch && !skuMatch && !descMatch && !tagMatch) {
          return false;
        }
      }

      // Category
      if (filterState.category !== 'all' && p.category !== filterState.category) {
        return false;
      }

      // Brand
      if (filterState.brands.length > 0 && !filterState.brands.includes(p.brand.toLowerCase())) {
        return false;
      }

      // Price
      if (p.sellingPrice < filterState.minPrice || p.sellingPrice > priceCap) {
        return false;
      }

      // Stock
      if (filterState.inStockOnly && !p.inStock) {
        return false;
      }

      // On Sale
      if (filterState.onSaleOnly && (p.discountPercent ?? 0) <= 0) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Date: Oldest first (earlier release / creation date)
      if (filterState.sortBy === 'oldest' || filterState.sortBy === 'date-asc') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.releaseDate ? new Date(a.releaseDate).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.releaseDate ? new Date(b.releaseDate).getTime() : 0);
        return timeA - timeB;
      }
      // Date: Newest first
      if (filterState.sortBy === 'newest' || filterState.sortBy === 'date-desc') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.releaseDate ? new Date(a.releaseDate).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.releaseDate ? new Date(b.releaseDate).getTime() : 0);
        if (timeA !== timeB) return timeB - timeA;
        return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
      }
      if (filterState.sortBy === 'price-low') return a.sellingPrice - b.sellingPrice;
      if (filterState.sortBy === 'price-high') return b.sellingPrice - a.sellingPrice;
      if (filterState.sortBy === 'rating') return b.rating - a.rating;
      if (filterState.sortBy === 'discount') return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      return 0; // featured
    });
  }, [products, filterState, effectiveSearchQuery, priceCap]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const hasMore = visibleCount < filteredProducts.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 6, filteredProducts.length));
      setIsLoadingMore(false);
    }, 200);
  };

  const handleShowAll = () => {
    setVisibleCount(filteredProducts.length);
  };

  const toggleBrandFilter = (brandName: string) => {
    const lower = brandName.toLowerCase();
    updateFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(lower)
        ? prev.brands.filter((b) => b !== lower)
        : [...prev.brands, lower],
    }));
  };

  const resetFilters = () => {
    updateFilters({
      searchQuery: '',
      category: 'all',
      subcategory: 'all',
      brands: [],
      minPrice: 0,
      maxPrice: 0,
      inStockOnly: false,
      onSaleOnly: false,
      minRating: 0,
      sortBy: 'featured',
    });
    setSearchQuery('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shop Technology & Electronics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Showing {filteredProducts.length} of {products.length} products with official Nepal warranty
          </p>
        </div>

        {/* Mobile Filter Trigger & View Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className="lg:hidden flex items-center gap-2 bg-slate-100 text-slate-800 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-300"
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <span>Filter Catalog</span>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium hidden sm:inline">Sort:</span>
            <select
              value={filterState.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value as any })}
              className="bg-white border border-slate-300 text-slate-900 text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer shadow-xs"
            >
              <option value="featured">Featured First</option>
              <option value="oldest">Date: Oldest First (Older Models)</option>
              <option value="newest">Date: Newest First (Latest Releases)</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="discount">Biggest Discount</option>
            </select>
          </div>

          {/* Grid / List View Toggle */}
          <div className="hidden sm:flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside
          className={`lg:block ${
            isMobileFilterOpen
              ? 'fixed inset-0 z-50 bg-white p-6 overflow-y-auto'
              : 'hidden'
          } bg-white p-5 rounded-2xl border border-slate-200 h-fit space-y-6 shadow-sm`}
        >
          {isMobileFilterOpen && (
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 lg:hidden">
              <h3 className="font-extrabold text-base text-slate-900">Filter Products</h3>
              <button onClick={() => setIsMobileFilterOpen(false)} className="p-1 text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Search Box */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">Search Catalog</label>
            <div className="relative">
              <input
                type="text"
                value={filterState.searchQuery}
                onChange={(e) => {
                  updateFilters({ searchQuery: e.target.value });
                  setSearchQuery(e.target.value);
                }}
                placeholder="Model, spec, brand..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-3 pr-8 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {filterState.searchQuery && (
                <button
                  onClick={() => {
                    updateFilters({ searchQuery: '' });
                    setSearchQuery('');
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">Category</label>
            <div className="space-y-1 text-xs">
              <button
                onClick={() => updateFilters({ category: 'all' })}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg font-medium transition-colors ${
                  filterState.category === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                All Categories ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => updateFilters({ category: cat.id })}
                  className={`w-full text-left py-1.5 px-2.5 rounded-lg font-medium transition-colors flex justify-between items-center ${
                    filterState.category === cat.id
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[10px] opacity-80">({cat.productCount})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Slider (NPR) */}
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-900 mb-2">
              <span>Price Range (NPR)</span>
              <span className="text-blue-700">Up to NPR {priceCap.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={PRICE_STEP}
              max={priceCeiling}
              step={PRICE_STEP}
              value={priceCap}
              onChange={(e) => updateFilters({ maxPrice: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
              <span>NPR {PRICE_STEP.toLocaleString()}</span>
              <span>NPR {priceCeiling.toLocaleString()}</span>
            </div>
          </div>

          {/* Brand Filter Checkboxes */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">Brands</label>
            <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
              {brands.map((brand) => {
                const isSelected = filterState.brands.includes(brand.name.toLowerCase());
                return (
                  <label
                    key={brand.id}
                    className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleBrandFilter(brand.name)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{brand.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Availability & Deals Toggles */}
          <div className="space-y-2 text-xs pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="checkbox"
                checked={filterState.inStockOnly}
                onChange={(e) => updateFilters({ inStockOnly: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>In Stock Only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="checkbox"
                checked={filterState.onSaleOnly}
                onChange={(e) => updateFilters({ onSaleOnly: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>On Sale / Discounted</span>
            </label>
          </div>

          {/* Reset Filters CTA */}
          <button
            onClick={resetFilters}
            className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </aside>

        {/* Product Grid Area */}
        <main className="lg:col-span-3 space-y-6">
          {/* Quick Sort & Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex-shrink-0">Quick View:</span>
            
            <button
              onClick={() => updateFilters({ sortBy: 'oldest' })}
              className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                filterState.sortBy === 'oldest'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Date: Older Models First</span>
            </button>

            <button
              onClick={() => updateFilters({ sortBy: 'newest' })}
              className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                filterState.sortBy === 'newest'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Latest Releases</span>
            </button>

            <button
              onClick={() => updateFilters({ sortBy: 'featured' })}
              className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                filterState.sortBy === 'featured'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Featured</span>
            </button>

            <button
              onClick={() => updateFilters({ onSaleOnly: !filterState.onSaleOnly })}
              className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                filterState.onSaleOnly
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Special Deals</span>
            </button>

            <button
              onClick={() => updateFilters({ inStockOnly: !filterState.inStockOnly })}
              className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                filterState.inStockOnly
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Ready in Stock</span>
            </button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4">
              <Search className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">No matching products found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try clearing your search query or adjusting price/category filters.
              </p>
              <button
                onClick={resetFilters}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow transition-colors"
              >
                Reset Catalog Filters
              </button>
            </div>
          ) : (
            <>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Load More & Pagination Controls */}
              <div className="pt-8 pb-4 border-t border-slate-200 flex flex-col items-center justify-center space-y-4">
                {/* Visual Progress Bar */}
                <div className="w-full max-w-xs text-center space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Showing {visibleProducts.length} of {filteredProducts.length} items</span>
                    <span>{Math.round((visibleProducts.length / filteredProducts.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(visibleProducts.length / filteredProducts.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                {hasMore ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-xs font-bold py-3 px-8 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isLoadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Loading More Products...</span>
                        </>
                      ) : (
                        <span>Load More Products (+{Math.min(6, filteredProducts.length - visibleCount)})</span>
                      )}
                    </button>

                    <button
                      onClick={handleShowAll}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 px-5 rounded-xl transition-colors cursor-pointer"
                    >
                      Show All ({filteredProducts.length})
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold py-2.5 px-6 rounded-full inline-flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>You have reached the end — all {filteredProducts.length} products loaded</span>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
