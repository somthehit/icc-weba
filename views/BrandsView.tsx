'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export const BrandsView: React.FC = () => {
  const { brands, navigateTo } = useStore();

  // The catalogue also stores brands that merely appear on a product row (so the
  // shop filter can offer them); this page is only for the curated partners.
  const partnerBrands = React.useMemo(() => brands.filter((b) => b.isPartner), [brands]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>100% Authorized Products</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">Official Partner Brands in Nepal</h1>
        <p className="text-xs text-slate-500">
          Intel Computer Center partners directly with official brand importers to deliver authentic products with local warranty.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {partnerBrands.map((brand) => (
          <div key={brand.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-blue-400 transition-all space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-mono text-xl font-black text-slate-900 tracking-wider">{brand.name}</span>
              <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-0.5 rounded uppercase">
                Authorized Dealer
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{brand.description}</p>

            <button
              onClick={() => navigateTo('shop')}
              className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Explore {brand.name} Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
