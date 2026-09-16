'use client';

// components/admin/DispatchOrderModal.tsx
//
// Assigns a pending shipment to a carrier and mints the tracking code.
//
// The tracking code is generated on submit rather than when the modal opens, so
// abandoning the dialog does not burn a code that never reaches a package.

import React, { useMemo, useState } from 'react';

import {
  genTrackingCode,
  npr,
  type CarrierKind,
  type RiderProfile,
  type Shipment,
  type ThirdPartyPartner,
} from './deliveryShared';

import { Bike, PackageCheck, Truck, X } from 'lucide-react';

export interface DispatchOrderModalProps {
  shipment: Shipment;
  riders: RiderProfile[];
  partners: ThirdPartyPartner[];
  onClose: () => void;
  /** Called with the carrier and the freshly minted tracking code. */
  onDispatch: (args: {
    shipmentId: string;
    carrierId: string;
    carrierName: string;
    carrierKind: CarrierKind;
    trackingCode: string;
    note: string;
  }) => void;
}

export const DispatchOrderModal: React.FC<DispatchOrderModalProps> = ({
  shipment,
  riders,
  partners,
  onClose,
  onDispatch,
}) => {
  const [carrierKind, setCarrierKind] = useState<CarrierKind>('in_house');
  const [carrierId, setCarrierId] = useState('');
  const [note, setNote] = useState('');

  /** Only enabled partners can take a package, so a disabled 3PL is not listed. */
  const availablePartners = useMemo(
    () => partners.filter((p) => p.enabled),
    [partners],
  );

  const activeRiders = useMemo(
    () => riders.filter((r) => r.status === 'active'),
    [riders],
  );

  const options = carrierKind === 'in_house' ? activeRiders : availablePartners;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierId) return;

    const carrierName =
      carrierKind === 'in_house'
        ? activeRiders.find((r) => r.id === carrierId)?.name ?? 'Unknown rider'
        : availablePartners.find((p) => p.id === carrierId)?.name ?? 'Unknown partner';

    onDispatch({
      shipmentId: shipment.id,
      carrierId,
      carrierName,
      carrierKind,
      trackingCode: shipment.trackingCode || genTrackingCode(),
      note,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8EE] sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h3 className="text-sm font-bold text-[#12151C]">Dispatch Shipment</h3>
            <p className="text-[11px] text-[#6B7280] font-mono mt-0.5">{shipment.orderId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Shipment recap */}
          <div className="bg-[#F4F5F8] rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#6B7280]">Customer</span>
              <span className="font-bold text-[#12151C]">{shipment.customerName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6B7280]">Phone</span>
              <span className="font-mono text-[#12151C]">{shipment.customerPhone}</span>
            </div>
            <div className="flex justify-between text-xs gap-4">
              <span className="text-[#6B7280] flex-shrink-0">Address</span>
              <span className="font-medium text-[#12151C] text-right">{shipment.address}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6B7280]">Zone</span>
              <span className="font-bold text-[#4C63FF]">{shipment.zoneLabel}</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-[#E6E8EE]">
              <span className="text-[#6B7280]">COD to collect</span>
              <span className={`font-black ${shipment.codAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {shipment.codAmount > 0 ? npr(shipment.codAmount) : 'PREPAID'}
              </span>
            </div>
          </div>

          {/* Carrier kind */}
          <div>
            <label className="block text-[#12151C] font-bold mb-2 text-xs">Carrier Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCarrierKind('in_house');
                  setCarrierId('');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  carrierKind === 'in_house'
                    ? 'bg-[#4C63FF] text-white border-[#4C63FF]'
                    : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8]'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                In-House Rider
              </button>
              <button
                type="button"
                onClick={() => {
                  setCarrierKind('third_party');
                  setCarrierId('');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  carrierKind === 'third_party'
                    ? 'bg-[#4C63FF] text-white border-[#4C63FF]'
                    : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8]'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                3PL Partner
              </button>
            </div>
          </div>

          {/* Carrier pick */}
          <div>
            <label className="block text-[#12151C] font-bold mb-1.5 text-xs">
              {carrierKind === 'in_house' ? 'Assign Rider' : 'Assign Partner'}
            </label>
            <select
              required
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
              className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-3 text-xs font-semibold text-[#12151C] focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
            >
              <option value="">Select a carrier…</option>
              {carrierKind === 'in_house'
                ? activeRiders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.activeDeliveries} active
                      {r.vehicleNumber ? ` · ${r.vehicleNumber}` : ''}
                    </option>
                  ))
                : availablePartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {npr(p.baseRate)} base
                      {p.apiConnected ? ' · API' : ' · manual'}
                    </option>
                  ))}
            </select>
            {options.length === 0 && (
              <p className="text-[10px] text-red-600 mt-1">
                No {carrierKind === 'in_house' ? 'active riders' : 'enabled partners'} available.
              </p>
            )}
          </div>

          {/* Dispatch note */}
          <div>
            <label className="block text-[#12151C] font-bold mb-1.5 text-xs">
              Dispatch Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Call before arrival, fragile package, gate code…"
              className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all resize-none"
            />
          </div>

          {/* Tracking code preview */}
          <div className="flex items-center gap-3 bg-indigo-50 rounded-2xl p-4">
            <PackageCheck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-[#6B7280] uppercase font-bold tracking-wider">
                Tracking code
              </div>
              <div className="font-mono text-xs font-black text-indigo-700">
                {shipment.trackingCode || 'generated on dispatch'}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E6E8EE] text-xs font-bold text-[#6B7280] hover:bg-[#F4F5F8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!carrierId}
              className="flex-1 py-2.5 rounded-xl bg-[#4C63FF] text-white text-xs font-bold shadow-lg shadow-[#4C63FF]/25 hover:bg-[#3D52CC] transition-colors disabled:opacity-40 disabled:shadow-none"
            >
              Confirm Dispatch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
