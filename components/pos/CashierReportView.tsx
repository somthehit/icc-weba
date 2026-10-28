'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  Clock,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { formatNepaliNumber } from '@/lib/nepal/money';
import { StaffProfile } from './TerminalDualAuthGate';

interface CashierReportViewProps {
  activeCashier: StaffProfile | null;
  activeShift: any | null;
  terminalCode: string;
  theme: 'dark' | 'light';
}

export default function CashierReportView({
  activeCashier,
  activeShift,
  terminalCode,
  theme,
}: CashierReportViewProps) {
  const [shiftData, setShiftData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShiftReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/shift?register=${terminalCode}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setShiftData(data);
      }
    } catch (err) {
      console.error('Failed to load shift report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftReport();
  }, [terminalCode]);

  const metrics = shiftData?.shift?.liveMetrics || {};
  const totalSales = metrics.totalSales || 0;
  const cashSales = metrics.cashSales || 0;
  const cardSales = metrics.cardSales || 0;
  const qrSales = metrics.qrSales || 0;
  const creditSales = metrics.creditSales || 0;
  const openingFloat = metrics.openingFloat || 0;
  const totalCashIn = metrics.totalCashIn || 0;
  const totalCashOut = metrics.totalCashOut || 0;
  const totalSafeDrops = metrics.totalSafeDrops || 0;
  const expectedCash = metrics.expectedCash || (openingFloat + cashSales + totalCashIn - totalCashOut - totalSafeDrops);
  const totalVat = metrics.totalVat || 0;
  const taxableAmount = totalSales > 0 ? Number((totalSales / 1.13).toFixed(2)) : 0;
  const totalDiscounts = metrics.totalDiscounts || 0;
  const totalOrders = metrics.totalOrders || 0;

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const openedAtStr = shiftData?.shift?.openedAt
    ? new Date(shiftData.shift.openedAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/70 overflow-y-auto p-6 space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
              Shift X-Reading Report
            </span>
            <span className="text-xs font-bold text-slate-500">
              Terminal: {terminalCode}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Cashier Shift &amp; Drawer Report
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Mid-shift sales reconciliation, tender breakdown, 13% Nepal VAT, and cash drawer balance for <strong className="text-slate-900 font-bold">{activeCashier?.name || 'Cashier'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchShiftReport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 transition shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-slate-600' : 'text-slate-600'}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Official X-Slip</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Total Net Sales</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            Rs. {formatNepaliNumber(String(totalSales))}
          </div>
          <span className="text-[11px] text-emerald-700 font-bold block mt-1">
            {totalOrders} Bills generated
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Expected Cash in Till</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Banknote className="h-4 w-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            Rs. {formatNepaliNumber(String(expectedCash))}
          </div>
          <span className="text-[11px] text-amber-800 font-bold block mt-1">
            Float + Cash collections
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">13% Nepal VAT</span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <Receipt className="h-4 w-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            Rs. {formatNepaliNumber(String(totalVat))}
          </div>
          <span className="text-[11px] text-slate-600 font-semibold block mt-1">
            Taxable: Rs. {formatNepaliNumber(String(taxableAmount))}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Total Discounts</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Sparkles className="h-4 w-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            Rs. {formatNepaliNumber(String(totalDiscounts))}
          </div>
          <span className="text-[11px] text-purple-800 font-bold block mt-1">
            Line &amp; bill discounts
          </span>
        </div>
      </div>

      {/* 3. Detailed Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Left Col: Tender Breakdown */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Sales by Tender Method
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs">
              <span className="flex items-center gap-2.5 font-bold text-slate-800">
                <span className="p-1.5 rounded-lg bg-emerald-500 text-white">
                  <Banknote className="h-3.5 w-3.5" />
                </span>
                <span>Cash Collections</span>
              </span>
              <span className="font-mono font-black text-slate-900 text-sm">
                Rs. {formatNepaliNumber(String(cashSales))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs">
              <span className="flex items-center gap-2.5 font-bold text-slate-800">
                <span className="p-1.5 rounded-lg bg-blue-500 text-white">
                  <CreditCard className="h-3.5 w-3.5" />
                </span>
                <span>Card (EDC / SCT / Visa)</span>
              </span>
              <span className="font-mono font-black text-slate-900 text-sm">
                Rs. {formatNepaliNumber(String(cardSales))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 text-xs">
              <span className="flex items-center gap-2.5 font-bold text-slate-800">
                <span className="p-1.5 rounded-lg bg-purple-500 text-white">
                  <QrCode className="h-3.5 w-3.5" />
                </span>
                <span>Dynamic QR (Fonepay / eSewa)</span>
              </span>
              <span className="font-mono font-black text-slate-900 text-sm">
                Rs. {formatNepaliNumber(String(qrSales))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs">
              <span className="flex items-center gap-2.5 font-bold text-slate-800">
                <span className="p-1.5 rounded-lg bg-amber-500 text-white">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span>Customer Credit / Khata</span>
              </span>
              <span className="font-mono font-black text-slate-900 text-sm">
                Rs. {formatNepaliNumber(String(creditSales))}
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Cash Drawer Reconciliation */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Cash Drawer Reconciliation
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-700 font-bold">(+) Opening Float (BOD)</span>
              <span className="font-mono font-black text-slate-900">
                Rs. {formatNepaliNumber(String(openingFloat))}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-emerald-900 font-bold">(+) Cash Sales Received</span>
              <span className="font-mono font-black text-emerald-800">
                Rs. {formatNepaliNumber(String(cashSales))}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <span className="text-blue-900 font-bold">(+) Cash Additions (Paid In)</span>
              <span className="font-mono font-black text-blue-800">
                Rs. {formatNepaliNumber(String(totalCashIn))}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
              <span className="text-rose-900 font-bold">(-) Petty Cash Payouts</span>
              <span className="font-mono font-black text-rose-800">
                Rs. {formatNepaliNumber(String(totalCashOut))}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
              <span className="text-rose-900 font-bold">(-) Safe Drops</span>
              <span className="font-mono font-black text-rose-800">
                Rs. {formatNepaliNumber(String(totalSafeDrops))}
              </span>
            </div>

            <div className="flex justify-between items-center p-3.5 rounded-2xl bg-amber-100/70 border-2 border-amber-300 text-sm font-black text-slate-900 mt-2">
              <span className="text-amber-950 font-black">(=) Expected Cash in Till</span>
              <span className="font-mono text-amber-950 font-black text-base">
                Rs. {formatNepaliNumber(String(expectedCash))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Thermal Slip Preview (Rendered on screen & prints on 80mm roll) */}
      <div className="flex justify-center pt-2">
        <div className="w-full max-w-md bg-white p-6 rounded-3xl border border-slate-300 shadow-xl text-slate-950 font-mono text-xs space-y-3 print:border-none print:shadow-none print:p-0">
          <div className="text-center border-b border-dashed border-slate-400 pb-3">
            <h2 className="text-base font-black tracking-tight uppercase text-slate-950">ICC Electronics</h2>
            <p className="text-[10px] text-slate-700 font-bold">Intel Computer Center | New Road, Kathmandu</p>
            <p className="text-[10px] text-slate-700">PAN: 601234567 | Reg: {terminalCode}</p>
            <div className="my-1.5 py-0.5 px-2 bg-slate-100 text-[10px] font-black uppercase tracking-wider border-y border-dashed border-slate-400 text-slate-900">
              *** CASHIER SHIFT X-REPORT ***
            </div>
            <div className="text-[10px] text-slate-700 text-left grid grid-cols-2 gap-y-0.5 mt-2">
              <div><strong>Cashier:</strong> {activeCashier?.name || 'Cashier'}</div>
              <div className="text-right"><strong>Staff ID:</strong> {activeCashier?.staffCode || 'CASHIER'}</div>
              <div><strong>Opened:</strong> {openedAtStr}</div>
              <div className="text-right"><strong>Report:</strong> {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Sales Summary */}
          <div className="space-y-1 border-b border-dashed border-slate-400 pb-2 text-[11px]">
            <div className="flex justify-between font-bold text-slate-900">
              <span>Total Transactions:</span>
              <span>{totalOrders}</span>
            </div>
            <div className="flex justify-between font-black text-xs text-slate-950">
              <span>GROSS SALES:</span>
              <span>NPR {formatNepaliNumber(String(totalSales))}</span>
            </div>
            <div className="flex justify-between text-slate-700 text-[10px]">
              <span>Taxable Amount:</span>
              <span>NPR {formatNepaliNumber(String(taxableAmount))}</span>
            </div>
            <div className="flex justify-between text-slate-700 text-[10px]">
              <span>13% Nepal VAT:</span>
              <span>NPR {formatNepaliNumber(String(totalVat))}</span>
            </div>
            <div className="flex justify-between text-slate-700 text-[10px]">
              <span>Total Discounts:</span>
              <span>NPR {formatNepaliNumber(String(totalDiscounts))}</span>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="space-y-1 border-b border-dashed border-slate-400 pb-2 text-[10px]">
            <span className="font-bold uppercase block text-slate-700">Tender Collections:</span>
            <div className="flex justify-between text-slate-900">
              <span>Cash Payments:</span>
              <span>NPR {formatNepaliNumber(String(cashSales))}</span>
            </div>
            <div className="flex justify-between text-slate-900">
              <span>Card / POS EDC:</span>
              <span>NPR {formatNepaliNumber(String(cardSales))}</span>
            </div>
            <div className="flex justify-between text-slate-900">
              <span>Dynamic QR:</span>
              <span>NPR {formatNepaliNumber(String(qrSales))}</span>
            </div>
            <div className="flex justify-between text-slate-900">
              <span>Customer Khata:</span>
              <span>NPR {formatNepaliNumber(String(creditSales))}</span>
            </div>
          </div>

          {/* Drawer Reconciliation */}
          <div className="space-y-1 border-b border-dashed border-slate-400 pb-2 text-[10px]">
            <span className="font-bold uppercase block text-slate-700">Drawer Cash Audit:</span>
            <div className="flex justify-between text-slate-900">
              <span>Opening Float:</span>
              <span>NPR {formatNepaliNumber(String(openingFloat))}</span>
            </div>
            <div className="flex justify-between text-slate-900">
              <span>(+) Cash Collected:</span>
              <span>NPR {formatNepaliNumber(String(cashSales))}</span>
            </div>
            <div className="flex justify-between font-black text-[11px] pt-1 text-slate-950">
              <span>EXPECTED IN DRAWER:</span>
              <span>NPR {formatNepaliNumber(String(expectedCash))}</span>
            </div>
          </div>

          {/* Signature */}
          <div className="pt-3 text-[9px] text-slate-700 space-y-4">
            <div className="flex justify-between pt-4">
              <div className="text-center border-t border-slate-400 w-[45%] pt-1 font-bold">
                Cashier Signature
              </div>
              <div className="text-center border-t border-slate-400 w-[45%] pt-1 font-bold">
                Supervisor Signature
              </div>
            </div>
            <p className="text-[8px] text-center text-slate-500 font-semibold">
              Official Shift Audit Slip • Retain for Accounts &amp; End of Day
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
