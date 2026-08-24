'use client';

import React from 'react';

/** Module 10 — placeholder; nothing here writes to `site_settings` yet. */
export interface SettingsModuleProps {}

export const SettingsModule: React.FC<SettingsModuleProps> = () => {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
      <h3 className="font-extrabold text-base text-[#1a1a1a]">Store Configurations &amp; Payment Gateway Keys</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 border rounded-2xl bg-gray-50 space-y-2">
          <div className="font-bold text-sm text-gray-900">Cash on Delivery (COD)</div>
          <div className="text-emerald-700 font-bold">ENABLED (Nepal Cities)</div>
        </div>
        <div className="p-4 border rounded-2xl bg-gray-50 space-y-2">
          <div className="font-bold text-sm text-gray-900">Bank Direct Transfer &amp; Fonepay QR</div>
          <div className="text-emerald-700 font-bold">ENABLED (Account: Nabil Bank)</div>
        </div>
      </div>
    </div>
  );
};
