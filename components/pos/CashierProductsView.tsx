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
  Printer,
} from 'lucide-react';
import { ProductItem } from './CounterPosTerminal';
import { formatNepaliNumber } from '@/lib/nepal/money';
import ProductBarcodeLabelModal from './ProductBarcodeLabelModal';
import {
  format16DigitBarcode,
  generate16DigitBarcode,
  generate16DigitBarcodeSvg,
} from '@/lib/barcode/barcode16';

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
  const [barcodeLabelProduct, setBarcodeLabelProduct] = useState<ProductItem | null>(null);

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
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/70 overflow-hidden p-6 space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Read-Only Inventory
            </span>
            <span className="text-xs font-bold text-slate-500">
              {filtered.length} products found
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Product Catalog &amp; Stock Lookup
          </h1>
          <p className="text-xs text-slate-600 font-medium">
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
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition"
          />
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Category Tabs & Stock Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        {/* Horizontal Scroll Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.map((cat) => {
            const isSel = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition border ${
                  isSel
                    ? 'bg-[#00c569] text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            );
          })}
        </div>

        {/* Quick Stock Filters */}
        <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
          {(
            [
              { id: 'ALL', label: 'All Stock' },
              { id: 'IN_STOCK', label: 'In Stock Only' },
              { id: 'LOW_STOCK', label: 'Low Stock' },
            ] as const
          ).map((f) => {
            const isSel = stockFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStockFilter(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                  isSel
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Products Grid (Read-only catalog for cashier) */}
      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pr-1">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-xs text-slate-500 font-medium bg-white rounded-3xl border border-dashed border-slate-200">
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
                className={`flex flex-col justify-between p-4 rounded-3xl border bg-white transition cursor-pointer hover:shadow-md hover:border-emerald-500 group shadow-sm ${
                  isOut ? 'opacity-60 border-slate-200 bg-slate-50/50' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Top Image / Fallback Container */}
                  <div className="relative w-full h-32 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden mb-3 p-2 border border-slate-100">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="text-3xl select-none group-hover:scale-110 transition">💻</div>
                    )}

                    {/* Quick Print Label Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBarcodeLabelProduct(prod);
                      }}
                      className="absolute top-2 left-2 p-1.5 rounded-xl bg-white/95 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 shadow-sm border border-slate-200 transition z-10"
                      title="Print 16-Digit Barcode Label"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>

                    {/* Stock Pill */}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs ${
                        isOut
                          ? 'bg-rose-600 text-white'
                          : isLow
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : `Qty: ${prod.stockQuantity}`}
                    </span>

                    {/* Warranty Badge */}
                    {prod.warrantyMonths && prod.warrantyMonths > 0 ? (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[9px] font-bold backdrop-blur-xs">
                        {prod.warrantyMonths}M Warranty
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[10px] font-mono font-bold text-slate-500 block truncate">
                    SKU: {prod.sku}
                  </span>
                  <h4 className="text-xs font-black text-slate-900 line-clamp-2 mt-0.5 leading-snug group-hover:text-emerald-700 transition">
                    {prod.name}
                  </h4>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Retail Price</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">
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
                      className="px-3.5 py-1.5 rounded-xl bg-[#00c569] hover:bg-emerald-600 text-white text-xs font-black transition flex items-center gap-1 shadow-sm shadow-emerald-600/20"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-700">
                  SKU: {selectedProduct.sku}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  {selectedProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-semibold">Category</span>
                <span className="font-bold text-slate-900">
                  {selectedProduct.categoryName || 'Standard'}
                </span>
              </div>
              <div className="py-2 border-b border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-600 font-semibold flex items-center gap-1">
                    <Barcode className="h-3.5 w-3.5 text-emerald-600" />
                    16-Digit Barcode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeLabelProduct(selectedProduct);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200"
                  >
                    <Printer className="h-3 w-3" /> Print Label
                  </button>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs">
                  {format16DigitBarcode(
                    selectedProduct.barcode && /^\d{16}$/.test(selectedProduct.barcode.trim())
                      ? selectedProduct.barcode.trim()
                      : generate16DigitBarcode(selectedProduct.id || selectedProduct.sku)
                  )}
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-semibold">Available Stock</span>
                <span className="font-bold text-emerald-700">
                  {selectedProduct.stockQuantity} Units
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-semibold">Retail Price</span>
                <span className="font-mono font-black text-slate-950 text-sm">
                  Rs. {formatNepaliNumber(String(selectedProduct.price))}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-semibold">Official Warranty</span>
                <span className="font-bold text-slate-900">
                  {selectedProduct.warrantyMonths ? `${selectedProduct.warrantyMonths} Months Hardware Warranty` : 'Store Checking'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-600 font-semibold">Serial Tracking</span>
                <span className="font-bold text-slate-900">
                  {selectedProduct.isSerialized ? 'Required at Checkout' : 'Not Serialized'}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setBarcodeLabelProduct(selectedProduct);
                }}
                className="flex-1 py-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4 text-emerald-700" />
                <span>Print Label</span>
              </button>
              {selectedProduct.stockQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleAddAndProceed(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="flex-[1.5] py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Add to Sale (F1)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Barcode Label Thermal Printing Modal */}
      <ProductBarcodeLabelModal
        product={barcodeLabelProduct}
        isOpen={!!barcodeLabelProduct}
        onClose={() => setBarcodeLabelProduct(null)}
      />
    </div>
  );
}
