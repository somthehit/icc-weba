'use client';

import React from 'react';
import { Order } from '@/types';
import {
  Printer,
  X,
} from 'lucide-react';

/** The printable delivery slip for one order. */
export interface WaybillModalProps {
  waybillOrder: Order | null;
  setWaybillOrder: (order: Order | null) => void;
}

export const WaybillModal: React.FC<WaybillModalProps> = ({ waybillOrder, setWaybillOrder }) => {
  if (!waybillOrder) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-200 text-xs">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="font-black text-sm text-[#0056b3]">WAYBILL DISPATCH SLIP</div>
          <button onClick={() => setWaybillOrder(null)} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border p-4 rounded-2xl bg-gray-50 space-y-2 font-mono">
          <div className="flex justify-between font-bold text-gray-900">
            <span>ORDER #{waybillOrder.id}</span>
            <span>{waybillOrder.createdAt.slice(0, 10)}</span>
          </div>
          <hr />
          <div><strong>RECIPIENT:</strong> {waybillOrder.customerName}</div>
          <div><strong>PHONE:</strong> {waybillOrder.customerPhone}</div>
          <div><strong>ADDRESS:</strong> {waybillOrder.shippingAddress.addressLine}, {waybillOrder.shippingAddress.district || waybillOrder.shippingAddress.municipality}</div>
          <div><strong>COLLECT COD AMOUNT:</strong> NPR {waybillOrder.totalAmount.toLocaleString()}</div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => { window.print(); }}
            className="bg-[#0056b3] text-white font-bold py-2 px-5 rounded-xl flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Waybill Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
