'use client';

import React from 'react';
import type { StockAdjustment } from '@/types';

/** Module 6 — the stock adjustment ledger written by the audit modal. */
export interface InventoryModuleProps {
  stockAdjustments: StockAdjustment[];
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ stockAdjustments }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
        <h3 className="font-extrabold text-base text-[#1a1a1a]">Stock Adjustment Audit Log (Append-Only)</h3>
        <p className="text-xs text-gray-500">Every inventory recount, damage removal, or supplier restock is permanently recorded here.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-gray-500 uppercase font-extrabold bg-gray-50/50">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Product SKU</th>
                <th className="py-3 px-3">Quantity Delta</th>
                <th className="py-3 px-3">Adjustment Reason</th>
                <th className="py-3 px-3">Acting Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {stockAdjustments.map((sa) => (
                <tr key={sa.id} className="hover:bg-gray-50">
                  <td className="py-3 px-3 font-mono text-gray-500">{sa.timestamp}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">{sa.productName}</td>
                  <td className={`py-3 px-3 font-black ${sa.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {sa.quantityDelta > 0 ? `+${sa.quantityDelta}` : sa.quantityDelta} Units
                  </td>
                  <td className="py-3 px-3 uppercase text-[10px] font-bold tracking-wider">{sa.reason.replace('_', ' ')}</td>
                  <td className="py-3 px-3 text-gray-700">{sa.adminName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
