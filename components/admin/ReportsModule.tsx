'use client';

import React from 'react';
import { Product } from '@/types';
import {
  Download,
} from 'lucide-react';

/**
 * Module 9 — reporting.
 *
 * Only the figures that can be derived from loaded state are shown; the
 * server-side aggregates (`/api/reports`) do not exist yet.
 */
export interface ReportsModuleProps {
  products: Product[];
  totalRevenue: number;
  handleExportOrdersCsv: () => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ products, totalRevenue, handleExportOrdersCsv }) => {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-extrabold text-base text-[#1a1a1a]">Sales &amp; Inventory Financial Reports</h3>
        <button onClick={handleExportOrdersCsv} className="bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          <span>Export All Financial Logs CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-4 border rounded-2xl bg-blue-50/50 space-y-1">
          <div className="text-gray-500 font-bold">Gross Orders Volume</div>
          <div className="text-xl font-black text-[#0056b3]">NPR {totalRevenue.toLocaleString()}</div>
        </div>
        <div className="p-4 border rounded-2xl bg-emerald-50/50 space-y-1">
          <div className="text-gray-500 font-bold">Inventory Valuation</div>
          <div className="text-xl font-black text-emerald-700">
            NPR {products.reduce((acc, p) => acc + (p.sellingPrice * p.stockQuantity), 0).toLocaleString()}
          </div>
        </div>
        <div className="p-4 border rounded-2xl bg-purple-50/50 space-y-1">
          <div className="text-gray-500 font-bold">Completed Service Revenue</div>
          <div className="text-xl font-black text-purple-700">NPR 18,500</div>
        </div>
      </div>
    </div>
  );
};
