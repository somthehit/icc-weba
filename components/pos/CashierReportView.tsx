'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Printer,
  RefreshCw,
  Clock,
  ShieldCheck,
  Banknote,
  CreditCard,
  QrCode,
  Users,
  CheckCircle2,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  Scissors,
} from 'lucide-react';
import { StaffProfile } from './TerminalDualAuthGate';
import { formatNepaliNumber } from '@/lib/nepal/money';

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
  const [printTimestamp, setPrintTimestamp] = useState('');

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
  const openingFloat = Number(metrics.openingFloat ?? shiftData?.shift?.openingFloat ?? 0);
  const totalSales = Number(metrics.totalSales || 0);
  const cashSales = Number(metrics.cashSales || 0);
  const cardSales = Number(metrics.cardSales || 0);
  const qrSales = Number(metrics.qrSales || 0);
  const creditSales = Number(metrics.creditSales || 0);
  const totalDiscounts = Number(metrics.totalDiscounts || 0);
  const totalVat = Number(metrics.totalVat || 0);
  const taxableAmount = Math.max(0, totalSales - totalVat);
  const totalOrders = Number(metrics.totalOrders || 0);
  const totalCashIn = Number(metrics.totalCashIn || 0);
  const totalCashOut = Number(metrics.totalCashOut || 0);
  const totalSafeDrops = Number(metrics.totalSafeDrops || 0);
  const expectedCash = Number(metrics.expectedCash ?? (openingFloat + cashSales + totalCashIn - totalCashOut - totalSafeDrops));

  const handlePrint = () => {
    setPrintTimestamp(new Date().toLocaleString());
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const openedAtStr = shiftData?.shift?.openedAt
    ? new Date(shiftData.shift.openedAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8faf9] dark:bg-[#0c120f] overflow-y-auto p-6 space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
              Shift X-Reading Report
            </span>
            <span className="text-xs font-bold text-slate-400">
              Terminal: {terminalCode}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-1 tracking-tight">
            Cashier Shift &amp; Drawer Report
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Mid-shift sales reconciliation, tender breakdown, 13% Nepal VAT, and cash drawer balance for <strong className="text-slate-700 dark:text-slate-200">{activeCashier?.name || 'Cashier'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchShiftReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-black shadow-md transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Official X-Slip</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Net Sales</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            Rs. {formatNepaliNumber(String(totalSales))}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
            {totalOrders} Bills generated
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Expected Cash in Till</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            Rs. {formatNepaliNumber(String(expectedCash))}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold block mt-1">
            Float + Cash collections
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">13% Nepal VAT</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            Rs. {formatNepaliNumber(String(totalVat))}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold block mt-1">
            Taxable: Rs. {formatNepaliNumber(String(taxableAmount))}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Discounts</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            Rs. {formatNepaliNumber(String(totalDiscounts))}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold block mt-1">
            Line &amp; bill discounts
          </span>
        </div>
      </div>

      {/* 3. Detailed Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Left Col: Tender Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Sales by Tender Method
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                <Banknote className="h-4 w-4 text-emerald-600" />
                <span>Cash Collections</span>
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(cashSales))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span>Card (EDC / SCT / Visa)</span>
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(cardSales))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                <QrCode className="h-4 w-4 text-purple-600" />
                <span>Dynamic QR (Fonepay / eSewa)</span>
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(qrSales))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                <Users className="h-4 w-4 text-amber-600" />
                <span>Customer Credit / Khata</span>
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                Rs. {formatNepaliNumber(String(creditSales))}
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Cash Drawer Reconciliation */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Cash Drawer Reconciliation
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-semibold">(+) Opening Float (BOD)</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                Rs. {formatNepaliNumber(String(openingFloat))}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-semibold">(+) Cash Sales Received</span>
              <span className="font-mono font-bold text-emerald-600">
                Rs. {formatNepaliNumber(String(cashSales))}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-semibold">(+) Cash Additions (Paid In)</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                Rs. {formatNepaliNumber(String(totalCashIn))}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-semibold">(-) Petty Cash Payouts</span>
              <span className="font-mono font-bold text-rose-600">
                Rs. {formatNepaliNumber(String(totalCashOut))}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-semibold">(-) Safe Drops</span>
              <span className="font-mono font-bold text-rose-600">
                Rs. {formatNepaliNumber(String(totalSafeDrops))}
              </span>
            </div>

            <div className="flex justify-between pt-2 text-sm font-black text-slate-900 dark:text-white">
              <span>(=) Expected Cash in Till</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                Rs. {formatNepaliNumber(String(expectedCash))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Thermal Slip Preview (Rendered on screen & prints on 80mm roll) */}
      <div className="flex justify-center pt-2">
        <div className="w-full max-w-md bg-white p-6 rounded-3xl border border-slate-200 shadow-xl text-slate-900 font-mono text-xs space-y-3 print:border-none print:shadow-none print:p-0">
          <div className="text-center border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-base font-black tracking-tight uppercase">ICC Electronics</h2>
            <p className="text-[10px] text-slate-600 font-bold">Intel Computer Center | New Road, Kathmandu</p>
            <p className="text-[10px] text-slate-600">PAN: 601234567 | Reg: {terminalCode}</p>
            <div className="my-1.5 py-0.5 px-2 bg-slate-100 text-[10px] font-black uppercase tracking-wider border-y border-dashed border-slate-300">
              *** CASHIER SHIFT X-REPORT ***
            </div>
            <div className="text-[10px] text-slate-600 text-left grid grid-cols-2 gap-y-0.5 mt-2">
              <div><strong>Cashier:</strong> {activeCashier?.name || 'Cashier'}</div>
              <div className="text-right"><strong>Staff ID:</strong> {activeCashier?.staffCode || 'CASHIER'}</div>
              <div><strong>Opened:</strong> {openedAtStr}</div>
              <div className="text-right"><strong>Report:</strong> {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Sales Summary */}
          <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[11px]">
            <div className="flex justify-between font-bold">
              <span>Total Transactions:</span>
              <span>{totalOrders}</span>
            </div>
            <div className="flex justify-between font-black text-xs">
              <span>GROSS SALES:</span>
              <span>NPR {formatNepaliNumber(String(totalSales))}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[10px]">
              <span>Taxable Amount:</span>
              <span>NPR {formatNepaliNumber(String(taxableAmount))}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[10px]">
              <span>13% Nepal VAT:</span>
              <span>NPR {formatNepaliNumber(String(totalVat))}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[10px]">
              <span>Total Discounts:</span>
              <span>NPR {formatNepaliNumber(String(totalDiscounts))}</span>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[10px]">
            <span className="font-bold uppercase block text-slate-500">Tender Collections:</span>
            <div className="flex justify-between">
              <span>Cash Payments:</span>
              <span>NPR {formatNepaliNumber(String(cashSales))}</span>
            </div>
            <div className="flex justify-between">
              <span>Card / POS EDC:</span>
              <span>NPR {formatNepaliNumber(String(cardSales))}</span>
            </div>
            <div className="flex justify-between">
              <span>Dynamic QR:</span>
              <span>NPR {formatNepaliNumber(String(qrSales))}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer Khata:</span>
              <span>NPR {formatNepaliNumber(String(creditSales))}</span>
            </div>
          </div>

          {/* Drawer Reconciliation */}
          <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[10px]">
            <span className="font-bold uppercase block text-slate-500">Drawer Cash Audit:</span>
            <div className="flex justify-between">
              <span>Opening Float:</span>
              <span>NPR {formatNepaliNumber(String(openingFloat))}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Cash Collected:</span>
              <span>NPR {formatNepaliNumber(String(cashSales))}</span>
            </div>
            <div className="flex justify-between font-black text-[11px] pt-1">
              <span>EXPECTED IN DRAWER:</span>
              <span>NPR {formatNepaliNumber(String(expectedCash))}</span>
            </div>
          </div>

          {/* Signature */}
          <div className="pt-3 text-[9px] text-slate-600 space-y-4">
            <div className="flex justify-between pt-4">
              <div className="text-center border-t border-slate-400 w-[45%] pt-1 font-bold">
                Cashier Signature
              </div>
              <div className="text-center border-t border-slate-400 w-[45%] pt-1 font-bold">
                Supervisor Signature
              </div>
            </div>
            <p className="text-[8px] text-center text-slate-400">
              Official Shift Audit Slip • Retain for Accounts &amp; End of Day
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
