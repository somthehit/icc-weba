'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  Package,
  Receipt,
  Clock,
  ShieldCheck,
  RefreshCw,
  Printer,
  ArrowUpRight,
  ChevronRight,
  Percent,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formatNpr, formatNepaliNumber } from '@/lib/nepal/money';
import { StaffProfile } from './TerminalDualAuthGate';

interface CashierDashboardViewProps {
  activeCashier: StaffProfile | null;
  activeShift: any | null;
  terminalCode: string;
  theme: 'dark' | 'light';
  onSwitchTab: (tab: 'dashboard' | 'sales' | 'products' | 'customers' | 'reports' | 'settings') => void;
}

export default function CashierDashboardView({
  activeCashier,
  activeShift,
  terminalCode,
  theme,
  onSwitchTab,
}: CashierDashboardViewProps) {
  const [shiftMetrics, setShiftMetrics] = useState<any | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/shift?register=${terminalCode}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.shift?.liveMetrics) {
          setShiftMetrics(data.shift.liveMetrics);
        }
        if (data.recentOrders) {
          setRecentOrders(data.recentOrders);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [terminalCode]);

  const totalSales = shiftMetrics?.totalSales || 0;
  const cashSales = shiftMetrics?.cashSales || 0;
  const cardSales = shiftMetrics?.cardSales || 0;
  const qrSales = shiftMetrics?.qrSales || 0;
  const creditSales = shiftMetrics?.creditSales || 0;
  const totalOrders = shiftMetrics?.totalOrders || recentOrders.length || 0;
  const avgBasket = totalOrders > 0 ? totalSales / totalOrders : 0;
  const expectedCash = shiftMetrics?.expectedCash || shiftMetrics?.openingFloat || 0;
  const totalVat = shiftMetrics?.totalVat || 0;
  const totalDiscounts = shiftMetrics?.totalDiscounts || 0;

  // Tender percentage shares
  const safeSales = totalSales > 0 ? totalSales : 1;
  const cashPct = Math.round((cashSales / safeSales) * 100);
  const cardPct = Math.round((cardSales / safeSales) * 100);
  const qrPct = Math.round((qrSales / safeSales) * 100);
  const creditPct = Math.max(0, 100 - (cashPct + cardPct + qrPct));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/70 overflow-y-auto p-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Terminal: {terminalCode}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
              Shift Active
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Cashier Performance Dashboard
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Welcome, <strong className="text-slate-900 font-bold">{activeCashier?.name || 'Till Operator'}</strong> ({activeCashier?.staffCode || 'CASHIER'}). Current shift sales and reconciliation overview.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 transition shadow-2xs"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-600'}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('sales')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00c569] hover:bg-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Start New Sale</span>
          </button>
        </div>
      </div>

      {/* 2. Top Primary 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Gross Shift Sales</span>
            <div className="h-9 w-9 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <TrendingUp className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rs. {formatNepaliNumber(String(totalSales))}
            </div>
            <p className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
              <span>{totalOrders} invoices generated</span>
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Bills Processed</span>
            <div className="h-9 w-9 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Receipt className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              {totalOrders}
            </div>
            <p className="text-[11px] font-bold text-blue-700 mt-1">
              Counter checkout completed
            </p>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Average Basket (AOV)</span>
            <div className="h-9 w-9 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-sm shadow-purple-500/20">
              <Sparkles className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rs. {formatNepaliNumber(String(Math.round(avgBasket)))}
            </div>
            <p className="text-[11px] font-bold text-purple-700 mt-1">
              Per customer basket size
            </p>
          </div>
        </div>

        {/* Expected Cash in Till */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Expected Cash Drawer</span>
            <div className="h-9 w-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/20">
              <Banknote className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rs. {formatNepaliNumber(String(expectedCash))}
            </div>
            <p className="text-[11px] font-bold text-amber-800 mt-1">
              Opening float + Cash sales
            </p>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Tender Breakdown & Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tender Mix */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Sales by Payment Tender
              </h3>
              <p className="text-xs text-slate-500 font-medium">Distribution of shift collections across payment methods</p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('reports')}
              className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
            >
              <span>View Full X-Report</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-4 pt-2">
            {/* Cash */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-emerald-50/40 border border-emerald-100">
              <div className="flex justify-between text-xs font-black">
                <span className="flex items-center gap-2 text-slate-800">
                  <span className="p-1.5 rounded-lg bg-emerald-500 text-white">
                    <Banknote className="h-3.5 w-3.5" />
                  </span>
                  <span>Physical Cash</span>
                </span>
                <span className="text-slate-900 font-mono">
                  Rs. {formatNepaliNumber(String(cashSales))} <span className="text-emerald-700 font-bold">({cashPct}%)</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, cashPct))}%` }} />
              </div>
            </div>

            {/* Card */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-blue-50/40 border border-blue-100">
              <div className="flex justify-between text-xs font-black">
                <span className="flex items-center gap-2 text-slate-800">
                  <span className="p-1.5 rounded-lg bg-blue-500 text-white">
                    <CreditCard className="h-3.5 w-3.5" />
                  </span>
                  <span>Card EDC (Visa / SCT / Master)</span>
                </span>
                <span className="text-slate-900 font-mono">
                  Rs. {formatNepaliNumber(String(cardSales))} <span className="text-blue-700 font-bold">({cardPct}%)</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, cardPct))}%` }} />
              </div>
            </div>

            {/* Dynamic QR */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-purple-50/40 border border-purple-100">
              <div className="flex justify-between text-xs font-black">
                <span className="flex items-center gap-2 text-slate-800">
                  <span className="p-1.5 rounded-lg bg-purple-500 text-white">
                    <QrCode className="h-3.5 w-3.5" />
                  </span>
                  <span>Dynamic QR (Fonepay / eSewa)</span>
                </span>
                <span className="text-slate-900 font-mono">
                  Rs. {formatNepaliNumber(String(qrSales))} <span className="text-purple-700 font-bold">({qrPct}%)</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, qrPct))}%` }} />
              </div>
            </div>

            {/* Credit / Khata */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50/40 border border-amber-100">
              <div className="flex justify-between text-xs font-black">
                <span className="flex items-center gap-2 text-slate-800">
                  <span className="p-1.5 rounded-lg bg-amber-500 text-white">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span>Customer Credit / Khata</span>
                </span>
                <span className="text-slate-900 font-mono">
                  Rs. {formatNepaliNumber(String(creditSales))} <span className="text-amber-800 font-bold">({creditPct}%)</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, creditPct))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Taxes & Shift Summary Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Tax &amp; Compliance (IRD)
              </h3>
              <p className="text-xs text-slate-500 font-medium">Nepal Inland Revenue Department compliance</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between">
                <span className="font-bold text-slate-700">13% Nepal VAT</span>
                <span className="font-mono font-black text-rose-950 text-sm">
                  Rs. {formatNepaliNumber(String(totalVat))}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-orange-50/60 border border-orange-200/80 flex items-center justify-between">
                <span className="font-bold text-slate-700">Total Discounts Granted</span>
                <span className="font-mono font-black text-orange-950 text-sm">
                  Rs. {formatNepaliNumber(String(totalDiscounts))}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-700">Opening Cash Float</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  Rs. {formatNepaliNumber(String(shiftMetrics?.openingFloat || 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onSwitchTab('reports')}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Printer className="h-4 w-4" />
              <span>Print Cashier Shift X-Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Quick Navigation Hub Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onSwitchTab('sales')}
          className="p-4 rounded-3xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-900">Sales Terminal</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Quick barcode &amp; checkout</p>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTab('products')}
          className="p-4 rounded-3xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Package className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-900">Product Catalog</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Stock lookup &amp; pricing</p>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTab('customers')}
          className="p-4 rounded-3xl bg-white border border-slate-200 hover:border-purple-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Users className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-900">Customer Khata</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Profiles &amp; credit ledger</p>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTab('settings')}
          className="p-4 rounded-3xl bg-white border border-slate-200 hover:border-amber-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-900">Cashier Security</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Change PIN &amp; password</p>
        </button>
      </div>

      {/* 5. Recent Shift Orders Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Recent Terminal Transactions
            </h3>
            <p className="text-xs text-slate-500 font-medium">Invoices generated in the current open shift</p>
          </div>
          <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {recentOrders.length} records retrieved
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No sales processed yet in current shift. Start billing from the Sales tab.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Amount (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                {recentOrders.map((ord, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition">
                    <td className="py-3 px-4 font-mono font-black text-slate-900">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {ord.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-right text-slate-950 text-sm">
                      Rs. {formatNepaliNumber(String(ord.totalAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
