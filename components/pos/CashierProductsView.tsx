'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  Barcode,
  ShoppingBag,
  Info,
  Check,
  Tag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
} from 'lucide-react';
import { ProductItem } from './CounterPosTerminal';
import { formatNepaliNumber } from '@/lib/nepal/money';

interface CashierProductsViewProps {
  products: ProductItem[];
  theme: 'dark' | 'light';
  onAddToCart: (product: ProductItem) => void;
  onSwitchToSales: () => void;
}

export default function CashierProductsView({
  products,
  theme,
  onAddToCart,
  onSwitchToSales,
}: CashierProductsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK'>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Filter products
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.categoryName !== selectedCategory) {
        return false;
      }
      if (stockFilter === 'IN_STOCK' && p.stockQuantity <= 0) {
        return false;
      }
      if (stockFilter === 'LOW_STOCK' && (p.stockQuantity <= 0 || p.stockQuantity > (p.lowStockThreshold || 3))) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(q);
        const matchBrand = (p.brandName || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBarcode && !matchBrand) return false;
      }
      return true;
    });
  }, [products, selectedCategory, stockFilter, search]);

  const handleAddAndProceed = (prod: ProductItem) => {
    onAddToCart(prod);
    onSwitchToSales();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8faf9] dark:bg-[#0c120f] overflow-hidden p-6 space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              Read-Only Inventory
            </span>
            <span className="text-xs font-bold text-slate-400">
              {filtered.length} products found
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-1 tracking-tight">
            Product Catalog &amp; Stock Lookup
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Search retail inventory, check serial tracking, verify warranty, and add items to active sale.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, barcode..."
            className="w-full pl-9 pr-8 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:bg-white transition"
          />
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {categories.slice(0, 10).map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#00c569] text-white shadow-sm'
                    : 'bg-white dark:bg-[#141a17] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

        {/* Stock Filter Buttons */}
        <div className="flex items-center gap-1">
          {(['ALL', 'IN_STOCK', 'LOW_STOCK'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStockFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                stockFilter === s
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {s === 'ALL' ? 'All Stock' : s === 'IN_STOCK' ? 'In Stock Only' : 'Low Stock'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Products Grid (NO ADD PRODUCT CARD ALLOWED!) */}
      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pr-1">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-xs text-slate-400">
            No products match the filter. Try clearing the search.
          </div>
        ) : (
          filtered.map((prod) => {
            const isOut = prod.stockQuantity <= 0;
            const isLow = !isOut && prod.stockQuantity <= (prod.lowStockThreshold || 3);

            return (
              <div
                key={prod.id}
                onClick={() => setSelectedProduct(prod)}
                className={`flex flex-col justify-between p-4 rounded-3xl border bg-white dark:bg-[#141a17] transition cursor-pointer hover:shadow-md hover:border-emerald-500/70 group ${
                  isOut ? 'opacity-60 border-slate-200 dark:border-slate-800' : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Top Image / Fallback Container */}
                  <div className="relative w-full h-32 rounded-2xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden mb-3 p-2 border border-slate-100 dark:border-slate-800/80">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="text-3xl select-none group-hover:scale-110 transition">💻</div>
                    )}

                    {/* Stock Pill */}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        isOut
                          ? 'bg-rose-500 text-white'
                          : isLow
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : `Qty: ${prod.stockQuantity}`}
                    </span>

                    {/* Warranty Badge */}
                    {prod.warrantyMonths && prod.warrantyMonths > 0 ? (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-slate-800/80 text-white text-[9px] font-bold">
                        {prod.warrantyMonths}M Warranty
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[10px] font-mono font-bold text-slate-400 block truncate">
                    SKU: {prod.sku}
                  </span>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 mt-0.5 leading-snug">
                    {prod.name}
                  </h4>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block">Retail Price</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      Rs. {formatNepaliNumber(String(prod.price))}
                    </span>
                  </div>

                  {!isOut && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddAndProceed(prod);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                      title="Add to current order"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>Sale</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Product Details Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  SKU: {selectedProduct.sku}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Category</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedProduct.categoryName || 'Standard'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Barcode</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {selectedProduct.barcode || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Available Stock</span>
                <span className="font-bold text-emerald-600">
                  {selectedProduct.stockQuantity} Units
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Retail Price</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  Rs. {formatNepaliNumber(String(selectedProduct.price))}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Official Warranty</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedProduct.warrantyMonths ? `${selectedProduct.warrantyMonths} Months Hardware Warranty` : 'Store Checking'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 font-semibold">Serial Tracking</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedProduct.isSerialized ? 'Required at Checkout' : 'Not Serialized'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
              {selectedProduct.stockQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleAddAndProceed(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Add to Sale (F1)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
