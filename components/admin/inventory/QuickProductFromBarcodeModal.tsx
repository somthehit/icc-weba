// components/admin/inventory/QuickProductFromBarcodeModal.tsx
// Quick modal to create a new product on-the-fly when an unknown barcode is scanned

'use client';

import React, { useState } from 'react';
import { Plus, X, Barcode, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface QuickProductFromBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onCreated: (product: any) => void;
}

export const QuickProductFromBarcodeModal: React.FC<QuickProductFromBarcodeModalProps> = ({
  isOpen,
  onClose,
  barcode,
  onCreated,
}) => {
  const [form, setForm] = useState({
    name: '',
    sku: barcode ? `SKU-${barcode.slice(-6).toUpperCase()}` : '',
    barcode: barcode || '',
    category: 'Electronics',
    brand: 'Generic',
    basePrice: '',
    costPrice: '',
    initialStock: '1',
    lowStockThreshold: '3',
    isSerialized: false,
    warrantyMonths: '12',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync barcode prop
  React.useEffect(() => {
    if (barcode) {
      setForm((prev) => ({
        ...prev,
        barcode,
        sku: prev.sku || `SKU-${barcode.slice(-6).toUpperCase()}`,
      }));
    }
  }, [barcode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.basePrice) {
      setError('Please provide product name and retail price.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/inventory/quick-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        onCreated(data.product);
        onClose();
      } else {
        setError(data.error || 'Failed to create product.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error creating product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Create Product from Scanned Barcode</h3>
              <p className="text-[11px] text-slate-400 font-mono">Barcode: {barcode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Product Title / Model Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dell Inspiron 15 3520 Intel Core i5 8GB/512GB"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SKU / Item Code</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Barcode (EAN/UPC)</label>
              <input
                type="text"
                value={form.barcode}
                readOnly
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Brand</label>
              <input
                type="text"
                placeholder="e.g. Dell, HP, APC, Hikvision"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Laptops, UPS, CCTV"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Retail Selling Price (NPR) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 75000"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase / Cost Price (NPR)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 62000"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Inward Qty</label>
              <input
                type="number"
                min="0"
                value={form.initialStock}
                onChange={(e) => setForm({ ...form, initialStock: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Warranty (Months)</label>
              <input
                type="number"
                min="0"
                value={form.warrantyMonths}
                onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Save & Register Product</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
