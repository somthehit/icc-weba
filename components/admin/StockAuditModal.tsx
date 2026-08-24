'use client';

import React from 'react';
import type { Product } from '@/types';
import { type StockAuditReason } from './shared';
import {
  Check,
  X,
} from 'lucide-react';

/**
 * Records a stock movement against one product.
 *
 * Shell-owned rather than catalogue-owned because both the dashboard's low-stock
 * queue and the catalogue table open it.
 */
export interface StockAuditModalProps {
  auditProduct: Product | null;
  setAuditProduct: (product: Product | null) => void;
  stockAdjustment: number;
  setStockAdjustment: (delta: number) => void;
  auditReason: StockAuditReason;
  setAuditReason: (reason: StockAuditReason) => void;
  auditSuccessMsg: string;
  handleStockAdjustmentSubmit: (e: React.FormEvent) => void;
}

export const StockAuditModal: React.FC<StockAuditModalProps> = ({
  auditProduct,
  setAuditProduct,
  stockAdjustment,
  setStockAdjustment,
  auditReason,
  setAuditReason,
  auditSuccessMsg,
  handleStockAdjustmentSubmit,
}) => {
  if (!auditProduct) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-200">
        <div className="flex justify-between items-start border-b pb-3">
          <div>
            <div className="text-[10px] font-bold text-[#0056b3] uppercase tracking-wider">Inventory Stock Audit</div>
            <h3 className="font-extrabold text-base text-gray-900">{auditProduct.name}</h3>
          </div>
          <button onClick={() => setAuditProduct(null)} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {auditSuccessMsg ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-800 font-bold text-xs text-center flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>{auditSuccessMsg}</span>
          </div>
        ) : (
          <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4 text-xs">
            <div className="bg-gray-50 p-3 rounded-xl border text-gray-700 flex justify-between font-bold">
              <span>Current On-Hand Stock:</span>
              <span className="text-[#0056b3]">{auditProduct.stockQuantity} Units</span>
            </div>

            <div>
              <label className="block font-bold mb-1">Adjustment Delta (+ Add Restock / - Remove Damaged)</label>
              <input
                type="number"
                value={stockAdjustment}
                onChange={(e) => setStockAdjustment(parseInt(e.target.value) || 0)}
                className="w-full p-2.5 border border-gray-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-[#0056b3] outline-none"
                required
              />
              <div className="text-[10px] text-gray-500 mt-1">Example: Enter <code className="bg-gray-200 px-1 py-0.5 rounded">5</code> to add 5 restocked units, or <code className="bg-gray-200 px-1 py-0.5 rounded">-1</code> for damaged stock.</div>
            </div>

            <div>
              <label className="block font-bold mb-1">Audit Reason</label>
              <select
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value as any)}
                className="w-full p-2.5 border border-gray-300 rounded-xl bg-white font-bold"
              >
                <option value="supplier_restock">Supplier Restock Shipment</option>
                <option value="recount">Physical Stock Recount Correction</option>
                <option value="damaged">Damaged / Broken Item Removal</option>
                <option value="correction">Order Cancellation Return</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0056b3] hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md text-xs transition-transform active:scale-95"
            >
              Confirm &amp; Record Stock Adjustment
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
