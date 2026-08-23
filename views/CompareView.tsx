'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { Layers, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react';

export const CompareView: React.FC = () => {
  const { compareList, products, toggleCompare, addToCart, navigateTo } = useStore();

  const comparedProducts = products.filter((p) => compareList.includes(p.id));

  if (comparedProducts.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Products in Comparison</h2>
        <p className="text-xs text-slate-500">
          Click the compare icon on any laptop or electronic item card to build a side-by-side spec comparison matrix.
        </p>
        <button
          onClick={() => navigateTo('shop')}
          className="bg-blue-600 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow"
        >
          Explore Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900">Side-by-Side Product Comparison</h1>
        <button
          onClick={() => navigateTo('shop')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Add More Products</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="p-4 w-48 font-bold text-slate-700">Feature</th>
              {comparedProducts.map((p) => (
                <th key={p.id} className="p-4 w-72 align-top">
                  <div className="space-y-2">
                    <img src={p.images[0]} alt={p.name} className="w-24 h-24 object-contain mx-auto bg-white p-2 rounded-xl border" />
                    <div className="font-bold text-slate-900 text-xs line-clamp-2 text-center">{p.name}</div>
                    <div className="text-center font-extrabold text-blue-700 text-sm">NPR {p.sellingPrice.toLocaleString()}</div>

                    <div className="flex gap-2 justify-center pt-2">
                      <button
                        onClick={() => addToCart(p, 1)}
                        className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                      <button
                        onClick={() => toggleCompare(p.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="p-4 font-bold text-slate-800 bg-slate-50/50">Brand</td>
              {comparedProducts.map((p) => (
                <td key={p.id} className="p-4 font-bold text-slate-900 text-center uppercase">{p.brand}</td>
              ))}
            </tr>

            <tr>
              <td className="p-4 font-bold text-slate-800 bg-slate-50/50">Category</td>
              {comparedProducts.map((p) => (
                <td key={p.id} className="p-4 text-slate-700 text-center capitalize">{p.category}</td>
              ))}
            </tr>

            <tr>
              <td className="p-4 font-bold text-slate-800 bg-slate-50/50">Warranty in Nepal</td>
              {comparedProducts.map((p) => (
                <td key={p.id} className="p-4 text-slate-700 text-center">{p.warranty}</td>
              ))}
            </tr>

            <tr>
              <td className="p-4 font-bold text-slate-800 bg-slate-50/50">Stock Availability</td>
              {comparedProducts.map((p) => (
                <td key={p.id} className="p-4 text-center font-bold text-emerald-700">
                  {p.inStock ? `${p.stockQuantity} in Kathmandu` : 'Out of Stock'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
