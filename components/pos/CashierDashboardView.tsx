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
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8faf9] dark:bg-[#0c120f] overflow-y-auto p-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              Terminal: {terminalCode}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
              Shift Active
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-1 tracking-tight">
            Cashier Performance Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Welcome, <strong className="text-slate-700 dark:text-slate-200">{activeCashier?.name || 'Till Operator'}</strong> ({activeCashier?.staffCode || 'CASHIER'}). Current shift sales and reconciliation overview.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('sales')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-black shadow-md transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Start New Sale</span>
          </button>
        </div>
      </div>

      {/* 2. Top Primary 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gross Shift Sales</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Rs. {formatNepaliNumber(String(totalSales))}
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>{totalOrders} invoices generated</span>
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bills Processed</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalOrders}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Counter checkout completed
            </p>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average Basket (AOV)</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Rs. {formatNepaliNumber(String(Math.round(avgBasket)))}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Per customer basket size
            </p>
          </div>
        </div>

        {/* Expected Cash in Till */}
        <div className="bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expected Cash Drawer</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Rs. {formatNepaliNumber(String(expectedCash))}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Opening float + Cash sales
            </p>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Tender Breakdown & Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tender Mix */}
        <div className="lg:col-span-2 bg-white dark:bg-[#141a17] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Sales by Payment Tender
              </h3>
              <p className="text-xs text-slate-500">Distribution of shift collections across methods</p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('reports')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>View Full X-Report</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {/* Cash */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span>Physical Cash</span>
                </span>
                <span className="text-slate-900 dark:text-white">
                  Rs. {formatNepaliNumber(String(cashSales))} ({cashPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, cashPct))}%` }} />
              </div>
            </div>

            {/* Card */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span>Card EDC (Visa / SCT / Master)</span>
                </span>
                <span className="text-slate-900 dark:text-white">
                  Rs. {formatNepaliNumber(String(cardSales))} ({cardPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, cardPct))}%` }} />
              </div>
            </div>

            {/* Dynamic QR */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <QrCode className="h-4 w-4 text-purple-600" />
                  <span>Dynamic QR (Fonepay / eSewa)</span>
                </span>
                <span className="text-slate-900 dark:text-white">
                  Rs. {formatNepaliNumber(String(qrSales))} ({qrPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, qrPct))}%` }} />
              </div>
            </div>

            {/* Credit / Khata */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Users className="h-4 w-4 text-amber-600" />
                  <span>Customer Credit / Khata</span>
                </span>
                <span className="text-slate-900 dark:text-white">
                  Rs. {formatNepaliNumber(String(creditSales))} ({creditPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.max(4, creditPct))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Taxes & Shift Summary Card */}
        <div className="bg-white dark:bg-[#141a17] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Tax &amp; Compliance (IRD)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-600 dark:text-slate-400">13% Nepal VAT</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(totalVat))}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Total Discounts Granted</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(totalDiscounts))}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Opening Cash Float</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(shiftMetrics?.openingFloat || 0))}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onSwitchTab('reports')}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
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
          className="p-4 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-800 dark:text-white">Sales Terminal</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Quick barcode &amp; checkout</p>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTab('products')}
          className="p-4 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Package className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-800 dark:text-white">Product Catalog</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Stock lookup &amp; pricing</p>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTab('customers')}
          className="p-4 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 hover:border-purple-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <Users className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-800 dark:text-white">Customer Khata</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Profiles &amp; credit ledger</p>
        </button>

        <button
          type="button"
          onClick={() => onSwitchTab('settings')}
          className="p-4 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 hover:border-amber-500 hover:shadow-md transition text-left group"
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-black text-slate-800 dark:text-white">Cashier Security</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Change PIN &amp; password</p>
        </button>
      </div>

      {/* 5. Recent Shift Orders Table */}
      <div className="bg-white dark:bg-[#141a17] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Recent Terminal Transactions
          </h3>
          <span className="text-xs text-slate-500 font-semibold">{recentOrders.length} records retrieved</span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No sales processed yet in current shift. Start billing from the Sales tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                  <th className="pb-2">Invoice #</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Payment Method</th>
                  <th className="pb-2 text-right">Amount (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                {recentOrders.map((ord, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      {ord.orderNumber}
                    </td>
                    <td className="py-2.5 text-slate-500">
                      {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 uppercase font-bold text-emerald-600 text-[11px]">
                      {ord.paymentMethod}
                    </td>
                    <td className="py-2.5 font-mono font-black text-right text-slate-900 dark:text-white">
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
