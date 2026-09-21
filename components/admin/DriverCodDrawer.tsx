'use client';

import React, { useMemo } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  PackageCheck,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import type { Order } from '@/types';

interface DriverCodDrawerProps {
  orders: Order[];
  outstandingTransit: number;
  onClose: () => void;
  onSettleDriver: (driverName: string, suggestedAmount: number, orderRef?: string) => void;
}

const money = (val: number) => `NPR ${Math.round(val).toLocaleString('en-IN')}`;

export const DriverCodDrawer: React.FC<DriverCodDrawerProps> = ({
  orders,
  outstandingTransit,
  onClose,
  onSettleDriver,
}) => {
  // Aggregate pending COD deliveries grouped by rider / driver
  const driverBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        driverName: string;
        orders: Order[];
        totalPendingAmount: number;
      }
    >();

    // Filter COD orders that are delivered/out-for-delivery but not yet fully settled/verified
    const codOrders = orders.filter(
      (o) =>
        o.paymentMethod === 'cod' &&
        (o.status === 'delivered' || o.status === 'out_for_delivery') &&
        o.paymentStatus !== 'paid' &&
        o.paymentStatus !== 'verified',
    );

    codOrders.forEach((order) => {
      const driver = order.assignedRiderName || 'Unassigned / Shop Delivery Staff';
      const existing = map.get(driver) || {
        driverName: driver,
        orders: [] as Order[],
        totalPendingAmount: 0,
      };

      existing.orders.push(order);
      existing.totalPendingAmount += order.totalAmount;
      map.set(driver, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalPendingAmount - a.totalPendingAmount);
  }, [orders]);

  const totalUncollectedFromOrders = driverBreakdown.reduce((sum, d) => sum + d.totalPendingAmount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Driver &amp; 3PL COD Cash in Transit
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rider-by-rider breakdown of cash collected from customers awaiting bank/vault settlement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top summary card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Ledger Account 1250 (Transit)
              </span>
              <p className="text-lg font-mono font-black text-amber-950 mt-1">
                {money(outstandingTransit)}
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5 font-semibold">
                Cash recognized in double-entry books
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Delivered COD Orders
              </span>
              <p className="text-lg font-mono font-black text-slate-900 mt-1">
                {money(totalUncollectedFromOrders)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                Across {driverBreakdown.reduce((sum, d) => sum + d.orders.length, 0)} customer deliveries
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Active Delivery Riders
              </span>
              <p className="text-lg font-mono font-black text-blue-950 mt-1">
                {driverBreakdown.length}
              </p>
              <p className="text-[10px] text-blue-700 mt-0.5 font-semibold">
                Couriers &amp; Internal Staff
              </p>
            </div>
          </div>

          {/* Riders list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Riders with Outstanding Cash
            </h3>

            {driverBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">All driver cash is reconciled!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No pending COD orders currently awaiting courier settlement.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {driverBreakdown.map((driver) => (
                  <div
                    key={driver.driverName}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-slate-900">
                            {driver.driverName}
                          </h4>
                          <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                            {driver.orders.length} order{driver.orders.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Pending Cash in Hand:{' '}
                          <span className="font-mono font-bold text-slate-900">
                            {money(driver.totalPendingAmount)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSettleDriver(
                              driver.driverName,
                              driver.totalPendingAmount,
                              driver.orders[0]?.id,
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          <span>Settle &amp; Deposit</span>
                        </button>
                      </div>
                    </div>

                    {/* Order Reference chips */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {driver.orders.map((o) => (
                        <span
                          key={o.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] text-slate-600 font-mono"
                          title={`Customer: ${o.shippingAddress?.fullName || 'N/A'}`}
                        >
                          <PackageCheck className="h-3 w-3 text-slate-400" />
                          <span className="font-bold">{o.id}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-bold text-slate-800">{money(o.totalAmount)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
