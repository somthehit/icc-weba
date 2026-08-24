'use client';

import React from 'react';

/**
 * Module 8 — placeholder.
 *
 * `users`, `addresses` and `wishlists` are all populated, but there is no
 * customer-facing admin query yet, so this states that rather than rendering an
 * invented directory.
 */
export interface CustomersModuleProps {}

export const CustomersModule: React.FC<CustomersModuleProps> = () => {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
      <h3 className="font-extrabold text-base text-[#1a1a1a]">Registered Customer Profiles &amp; Order Integrity</h3>
      <p className="text-xs text-gray-500">Customer accounts preserve past order history for warranty validation.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 border rounded-2xl bg-gray-50 space-y-2">
          <div className="font-bold text-sm text-gray-900">Subash Bhattarai</div>
          <div className="text-gray-600">Kathmandu, Nepal &bull; Phone: +977-9841223344</div>
          <div className="text-emerald-700 font-bold">2 Orders Placed (Total Spend: NPR 115,000)</div>
        </div>
      </div>
    </div>
  );
};
