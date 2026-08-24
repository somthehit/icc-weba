'use client';

import React, { useState } from 'react';
import { type DeliveryZone, type DeliveryRider } from '@/types';
import {
  Plus,
} from 'lucide-react';

/**
 * Module 4 — delivery zones and the rider roster.
 *
 * Still rendering the seeded arrays: `delivery_zones` and `delivery_partners`
 * exist in the database but have no admin write path yet.
 */
export interface DeliveryModuleProps {
  deliveryZones: DeliveryZone[];
  riders: DeliveryRider[];
}

export const DeliveryModule: React.FC<DeliveryModuleProps> = ({ deliveryZones, riders }) => {
  const [deliverySubTab, setDeliverySubTab] = useState<
    'zones' | 'riders' | 'assignments' | 'failed'
  >('zones');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
        <button
          onClick={() => setDeliverySubTab('zones')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            deliverySubTab === 'zones' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Delivery Zones ({deliveryZones.length})
        </button>
        <button
          onClick={() => setDeliverySubTab('riders')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            deliverySubTab === 'riders' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Riders &amp; Couriers ({riders.length})
        </button>
      </div>

      {deliverySubTab === 'zones' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Nepal Shipping Zones &amp; Tariff Rates</h3>
            <button onClick={() => alert('New Zone added.')} className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Delivery Zone</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 uppercase font-extrabold bg-gray-50/50">
                  <th className="py-3 px-3">Province &amp; District</th>
                  <th className="py-3 px-3">Coverage Municipality</th>
                  <th className="py-3 px-3">Standard Fee</th>
                  <th className="py-3 px-3">ETA Window</th>
                  <th className="py-3 px-3">COD Available</th>
                  <th className="py-3 px-3">Free Delivery Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {deliveryZones.map((z) => (
                  <tr key={z.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-bold text-gray-900">{z.province} &bull; {z.district}</td>
                    <td className="py-3 px-3">{z.municipality}</td>
                    <td className="py-3 px-3 font-bold text-[#0056b3]">NPR {z.fee}</td>
                    <td className="py-3 px-3">{z.etaDays}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${z.codAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {z.codAvailable ? 'YES (COD)' : 'Prepaid Only'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">NPR {z.freeShippingThreshold.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deliverySubTab === 'riders' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Riders &amp; Partner Courier Fleet</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {riders.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl border bg-gray-50 space-y-2">
                <div className="font-bold text-sm text-gray-900">{r.name}</div>
                <div className="text-gray-500">{r.phone} &bull; {r.type.toUpperCase()}</div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="font-bold text-[#0056b3]">{r.activeDeliveries} Active Packages</span>
                  <span className="text-emerald-700 font-bold">ACTIVE FLEET</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
