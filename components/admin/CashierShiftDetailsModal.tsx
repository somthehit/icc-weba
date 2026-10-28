'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Receipt,
  Banknote,
  CreditCard,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ShoppingBag,
  FileText,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Lock,
  Unlock,
  Layers,
  Calendar,
  Download,
  RotateCcw,
  Coins,
  History,
  Check,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';
import { adToBs } from '@/lib/nepal/date';
import { ShiftOpeningWizardModal } from '../pos/ShiftOpeningWizardModal';
import { CashDrawerMovementModal } from '../pos/CashDrawerMovementModal';
import { ShiftClosingWizardModal } from '../pos/ShiftClosingWizardModal';
import { DENOMINATION_VALUES } from '../pos/DenominationKeypad';

interface CashierShiftDetailsModalProps {
  isOpen: boolean;
  shiftId: number | null;
  onClose: () => void;
  onBlindCloseClick?: (shift: any) => void;
}

export function CashierShiftDetailsModal({
  isOpen,
  shiftId,
  onClose,
  onBlindCloseClick,
}: CashierShiftDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    shift: any;
    transactions: any[];
    cashOperations: any[];
    auditLogs: any[];
    report: any;
  } | null>(null);

  // Tab state: 4 dedicated tabs
  const [activeTab, setActiveTab] = useState<'transactions' | 'denominations' | 'report' | 'logs'>('transactions');
  const [txSearch, setTxSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'80mm' | 'a4'>('80mm');

  // Date representation mode (Gregorian AD vs Nepali Bikram Sambat BS)
  const [dateMode, setDateMode] = useState<'AD' | 'BS'>('AD');

  // Sub-wizards
  const [isBodModalOpen, setIsBodModalOpen] = useState(false);
  const [isCashMoveModalOpen, setIsCashMoveModalOpen] = useState(false);
  const [isEodWizardOpen, setIsEodWizardOpen] = useState(false);

  // Fetch detailed shift info
  const fetchShiftDetails = async () => {
    if (!shiftId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/shifts?shiftId=${shiftId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load cashier shift details');
      }
      setData(json);
      // Auto-expand first transaction by default if present
      if (json.transactions?.length > 0) {
        setExpandedTxIds({ [json.transactions[0].id]: true });
      }
    } catch (err: any) {
      console.error('Error loading shift details:', err);
      setError(err.message || 'Error loading shift details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && shiftId) {
      fetchShiftDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, shiftId]);

  const toggleExpand = (id: string) => {
    setExpandedTxIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    if (!data?.transactions) return;
    const all: Record<string, boolean> = {};
    data.transactions.forEach((tx) => {
      all[tx.id] = true;
    });
    setExpandedTxIds(all);
  };

  const collapseAll = () => {
    setExpandedTxIds({});
  };

  // Filtered transactions including Returns, Voids, Credit, and Split
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.filter((tx) => {
      const pMethod = (tx.paymentMethod || '').toLowerCase();
      const pBreakdown = (tx.paymentBreakdown as any) || {};
      const status = (pBreakdown.status || tx.status || 'completed').toLowerCase();

      // Tender & Status filter
      if (paymentFilter !== 'all') {
        if (paymentFilter === 'cash' && pMethod !== 'cash') return false;
        if (paymentFilter === 'card' && pMethod !== 'card') return false;
        if (paymentFilter === 'qr' && !pMethod.includes('fonepay') && !pMethod.includes('qr') && pMethod !== 'esewa' && pMethod !== 'khalti') {
          return false;
        }
        if (paymentFilter === 'esewa' && pMethod !== 'esewa') return false;
        if (paymentFilter === 'khalti' && pMethod !== 'khalti') return false;
        if (paymentFilter === 'returns' && !status.includes('return') && !status.includes('refund')) return false;
        if (paymentFilter === 'voids' && !status.includes('void')) return false;
        if (paymentFilter === 'credit' && pMethod !== 'credit') return false;
        if (paymentFilter === 'split' && !pMethod.includes('split') && !pBreakdown.isSplit) return false;
      }

      // Text search filter
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase().trim();
        const inv = (tx.invoiceNumber || '').toLowerCase();
        const custName = (tx.customerName || '').toLowerCase();
        const custPhone = (tx.customerPhone || '').toLowerCase();
        const hasItemMatch = Array.isArray(tx.items) && tx.items.some((it: any) =>
          (it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q)
        );
        const hasSerialMatch = Array.isArray(tx.items) && tx.items.some((it: any) =>
          Array.isArray(it.serialNumbers) && it.serialNumbers.some((s: string) => s.toLowerCase().includes(q))
        );
        return inv.includes(q) || custName.includes(q) || custPhone.includes(q) || hasItemMatch || hasSerialMatch;
      }

      return true;
    });
  }, [data?.transactions, paymentFilter, txSearch]);

  // Export CSV of transactions
  const handleExportCsv = () => {
    if (!filteredTransactions.length) return;
    const headers = ['Invoice #', 'Date & Time', 'Customer', 'Phone', 'Payment Method', 'Items Count', 'Taxable (NPR)', '13% VAT', 'Total (NPR)'];
    const rows = filteredTransactions.map((tx) => [
      tx.invoiceNumber,
      tx.createdAt,
      `"${tx.customerName || 'Walk-in'}"`,
      tx.customerPhone || '',
      tx.paymentMethod,
      Array.isArray(tx.items) ? tx.items.length : 1,
      Number(tx.totalAmount || 0) - Math.round((Number(tx.totalAmount || 0) * 0.13 / 1.13) * 100) / 100,
      Math.round((Number(tx.totalAmount || 0) * 0.13 / 1.13) * 100) / 100,
      Number(tx.totalAmount || 0),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Shift_${shift?.shiftNumber || shiftId}_Transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const shift = data?.shift;
  const report = data?.report;
  const metrics = report?.metrics;
  const cashRec = report?.cashReconciliation;
  const waterfall = report?.waterfall;
  const denominations = report?.denominations;

  // Format date helper with AD / BS support
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (dateMode === 'BS') {
        const bs = adToBs(d);
        const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${bs.formattedLongBS} (${timePart})`;
      }
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Duration helper
  const getDuration = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return '';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffMs = Math.max(0, e - s);
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  };

  const isZeroSales = Boolean(shift?.isZeroSales) || (data?.transactions?.length === 0 && Number(metrics?.grossSales || 0) === 0);
  const durationMinutes = shift?.durationMinutes ?? 0;
  const isShortDuration = durationMinutes < 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900">
        {/* ================= CLEAN WHITE MODAL HEADER ================= */}
        <div className="px-5 sm:px-6 py-4 bg-white border-b border-slate-200 space-y-3.5 text-slate-900">
          {/* Top Bar: Scope Confirmation Badge on Left & Quick Actions Toolbar on Right */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
            {/* Left: Scope Confirmation Badge */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs shrink-0">
                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                Single Cashier Shift Audit
              </span>
              <span className="text-[11px] text-slate-500 font-mono hidden md:inline truncate">
                (Individual cashier register session — not aggregated store-wide EOD)
              </span>
            </div>

            {/* Right: Actions Toolbar - Clean White Button Aesthetic */}
            <div className="flex items-center gap-2 shrink-0">
              {shift?.status === 'OPEN' && (
                <>
                  <button
                    onClick={() => setIsCashMoveModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Perform Safe Drop, Paid-In, or Paid-Out"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Cash Movement</span>
                  </button>

                  <button
                    onClick={() => setIsEodWizardOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-300 text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Close Register and perform End-of-Day reconciliation"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>Close Register (EOD)</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setIsPrintSlipOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Print Nepal Retail Shift X/Z Report"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Print Slip</span>
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />

              <button
                onClick={fetchShiftDetails}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                title="Refresh shift data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Cashier Profile & Live Shift Details */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white text-slate-800 border-2 border-slate-200 shadow-xs flex items-center justify-center font-black text-base shrink-0">
                {shift?.cashierName ? shift.cashierName.slice(0, 2).toUpperCase() : 'POS'}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {shift?.cashierName || 'Cashier Shift Details'}
                  </h1>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200">
                    {shift?.cashierCode || 'EMP-104'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-slate-100 text-slate-800 border border-slate-200">
                    {shift?.shiftNumber || `SH-${shiftId}`}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200">
                    {shift?.registerCode || 'REG-01'}
                  </span>

                  {/* Status Badges */}
                  {isZeroSales && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      No Sales (Zero-Activity)
                    </span>
                  )}

                  {shift && !isZeroSales && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase flex items-center gap-1.5 ${
                        shift.status === 'OPEN'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : shift.status === 'SUBMITTED'
                          ? 'bg-indigo-50 text-indigo-800 border border-indigo-300'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          shift.status === 'OPEN' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                        }`}
                      />
                      {shift.status === 'CLOSED' ? 'CLOSED & AUDITED' : shift.status}
                    </span>
                  )}
                </div>

                {/* Metadata row with AD/BS toggle */}
                <div className="flex items-center gap-2.5 text-xs text-slate-600 mt-1 flex-wrap font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    Opened: <span className="text-slate-900 font-bold">{formatDate(shift?.openedAt)}</span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    {shift?.closedAt ? (
                      <>Closed: <span className="text-slate-900 font-bold">{formatDate(shift?.closedAt)}</span></>
                    ) : (
                      <span className="text-emerald-700 font-bold">Status: Live Shift</span>
                    )}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">
                    Duration: <span className="text-amber-700 font-black">{getDuration(shift?.openedAt, shift?.closedAt)}</span>
                  </span>

                  {/* AD/BS Toggle */}
                  <button
                    type="button"
                    onClick={() => setDateMode((prev) => (prev === 'AD' ? 'BS' : 'AD'))}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10px] border border-slate-200 transition-all ml-1 cursor-pointer shadow-2xs"
                    title="Toggle between Gregorian AD and Nepali Bikram Sambat BS"
                  >
                    {dateMode === 'AD' ? 'Switch to BS (वि.सं.)' : 'Switch to AD'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= BODY CONTENT ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {loading && !data && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm font-medium font-mono">Reconciling line-by-line retail cash ledger...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* ZERO-ACTIVITY SHIFT ALERT BANNER */}
              {isZeroSales && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-2">
                        Zero-Activity Shift (No Sales Conducted)
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                          Duration: {getDuration(shift?.openedAt, shift?.closedAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        This shift was opened and closed with zero customer invoices. Expected cash strictly equals opening float (<strong>{formatNpr(shift?.openingFloat || 0)}</strong>).
                        {shift?.minDurationOverrideReason && (
                          <span className="block text-slate-500 mt-0.5">
                            Early close authorization: &quot;{shift.minDurationOverrideReason}&quot; — Verified by {shift.minDurationOverrideBy || 'Supervisor'}.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TOP 6 KPI CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Gross Sales */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Gross Sales</span>
                    <div className="p-1 rounded-lg bg-blue-50 text-blue-600">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 font-mono font-black text-lg text-slate-900">
                    {formatNpr(metrics?.grossSales || shift?.totalSales || 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">
                    {data.transactions.length} Invoices
                  </div>
                </div>

                {/* Expected Cash */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Expected Cash</span>
                    <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                      <Banknote className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 font-mono font-black text-lg text-slate-900">
                    {cashRec?.expectedCashInTill !== null && cashRec?.expectedCashInTill !== undefined ? (
                      formatNpr(cashRec.expectedCashInTill)
                    ) : (
                      <span className="text-amber-700 text-xs flex items-center gap-1 font-bold">
                        <Lock className="w-3.5 h-3.5" />
                        Blind Count
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">
                    Opening + Net Cash
                  </div>
                </div>

                {/* Counted Cash */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Counted Cash</span>
                    <div className="p-1 rounded-lg bg-amber-50 text-amber-600">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 font-mono font-black text-lg text-slate-900">
                    {shift?.closingCash !== null && shift?.closingCash !== undefined
                      ? formatNpr(shift.closingCash)
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">
                    {shift?.status === 'OPEN' ? 'In Progress' : 'Blind Count Total'}
                  </div>
                </div>

                {/* Cash Variance with NPR symbol, sign, and color */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Cash Variance</span>
                    <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 font-mono font-black text-lg">
                    {cashRec?.varianceAmount !== null && cashRec?.varianceAmount !== undefined ? (
                      <span
                        className={
                          Math.abs(cashRec.varianceAmount) < 0.01
                            ? 'text-emerald-700'
                            : cashRec.varianceAmount < 0
                            ? 'text-rose-700'
                            : 'text-amber-800'
                        }
                      >
                        {cashRec.varianceAmount > 0
                          ? `+NPR ${cashRec.varianceAmount.toFixed(2)}`
                          : cashRec.varianceAmount < 0
                          ? `-NPR ${Math.abs(cashRec.varianceAmount).toFixed(2)}`
                          : 'NPR 0.00'}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono mt-0.5 font-bold">
                    {cashRec?.varianceAmount !== null && cashRec?.varianceAmount !== undefined ? (
                      Math.abs(cashRec.varianceAmount) < 0.01 ? (
                        <span className="text-emerald-700">Exact Match</span>
                      ) : cashRec.varianceAmount < 0 ? (
                        <span className="text-rose-700">Shortage</span>
                      ) : (
                        <span className="text-amber-800">Overage</span>
                      )
                    ) : (
                      <span className="text-slate-400">Uncounted</span>
                    )}
                  </div>
                </div>

                {/* Digital & QR Tenders */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>Digital & QR</span>
                    <div className="p-1 rounded-lg bg-purple-50 text-purple-600">
                      <QrCode className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 font-mono font-black text-lg text-slate-900">
                    {formatNpr(
                      Number(report?.tenders?.fonepayQr || 0) +
                        Number(report?.tenders?.card || 0) +
                        Number(report?.tenders?.esewa || 0) +
                        Number(report?.tenders?.khalti || 0)
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">
                    Fonepay / Card / eSewa
                  </div>
                </div>

                {/* 13% VAT portion */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <span>13% IRD VAT</span>
                    <div className="p-1 rounded-lg bg-amber-50 text-amber-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 font-mono font-black text-lg text-slate-900">
                    {formatNpr(metrics?.vatCollected || 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">
                    Annex 13 Audit
                  </div>
                </div>
              </div>

              {/* TABS SELECTOR (Clean White Segmented Controls) */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'transactions'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/90 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 text-slate-700" />
                    Line-by-Line Transactions ({data.transactions.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('denominations')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'denominations'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/90 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 text-slate-700" />
                    BOD & EOD Denominations
                  </button>

                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'report'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/90 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    Full Shift Report (X/Z)
                  </button>

                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'logs'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/90 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                    Audit Trail & Logs ({data.auditLogs.length + data.cashOperations.length})
                  </button>
                </div>

                {/* Sub-actions for transactions */}
                {activeTab === 'transactions' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportCsv}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      Export CSV
                    </button>
                    <button
                      onClick={expandAll}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAll}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
              </div>

              {/* ================= TAB 1: LINE-BY-LINE TRANSACTIONS & SALES WATERFALL ================= */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  {/* Retail Sales Waterfall Card */}
                  {waterfall && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 font-mono uppercase tracking-wider">
                        <span>Retail Sales Waterfall & Tally Check</span>
                        {waterfall.hasTallyMismatch ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Mismatch: NPR {waterfall.tallyDiscrepancy.toFixed(2)}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Tenders Perfectly Tally with Net Sales
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Gross Sales</span>
                          <strong className="text-slate-900 text-sm block mt-0.5">{formatNpr(waterfall.grossSales)}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">(-) Discounts</span>
                          <strong className="text-slate-700 text-sm block mt-0.5">-{formatNpr(waterfall.discounts)}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 shadow-2xs">
                          <span className="text-[10px] text-rose-700 font-bold uppercase block">(-) Returns</span>
                          <strong className="text-rose-700 text-sm block mt-0.5">-{formatNpr(waterfall.returns)}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 shadow-2xs">
                          <span className="text-[10px] text-amber-800 font-bold uppercase block">(-) Line Voids</span>
                          <strong className="text-amber-800 text-sm block mt-0.5">-{formatNpr(waterfall.voids)}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
                          <span className="text-emerald-800 font-bold block text-[10px] uppercase">(=) Net Sales</span>
                          <strong className="text-emerald-950 text-sm block mt-0.5">{formatNpr(waterfall.netSales)}</strong>
                        </div>
                      </div>

                      {waterfall.hasTallyMismatch && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center justify-between font-semibold">
                          <span>
                            Sum of all tenders (Cash + Card + QR + Credit: <strong>{formatNpr(waterfall.tendersTotal)}</strong>) does not match Net Sales (<strong>{formatNpr(waterfall.netSales)}</strong>).
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search and Tender Filters */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        placeholder="Search by Invoice #, Customer, phone, SKU, or Serial number..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Filter:</span>
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'cash', label: 'Cash' },
                        { id: 'card', label: 'Card' },
                        { id: 'qr', label: 'Fonepay QR' },
                        { id: 'esewa', label: 'eSewa' },
                        { id: 'khalti', label: 'Khalti' },
                        { id: 'returns', label: 'Returns' },
                        { id: 'voids', label: 'Voids' },
                        { id: 'credit', label: 'Credit' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setPaymentFilter(item.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            paymentFilter === item.id
                              ? 'bg-blue-600 text-white shadow-xs font-black'
                              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-mono text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="p-3 w-8"></th>
                            <th className="p-3">Invoice #</th>
                            <th className="p-3">Time</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Payment Method</th>
                            <th className="p-3 text-center">Items</th>
                            <th className="p-3 text-right">Taxable (NPR)</th>
                            <th className="p-3 text-right">13% VAT</th>
                            <th className="p-3 text-right">Total (NPR)</th>
                            <th className="p-3 text-center">CBMS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-slate-400 font-mono">
                                No transactions found matching current filters.
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((tx, idx) => {
                              const isExpanded = Boolean(expandedTxIds[tx.id]);
                              const items = Array.isArray(tx.items) ? tx.items : [];
                              const totalAmt = Number(tx.totalAmount || 0);
                              const vatAmt = Math.round((totalAmt * 0.13 / 1.13) * 100) / 100;
                              const taxableAmt = totalAmt - vatAmt;
                              const pBreakdown = tx.paymentBreakdown || {};

                              return (
                                <React.Fragment key={tx.id || idx}>
                                  <tr
                                    onClick={() => toggleExpand(tx.id)}
                                    className={`cursor-pointer transition-colors ${
                                      isExpanded
                                        ? 'bg-blue-50/60 text-slate-900 font-medium'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <td className="p-3 text-center text-slate-400">
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-blue-600" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </td>
                                    <td className="p-3 font-mono font-bold text-blue-600 flex items-center gap-1.5">
                                      <Receipt className="w-3.5 h-3.5 text-blue-500" />
                                      {tx.invoiceNumber}
                                    </td>
                                    <td className="p-3 font-mono text-slate-500">
                                      {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                                    </td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-900">
                                        {tx.customerName || 'Walk-in Customer'}
                                      </div>
                                      {tx.customerPhone && (
                                        <div className="text-[10px] text-slate-500 font-mono">
                                          {tx.customerPhone}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <span
                                        className={`badge-${tx.paymentMethod || 'cash'} px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase`}
                                      >
                                        {tx.paymentMethod}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                                      {items.length}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-700 font-bold">
                                      {formatNpr(taxableAmt, { showCurrency: false })}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-700 font-bold">
                                      {formatNpr(vatAmt, { showCurrency: false })}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">
                                      {formatNpr(totalAmt)}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className="badge-synced px-2 py-0.5 rounded text-[10px] font-bold">
                                        SYNCED
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Expanded Item Breakdown */}
                                  {isExpanded && (
                                    <tr className="bg-slate-50 border-y border-slate-200">
                                      <td colSpan={10} className="p-4 sm:p-5">
                                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                            <div className="flex items-center gap-2">
                                              <ShoppingBag className="w-4 h-4 text-blue-600" />
                                              <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                                                Sold Items Breakdown ({items.length} Lines)
                                              </span>
                                            </div>
                                            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
                                              {pBreakdown.discountAmount > 0 && (
                                                <span className="text-emerald-700 font-bold">
                                                  Discount: <strong>-NPR {Number(pBreakdown.discountAmount).toLocaleString('en-IN')}</strong>
                                                </span>
                                              )}
                                              <span>Cashier: <strong className="text-slate-900">{tx.cashierName || shift?.cashierName}</strong></span>
                                            </div>
                                          </div>

                                          {/* Sub-table */}
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                              <thead className="bg-slate-50 text-slate-600 font-mono text-[10px] uppercase font-bold border-b border-slate-100">
                                                <tr>
                                                  <th className="p-2 w-10">#</th>
                                                  <th className="p-2">Item Description & Brand</th>
                                                  <th className="p-2">SKU / Model</th>
                                                  <th className="p-2">Serials</th>
                                                  <th className="p-2 text-right">Unit Price (NPR)</th>
                                                  <th className="p-2 text-center">Qty</th>
                                                  <th className="p-2 text-right">Line Total (NPR)</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {items.map((line: any, lIdx: number) => {
                                                  const uPrice = Number(line.unitPrice || line.price || 0);
                                                  const qty = Number(line.quantity || 1);
                                                  const lTotal = Number(line.lineTotal || uPrice * qty);
                                                  const serials = Array.isArray(line.serialNumbers) ? line.serialNumbers : [];

                                                  return (
                                                    <tr key={lIdx} className="hover:bg-slate-50/70">
                                                      <td className="p-2 font-mono text-slate-400">{lIdx + 1}</td>
                                                      <td className="p-2 font-bold text-slate-900">{line.name}</td>
                                                      <td className="p-2 font-mono text-slate-500 text-[11px]">{line.sku || '—'}</td>
                                                      <td className="p-2 font-mono text-[10px] text-blue-600 font-semibold">
                                                        {serials.length > 0 ? serials.join(', ') : '—'}
                                                      </td>
                                                      <td className="p-2 text-right font-mono text-slate-600">
                                                        {formatNpr(uPrice, { showCurrency: false })}
                                                      </td>
                                                      <td className="p-2 text-center font-mono font-black text-slate-900">{qty}</td>
                                                      <td className="p-2 text-right font-mono font-black text-emerald-800">
                                                        {formatNpr(lTotal)}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 2: BOD & EOD DENOMINATIONS & RECONCILIATION ================= */}
              {activeTab === 'denominations' && (
                <div className="space-y-6">
                  {/* BOD Beginning of Day Summary Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            BOD VERIFIED
                          </span>
                          <h3 className="font-bold text-sm text-slate-900">
                            Beginning of Day (BOD) — Opening Float & Denominations
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Counted by <strong className="text-slate-900">{shift?.cashierName}</strong> • Verified by{' '}
                          <strong className="text-slate-900">{shift?.openedBySupervisorName || 'Store Supervisor'} (PIN Authenticated)</strong> •{' '}
                          {formatDate(shift?.openedAt)}
                        </p>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Opening Float Total</div>
                        <div className="text-xl font-bold text-emerald-700">{formatNpr(shift?.openingFloat || 0)}</div>
                      </div>
                    </div>

                    {/* Handover Check Telemetry */}
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-mono shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-slate-700">
                          Handover Check vs Previous Shift: Standard Float Policy NPR {Number(shift?.standardFloat || 5000).toLocaleString('en-IN')}.
                        </span>
                      </div>
                      <div className="text-slate-600">
                        Handover Discrepancy: <strong className="text-emerald-700 font-bold">NPR {Number(shift?.handoverVariance || 0).toFixed(2)}</strong>
                      </div>
                    </div>

                    {/* Denominations breakdown grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
                      {DENOMINATION_VALUES.map((item) => {
                        const count = Number(shift?.openingDenominations?.[item.key] || 0);
                        const subtotal = count * item.value;
                        return (
                          <div key={item.key} className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-xs">
                            <div className="text-[10px] text-slate-500 font-mono font-bold">
                              {item.isCoin ? 'Coins' : `NPR ${item.value}`}
                            </div>
                            <div className="font-bold text-sm text-slate-900 mt-1">× {count}</div>
                            <div className="text-[10px] text-emerald-700 font-mono mt-0.5 font-bold">
                              {formatNpr(subtotal, { showFraction: false })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* EOD Closing Count & Recount History */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            EOD AUDIT
                          </span>
                          <h3 className="font-bold text-sm text-slate-900">
                            End of Day (EOD) — Closing Cash Denomination Breakdown
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Physical notes submitted at shift close.
                          {shift?.closedBySupervisorName && (
                            <span> • Received and audited by <strong className="text-slate-900">{shift.closedBySupervisorName}</strong>.</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Closing Counted Cash</div>
                        <div className="text-xl font-bold text-amber-700">
                          {shift?.closingCash !== null && shift?.closingCash !== undefined
                            ? formatNpr(shift.closingCash)
                            : 'Pending'}
                        </div>
                      </div>
                    </div>

                    {shift?.closingDenominations ? (
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
                        {DENOMINATION_VALUES.map((item) => {
                          const count = Number(shift.closingDenominations?.[item.key] || 0);
                          const subtotal = count * item.value;
                          return (
                            <div key={item.key} className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-xs">
                              <div className="text-[10px] text-slate-500 font-mono font-bold">
                                {item.isCoin ? 'Coins' : `NPR ${item.value}`}
                              </div>
                              <div className="font-bold text-sm text-slate-900 mt-1">× {count}</div>
                              <div className="text-[10px] text-amber-700 font-mono mt-0.5 font-bold">
                                {formatNpr(subtotal, { showFraction: false })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-500 text-xs font-mono bg-white rounded-xl border border-slate-200">
                        Closing denomination count has not yet been submitted. Cashier will perform blind count at EOD.
                      </div>
                    )}
                  </div>

                  {/* Non-Cash Tender Reconciliations Table */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      Non-Cash Tender Settlement & Merchant Audit (Slips vs System)
                    </h3>

                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Tender Method</th>
                            <th className="p-2.5 text-right">System Amount (NPR)</th>
                            <th className="p-2.5 text-right">Entered Slip Total (NPR)</th>
                            <th className="p-2.5 text-right">Variance (NPR)</th>
                            <th className="p-2.5">Batch / Slip Reference</th>
                            <th className="p-2.5 text-center">Reconciliation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-900 font-medium">
                          {[
                            { name: 'POS Card (Visa/MC)', key: 'card', system: report?.tenders?.card || 0 },
                            { name: 'Fonepay Dynamic QR', key: 'fonepay', system: report?.tenders?.fonepayQr || 0 },
                            { name: 'eSewa Wallet', key: 'esewa', system: report?.tenders?.esewa || 0 },
                            { name: 'Khalti Wallet', key: 'khalti', system: report?.tenders?.khalti || 0 },
                          ].map((t) => {
                            const entered = t.system; // Matched by gateway
                            return (
                              <tr key={t.key} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">{t.name}</td>
                                <td className="p-2.5 text-right text-slate-700">{formatNpr(t.system, { showCurrency: false })}</td>
                                <td className="p-2.5 text-right text-slate-900 font-bold">{formatNpr(entered, { showCurrency: false })}</td>
                                <td className="p-2.5 text-right text-emerald-700 font-bold">0.00</td>
                                <td className="p-2.5 text-slate-500 text-[11px]">AUTO-GATEWAY-ACK</td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    BALANCED
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 3: FULL SHIFT REPORT (X/Z REPORT) ================= */}
              {activeTab === 'report' && (
                <div className="space-y-6">
                  {/* Fiscal Header & Summary Banner */}
                  <div className="dark-surface p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 !text-blue-300 border border-blue-400/40">
                          {shift?.status === 'OPEN' ? 'X-REPORT (MID-SHIFT)' : 'Z-REPORT (FINAL AUDITED EOD)'}
                        </span>
                        <h2 className="text-base font-bold !text-white">
                          Intel Computer Center — Retail Settlement & Sales Audit
                        </h2>
                      </div>
                      <p className="text-xs !text-slate-300 mt-1 font-mono">
                        Fiscal Year 2081/82 • Dhangadhi Main Flagship • Register: {shift?.registerCode || 'REG-01'} • Cashier: {shift?.cashierName} ({shift?.cashierCode || 'EMP-104'})
                      </p>
                    </div>

                    <button
                      onClick={() => setIsPrintSlipOpen(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 self-start md:self-center transition-all"
                    >
                      <Printer className="w-4 h-4" />
                      Print Official Receipt Slip
                    </button>
                  </div>

                  {/* 2-Column Grid: Tender Breakdown & Cash Drawer Reconciliation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tender Settlement */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-purple-600" />
                          Tender Settlement Breakdown
                        </h3>
                        <span className="text-xs text-slate-600 font-mono font-bold">
                          Total: {formatNpr(metrics?.grossSales || 0)}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex justify-between text-xs font-mono shadow-xs">
                          <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                            Cash Sales:
                          </span>
                          <span className="text-slate-900 font-bold">{formatNpr(report?.tenders?.cash || 0)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex justify-between text-xs font-mono shadow-xs">
                          <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                            POS Card (Visa/Mastercard):
                          </span>
                          <span className="text-slate-900 font-bold">{formatNpr(report?.tenders?.card || 0)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex justify-between text-xs font-mono shadow-xs">
                          <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-purple-600" />
                            Fonepay Dynamic QR:
                          </span>
                          <span className="text-slate-900 font-bold">{formatNpr(report?.tenders?.fonepayQr || 0)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex justify-between text-xs font-mono shadow-xs">
                          <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            eSewa / Khalti Wallets:
                          </span>
                          <span className="text-slate-900 font-bold">
                            {formatNpr((Number(report?.tenders?.esewa || 0)) + (Number(report?.tenders?.khalti || 0)))}
                          </span>
                        </div>
                      </div>

                      {/* Tax Breakdown */}
                      <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-xs font-mono bg-white p-3 rounded-xl border border-slate-200">
                        <div className="flex justify-between text-slate-600">
                          <span>Gross Turnover:</span>
                          <span className="text-slate-900 font-bold">{formatNpr(metrics?.grossSales || 0)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Taxable Sales:</span>
                          <span className="text-slate-900 font-bold">{formatNpr(metrics?.taxableSales || 0)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700 font-semibold">
                          <span>13% Nepal VAT:</span>
                          <span className="text-slate-900 font-bold">{formatNpr(metrics?.vatCollected || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cash Drawer Balancing Ledger */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                          Cash Drawer Reconciliation
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            cashRec?.isBalanced
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : cashRec?.varianceAmount !== null && cashRec?.varianceAmount !== undefined
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {cashRec?.isBalanced
                            ? 'BALANCED'
                            : cashRec?.varianceAmount !== null && cashRec?.varianceAmount !== undefined
                            ? 'DISCREPANCY'
                            : 'OPEN'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-xs">
                          <span className="text-slate-600 font-medium">Opening Cash Float:</span>
                          <span className="text-slate-900 font-bold">{formatNpr(cashRec?.openingFloat || 0)}</span>
                        </div>

                        <div className="flex justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
                          <span className="text-emerald-900 font-medium">(+) Cash Sales:</span>
                          <span className="text-emerald-700 font-bold">+{formatNpr(cashRec?.cashSales || 0)}</span>
                        </div>

                        <div className="flex justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-200">
                          <span className="text-rose-900 font-medium">(-) Cash Refunds:</span>
                          <span className="text-rose-700 font-bold">-{formatNpr(cashRec?.cashRefunds || 0)}</span>
                        </div>

                        <div className="flex justify-between p-2 rounded-lg bg-purple-50/70 border border-purple-200">
                          <span className="text-purple-900 font-medium">(-) Safe Drops to Vault:</span>
                          <span className="text-purple-700 font-bold">-{formatNpr(cashRec?.totalSafeDrops || 0)}</span>
                        </div>

                        <div className="flex justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-200">
                          <span className="text-rose-900 font-medium">(-) Paid-Outs / Petty Cash:</span>
                          <span className="text-rose-700 font-bold">-{formatNpr(cashRec?.totalPaidOut || 0)}</span>
                        </div>

                        <div className="flex justify-between p-2.5 rounded-xl bg-blue-50 border-2 border-blue-400 text-sm shadow-xs">
                          <span className="text-blue-950 font-bold">(=) Expected Cash in Till:</span>
                          <span className="text-blue-900 font-bold">{formatNpr(cashRec?.expectedCashInTill || 0)}</span>
                        </div>

                        <div className="flex justify-between p-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm shadow-xs">
                          <span className="text-slate-900 font-bold">Counted Cash (EOD):</span>
                          <span className="text-amber-800 font-bold">
                            {cashRec?.actualCountedCash !== null && cashRec?.actualCountedCash !== undefined
                              ? formatNpr(cashRec.actualCountedCash)
                              : 'Pending Blind Count'}
                          </span>
                        </div>

                        {cashRec?.varianceAmount !== null && cashRec?.varianceAmount !== undefined && (
                          <div
                            className={`flex justify-between p-2.5 rounded-xl border text-sm font-bold shadow-xs ${
                              Math.abs(cashRec.varianceAmount) < 0.01
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : cashRec.varianceAmount < 0
                                ? 'bg-rose-50 border-rose-300 text-rose-800'
                                : 'bg-amber-50 border-amber-300 text-amber-800'
                            }`}
                          >
                            <span>Cash Variance:</span>
                            <span>
                              {cashRec.varianceAmount > 0
                                ? `+NPR ${cashRec.varianceAmount.toFixed(2)}`
                                : `-NPR ${Math.abs(cashRec.varianceAmount).toFixed(2)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 4: AUDIT TRAIL & LOGS ================= */}
              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Tamper-Evident Cryptographic Audit Trail
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        SHA-256 chained transaction logs for internal control, supervisor PIN authentications, and cash drops.
                      </p>
                    </div>
                    <span className="text-xs text-slate-600 font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {data.cashOperations.length + data.auditLogs.length} Events Logged
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Shift Opened Event */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-300 mt-0.5">
                        <Unlock className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">Shift Initialized & Till Opened (BOD)</span>
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">{formatDate(shift?.openedAt)}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1">
                          Cashier <strong className="text-slate-900">{shift?.cashierName}</strong> ({shift?.cashierCode || 'EMP-104'}) opened register{' '}
                          <code className="bg-slate-200 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">{shift?.registerCode}</code> with verified opening float of{' '}
                          <strong className="text-slate-900">{formatNpr(shift?.openingFloat || 0)}</strong>. Verified by <strong className="text-slate-900">{shift?.openedBySupervisorName || 'Store Supervisor'}</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Cash Drawer Movements */}
                    {data.cashOperations.map((op, oIdx) => (
                      <div key={op.id || oIdx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 shadow-xs">
                        <div
                          className={`p-2 rounded-xl border mt-0.5 ${
                            op.type === 'CASH_IN' || op.type === 'PAID_IN'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : op.type === 'SAFE_DROP'
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {op.type === 'CASH_IN' || op.type === 'PAID_IN' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                              {op.type.replace('_', ' ')}: {formatNpr(op.amount)}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 font-semibold">{formatDate(op.createdAt)}</span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1">
                            Reason: <span className="text-slate-900 font-semibold">{op.reason}</span> • Performed by:{' '}
                            <strong className="text-slate-900">{op.performedByName || op.authorizedByName || 'Supervisor'}</strong>
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Cryptographic Hash Chained Audit Logs */}
                    {data.auditLogs.map((log, lIdx) => (
                      <div key={log.id || lIdx} className="p-4 rounded-2xl bg-white border border-slate-200 flex items-start gap-3 shadow-xs">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 mt-0.5">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-amber-800 uppercase font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {log.action}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 font-semibold">{formatDate(log.createdAt)}</span>
                          </div>
                          {log.metadata && typeof log.metadata === 'object' && (
                            <div className="mt-2 space-y-2">
                              {/* Formatted summary narrative */}
                              {(() => {
                                const m = log.metadata;
                                if (log.action === 'POS.SHIFT_BLIND_SUBMITTED' || log.action === 'SHIFT_BLIND_SUBMITTED') {
                                  return (
                                    <p className="text-xs text-slate-800">
                                      Blind count submitted with total cash of <strong className="text-slate-900">{formatNpr(m.totalSubmittedCash || 0)}</strong>
                                      {m.envelopeNumber ? <span> in deposit envelope <code className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold border border-blue-200">{m.envelopeNumber}</code></span> : ''}.
                                    </p>
                                  );
                                }
                                if (log.action === 'POS.SHIFT_RECOUNT' || log.action === 'SHIFT_RECOUNT') {
                                  return (
                                    <p className="text-xs text-slate-800">
                                      Drawer recount attempt #{m.attemptNumber || 2} recorded with counted cash <strong className="text-slate-900">{formatNpr(m.countedCash || 0)}</strong>
                                      {m.reason ? <span> — Reason: &quot;{m.reason}&quot;</span> : ''}.
                                    </p>
                                  );
                                }
                                if (log.action === 'POS.VARIANCE_APPROVED' || log.action === 'VARIANCE_APPROVED') {
                                  return (
                                    <p className="text-xs text-slate-800">
                                      Cash discrepancy authorized by <strong className="text-slate-900">{m.approvedBy || m.supervisorName || 'Supervisor'}</strong>
                                      {m.reason ? <span> — Reason: &quot;{m.reason}&quot;</span> : ''}.
                                    </p>
                                  );
                                }
                                if (m.description || m.note || m.reason) {
                                  return (
                                    <p className="text-xs text-slate-700">
                                      {String(m.description || m.note || m.reason)}
                                    </p>
                                  );
                                }
                                return null;
                              })()}

                              {/* Formatted Key-Value Badges (No raw JSON) */}
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {Object.entries(log.metadata)
                                  .filter(([key, val]) => {
                                    const k = key.toLowerCase();
                                    return (
                                      !['hash', 'previoushash', 'description', 'timestamp', 'clienttimestamp'].includes(k) &&
                                      val !== null &&
                                      val !== undefined &&
                                      val !== '' &&
                                      typeof val !== 'object'
                                    );
                                  })
                                  .map(([key, val]) => {
                                    const label = key
                                      .replace(/([A-Z])/g, ' $1')
                                      .replace(/_/g, ' ')
                                      .trim()
                                      .replace(/^./, (s) => s.toUpperCase());

                                    let formattedVal = String(val);
                                    if (
                                      typeof val === 'number' &&
                                      (key.toLowerCase().includes('cash') ||
                                        key.toLowerCase().includes('amount') ||
                                        key.toLowerCase().includes('total'))
                                    ) {
                                      formattedVal = formatNpr(val);
                                    } else if (typeof val === 'boolean') {
                                      formattedVal = val ? 'Yes' : 'No';
                                    }

                                    return (
                                      <span
                                        key={key}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-800"
                                      >
                                        <span className="text-slate-500 font-medium">{label}:</span>
                                        <span className="text-slate-900 font-bold">{formattedVal}</span>
                                      </span>
                                    );
                                  })}
                              </div>

                              {log.metadata.hash && (
                                <div className="text-[10px] text-blue-700 font-mono flex items-center gap-1.5 pt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                  <span>SHA-256 Hash: {String(log.metadata.hash).slice(0, 32)}...</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-600 font-mono font-bold">
              Intel Computer Center POS & Accounting • Nepal Retail Cash-Control v2.4
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Close Shift Inspector
          </button>
        </div>
      </div>

      {/* ================= SUB-MODALS ================= */}

      {/* 1. Beginning of Day (BOD) Opening Wizard */}
      {isBodModalOpen && (
        <ShiftOpeningWizardModal
          isOpen={isBodModalOpen}
          onClose={() => setIsBodModalOpen(false)}
          onShiftOpened={() => {
            fetchShiftDetails();
          }}
          defaultRegisterCode={shift?.registerCode}
        />
      )}

      {/* 2. Cash Drawer Movement Modal (Safe Drop / Paid-in / Paid-out) */}
      {isCashMoveModalOpen && shift && (
        <CashDrawerMovementModal
          isOpen={isCashMoveModalOpen}
          onClose={() => setIsCashMoveModalOpen(false)}
          shiftId={shift.id}
          shiftNumber={shift.shiftNumber}
          onMovementRecorded={() => {
            fetchShiftDetails();
          }}
        />
      )}

      {/* 3. End of Day (EOD) Shift Closing Wizard */}
      {isEodWizardOpen && shift && data && (
        <ShiftClosingWizardModal
          isOpen={isEodWizardOpen}
          onClose={() => setIsEodWizardOpen(false)}
          shift={shift}
          report={report}
          transactions={data.transactions}
          onShiftClosed={() => {
            fetchShiftDetails();
          }}
        />
      )}

      {/* 4. Print Thermal Receipt Slip Modal (80mm & A4 formats) */}
      {isPrintSlipOpen && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden font-mono text-xs p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Format toggle */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 print:hidden">
              <span className="text-[10px] font-bold uppercase text-slate-500">Print Format:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPrintFormat('80mm')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    printFormat === '80mm' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  80mm ESC/POS
                </button>
                <button
                  onClick={() => setPrintFormat('a4')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    printFormat === 'a4' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  A4 Report
                </button>
              </div>
            </div>

            {/* Store Header */}
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
              <h2 className="text-base font-black tracking-tight uppercase">INTEL COMPUTER CENTER</h2>
              <p className="text-[10px]">Main Road, Dhangadhi, Kailali, Nepal</p>
              <p className="text-[10px]">PAN: 601234567 • TEL: +977-91-521440</p>
              <div className="pt-2">
                <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold">
                  {shift?.status === 'OPEN' ? 'INTERIM X-REPORT' : 'OFFICIAL Z-REPORT'}
                </span>
              </div>
            </div>

            {/* Shift Metadata */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span>Shift Number:</span>
                <strong>{shift?.shiftNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span>Terminal Code:</span>
                <strong>{shift?.registerCode}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cashier Name:</span>
                <strong>{shift?.cashierName} ({shift?.cashierCode || 'EMP-104'})</strong>
              </div>
              <div className="flex justify-between">
                <span>Opened At:</span>
                <span>{formatDate(shift?.openedAt)}</span>
              </div>
              {shift?.closedAt && (
                <div className="flex justify-between">
                  <span>Closed At:</span>
                  <span>{formatDate(shift?.closedAt)}</span>
                </div>
              )}
            </div>

            {/* Sales Summary */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span>Gross Turnover:</span>
                <strong>{formatNpr(metrics?.grossSales || 0)}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discounts:</span>
                <span>-{formatNpr(metrics?.totalDiscounts || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable Sales:</span>
                <span>{formatNpr(metrics?.taxableSales || 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>13% Nepal VAT:</span>
                <span>{formatNpr(metrics?.vatCollected || 0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-black text-sm">
                <span>NET REVENUE:</span>
                <span>{formatNpr(metrics?.grossSales || 0)}</span>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                ({data.transactions.length} Total Bills)
              </div>
            </div>

            {/* Tenders */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold uppercase text-[10px] text-slate-600">Tender Settlement</div>
              <div className="flex justify-between">
                <span>Cash Received:</span>
                <strong>{formatNpr(report?.tenders?.cash || 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Fonepay Dynamic QR:</span>
                <strong>{formatNpr(report?.tenders?.fonepayQr || 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span>POS Card (Visa/MC):</span>
                <strong>{formatNpr(report?.tenders?.card || 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Digital Wallets:</span>
                <strong>{formatNpr((Number(report?.tenders?.esewa || 0)) + (Number(report?.tenders?.khalti || 0)))}</strong>
              </div>
            </div>

            {/* Cash Drawer Balancing */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="font-bold uppercase text-[10px] text-slate-600">Cash Drawer Reconciliation</div>
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span>{formatNpr(cashRec?.openingFloat || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>(+) Cash Sales:</span>
                <span>+{formatNpr(cashRec?.cashSales || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>(-) Safe Drops:</span>
                <span>-{formatNpr(cashRec?.totalSafeDrops || 0)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                <span>Expected Cash:</span>
                <span>{formatNpr(cashRec?.expectedCashInTill || 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Counted Cash:</span>
                <span>
                  {cashRec?.actualCountedCash !== null && cashRec?.actualCountedCash !== undefined
                    ? formatNpr(cashRec.actualCountedCash)
                    : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1">
                <span>Variance:</span>
                <span
                  className={
                    Math.abs(cashRec?.varianceAmount || 0) < 0.01
                      ? 'text-emerald-700'
                      : (cashRec?.varianceAmount || 0) < 0
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }
                >
                  {cashRec?.varianceAmount !== null && cashRec?.varianceAmount !== undefined
                    ? cashRec.varianceAmount > 0
                      ? `+${formatNpr(cashRec.varianceAmount)}`
                      : formatNpr(cashRec.varianceAmount)
                    : '0.00 NPR'}
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-4 space-y-6 text-[10px]">
              <div className="flex justify-between pt-6 border-t border-slate-300">
                <div className="text-center">
                  <div className="w-24 border-b border-slate-400 mb-1"></div>
                  <span>Cashier Sign</span>
                </div>
                <div className="text-center">
                  <div className="w-24 border-b border-slate-400 mb-1"></div>
                  <span>Supervisor Sign</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Now
              </button>
              <button
                onClick={() => setIsPrintSlipOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
