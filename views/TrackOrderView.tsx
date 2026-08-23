'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { Order } from '@/types';
import { 
  Search, 
  Package, 
  CheckCircle2, 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  AlertCircle 
} from 'lucide-react';

export const TrackOrderView: React.FC = () => {
  const { getOrderById, navigateTo } = useStore();

  const [orderIdInput, setOrderIdInput] = useState('ICE-2026-8942');
  const [phoneInput, setPhoneInput] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const found = getOrderById(orderIdInput);
    if (!found) {
      setErrorMsg(`Order '${orderIdInput}' not found in database. Please verify your Order Number.`);
      setSearchedOrder(null);
    } else {
      setSearchedOrder(found);
    }
  };

  const statusStepMap = {
    placed: 1,
    confirmed: 2,
    processing: 2,
    packed: 3,
    shipped: 4,
    out_for_delivery: 4,
    delivered: 5,
    cancelled: 0,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Search Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Package className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Track Your Nepal Order Status</h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Enter your 11-digit Order Reference Number (e.g. ICE-2026-8942) to check real-time courier dispatch progress.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="text"
            required
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="Order Number (e.g. ICE-2026-8942)"
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-xs uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span>Track Order</span>
          </button>
        </form>

        {errorMsg && (
          <p className="text-xs font-bold text-red-600 flex items-center justify-center gap-1">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </p>
        )}
      </div>

      {/* Order Status Results */}
      {searchedOrder && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6 text-xs">
          {/* Summary Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 pb-4">
            <div>
              <span className="text-slate-400 font-mono text-[11px]">Order Reference:</span>
              <h2 className="text-lg font-black text-blue-700 font-mono">{searchedOrder.id}</h2>
              <div className="text-[11px] text-slate-500">Placed on: {searchedOrder.createdAt.split('T')[0]}</div>
            </div>

            <div className="text-right">
              <span className="text-slate-400 text-[11px]">Current Status:</span>
              <div className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase inline-block ml-2 border border-emerald-200">
                {searchedOrder.status.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Visual Step Tracker */}
          <div className="py-4">
            <div className="flex items-center justify-between relative max-w-xl mx-auto">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -z-0" />
              <div
                className="absolute top-1/2 left-0 h-1 bg-emerald-500 transition-all duration-500 -z-0"
                style={{
                  width: `${((statusStepMap[searchedOrder.status] - 1) / 4) * 100}%`,
                }}
              />

              {['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'].map((stepLabel, idx) => {
                const stepNum = idx + 1;
                const isDone = statusStepMap[searchedOrder.status] >= stepNum;
                return (
                  <div key={idx} className="flex flex-col items-center z-10 bg-white px-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                        isDone ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                    </div>
                    <span className={`text-[10px] font-bold mt-1 ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                      {stepLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Timeline Logs */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Shipment Timeline Logs</h3>
            <div className="space-y-3 pl-2 border-l-2 border-blue-600 ml-2">
              {searchedOrder.trackingHistory.map((hist, idx) => (
                <div key={idx} className="relative pl-4 space-y-0.5">
                  <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>{hist.title}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{hist.timestamp}</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{hist.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery & Items Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <h4 className="font-bold text-slate-900">Delivery Address:</h4>
              <p className="font-bold text-blue-700">{searchedOrder.shippingAddress.fullName}</p>
              <p className="text-slate-600">{searchedOrder.shippingAddress.phone}</p>
              <p className="text-slate-600">{searchedOrder.shippingAddress.addressLine}, Ward {searchedOrder.shippingAddress.ward}, {searchedOrder.shippingAddress.district}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <h4 className="font-bold text-slate-900">Order Items:</h4>
              <div className="divide-y divide-slate-200">
                {searchedOrder.items.map((it, idx) => (
                  <div key={idx} className="py-1 flex justify-between">
                    <span>{it.productName} (x{it.quantity})</span>
                    <span className="font-bold">NPR {(it.price * it.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
