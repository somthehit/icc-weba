'use client';

// components/admin/ReceiveInventoryModal.tsx
//
// Logging incoming stock.
//
// Everything here is driven by data the caller already loaded from
// `/api/inventory/stock-levels` and `/api/inventory/warehouses` — there is no mock
// product list, and submit posts to `/api/inventory/adjust` rather than resolving a
// timer. A form that appears to succeed without writing anything is worse than one
// that fails loudly.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Check,
  FileText,
  Hash,
  Loader2,
  PackagePlus,
  Search,
  X,
} from 'lucide-react';

export interface ReceiveProductOption {
  productId: number;
  sku: string;
  productName: string;
  stockQuantity: number;
  /** Null when the product has never had a cost recorded — the "Cost missing" case. */
  unitCost: number | null;
}

export interface ReceiveWarehouseOption {
  id: number;
  name: string;
  district: string | null;
  isActive: boolean;
}

export interface ReceiveInventoryModalProps {
  products: ReceiveProductOption[];
  warehouses: ReceiveWarehouseOption[];
  onClose: () => void;
  /** Called with the server's message after a successful write, so the parent can reload. */
  onReceived: (message: string) => void;
}

const npr = (value: number) =>
  // `en-IN` for lakh/crore grouping, matching every other figure in the console.
  // Deliberately not `ne-NP`, which renders Devanagari numerals here and would make
  // this one number unreadable next to the rest.
  `NPR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ReceiveInventoryModal: React.FC<ReceiveInventoryModalProps> = ({
  products,
  warehouses,
  onClose,
  onReceived,
}) => {
  const [selected, setSelected] = useState<ReceiveProductOption | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const activeWarehouses = useMemo(() => warehouses.filter((w) => w.isActive), [warehouses]);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const comboRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** Esc closes; the spec described this but never wired a handler. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Close the dropdown first so Esc does not discard the whole form while the
      // user is only trying to dismiss the suggestion list.
      if (open) setOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /** Clicking away closes the suggestion list. */
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? products.filter(
          (p) =>
            p.productName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
        )
      : products;
    // Capped so a 5000-product catalogue does not render 5000 rows into the popover.
    return pool.slice(0, 50);
  }, [products, query]);

  useEffect(() => setHighlight(0), [query]);

  // Keep the highlighted row in view when navigating by keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlight, open]);

  const choose = useCallback((product: ReceiveProductOption) => {
    setSelected(product);
    setQuery('');
    setOpen(false);
    setError('');
    // Prefill the last known cost so a receipt at an unchanged price is one less field
    // to type. Left blank when the product has no cost on record, which is exactly the
    // case worth filling in.
    setUnitCost(product.unitCost !== null ? String(product.unitCost) : '');
  }, []);

  const onComboKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Prevents Enter from submitting the form while the list is open.
      e.preventDefault();
      const pick = matches[highlight];
      if (pick) choose(pick);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const qty = Number(quantity) || 0;
  const cost = Number(unitCost) || 0;
  const batchCost = qty * cost;
  const canSubmit = Boolean(selected) && qty > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selected) {
      setError('Choose the product being received.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setError('Quantity received must be a whole number above zero.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selected.productId,
          // Omitted (not null) so the server picks the only active warehouse; explicit
          // null would mean "product-level count, no warehouse", which is not what
          // receiving a delivery means.
          ...(warehouseId ? { warehouseId: Number(warehouseId) } : {}),
          quantityDelta: qty,
          reason: 'supplier_restock',
          // `referenceNo` is a real column the ledger indexes. The previous form put the
          // invoice number into `note`, where nothing could look it up.
          ...(invoiceRef.trim() ? { referenceNo: invoiceRef.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(cost > 0 ? { unitCost: cost } : {}),
          // Lets the server reject the write if someone else moved this product's stock
          // since the list was loaded, instead of silently applying to a stale count.
          expectedQuantity: selected.stockQuantity,
        }),
      });

      const raw = await response.text();
      let payload: any = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        setError(
          payload.details?.join(', ') ??
            payload.error ??
            `Could not receive stock (${response.status}).`,
        );
        return;
      }

      onReceived(payload.message ?? 'Stock received.');
      onClose();
    } catch {
      setError('Could not reach the inventory service.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayValue = selected ? `${selected.sku} · ${selected.productName}` : query;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight text-slate-900">Receive Inventory</h3>
              <p className="text-xs text-slate-500">Logs incoming stock as a supplier restock</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          {/* Product combobox */}
          <div className="relative" ref={comboRef}>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Product or SKU <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls="receive-product-list"
                autoComplete="off"
                placeholder="Search by product name or SKU…"
                value={displayValue}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onComboKeyDown}
                className={`w-full rounded-2xl border bg-slate-50 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 outline-none transition-all focus:bg-white focus:ring-2 ${
                  selected
                    ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/30'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/30'
                }`}
              />
              {selected && (
                <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-600" />
              )}
            </div>

            {open && (
              <div
                id="receive-product-list"
                ref={listRef}
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl"
              >
                {matches.map((product, idx) => (
                  <button
                    key={product.productId}
                    type="button"
                    data-idx={idx}
                    role="option"
                    aria-selected={idx === highlight}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => choose(product)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 ${
                      idx === highlight ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {product.productName}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        SKU: {product.sku}
                        {product.unitCost === null && (
                          <span className="ml-1.5 font-sans font-bold text-amber-600">
                            no cost on record
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {product.stockQuantity} on hand
                    </span>
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-slate-500">
                    {products.length === 0
                      ? 'No products loaded.'
                      : `Nothing matches “${query}”.`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Warehouse */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Destination Location / Hub
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Default (only active warehouse)</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.district ? ` — ${w.district}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {activeWarehouses.length === 0 && (
              <p className="mt-1 text-[10px] font-bold text-amber-600">
                No active warehouses — stock will be recorded against the product count only.
              </p>
            )}
          </div>

          {/* Quantity + unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Qty Received <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="e.g. 25"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Unit Cost (NPR)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost price"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              {selected && selected.unitCost === null && (
                <p className="mt-1 text-[10px] font-bold text-amber-600">
                  First cost for this product — sets its cost value.
                </p>
              )}
            </div>
          </div>

          {/* Supplier reference */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Supplier Invoice / Ref Number
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. INV-2026-8841"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Note (optional)
            </label>
            <input
              type="text"
              maxLength={500}
              placeholder="Anything worth recording against this batch"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Batch summary */}
          {selected && qty > 0 && (
            <div className="space-y-1.5 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-blue-800">On hand after receipt</span>
                <span className="font-mono font-bold text-blue-900">
                  {selected.stockQuantity} → {selected.stockQuantity + qty}
                </span>
              </div>
              {batchCost > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-blue-800">Added asset value</span>
                  <span className="font-mono text-sm font-bold text-blue-900">
                    {npr(batchCost)}
                  </span>
                </div>
              )}
              {cost <= 0 && (
                <p className="text-[10px] text-blue-700">
                  No unit cost entered — stock value for this product stays as it was.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="flex items-start gap-1.5 rounded-2xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? 'Updating stock…' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
