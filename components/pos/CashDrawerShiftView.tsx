'use client';

import React, { useState, useMemo } from 'react';
import {
  Banknote,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  QrCode,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  History,
  Coins,
  FileText,
  Clock,
  Plus,
  Minus,
  Sparkles,
  Search,
  Printer,
  Download,
  ShieldAlert,
  Eye,
  EyeOff,
  Filter,
  Check,
  X,
  ChevronRight,
  Wallet,
  Building2,
  Receipt,
  Layers,
  PackageCheck,
  Scale,
  BadgeAlert,
} from 'lucide-react';
import { PosStaffUser } from './CashierAuthModal';
import { NEPALI_DENOMINATIONS } from './OpenShiftModal';

interface CashDrawerShiftViewProps {
  activeShift: any | null;
  cashTransactions: any[];
  recentShifts?: any[];
  lastClosedShift?: any | null;
  cashier: PosStaffUser | null;
  registerCode: string;
  theme?: 'dark' | 'light';
  onOpenShiftClick: () => void;
  onCloseShiftClick: () => void;
  onCashOpSuccess: () => void;
}

export const CashDrawerShiftView: React.FC<CashDrawerShiftViewProps> = ({
  activeShift,
  cashTransactions = [],
  recentShifts = [],
  lastClosedShift = null,
  cashier,
  registerCode,
  theme = 'dark',
  onOpenShiftClick,
  onCloseShiftClick,
  onCashOpSuccess,
}) => {
  // View Mode: 'cashier' = Blind Drawer (Operating Hours & Blind Close)
  //            'accountant' = Full Audit & Reconciliation Dashboard
  const [viewMode, setViewMode] = useState<'cashier' | 'accountant'>('cashier');

  // Navigation Sub-Tabs inside Cash Drawer & EOD
  const [subTab, setSubTab] = useState<'dashboard' | 'ledger' | 'denominations' | 'reconciliation' | 'history'>('dashboard');

  // Cash Operations Modal state (+ Cash IN, - Cash OUT, Safe Drop, Petty Cash)
  const [isCashOpOpen, setIsCashOpOpen] = useState(false);
  const [opType, setOpType] = useState<'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP' | 'PETTY_CASH' | 'REFUND_PAYOUT'>('CASH_IN');
  const [opAmount, setOpAmount] = useState('');
  const [opReasonPreset, setOpReasonPreset] = useState('');
  const [opCustomReason, setOpCustomReason] = useState('');
  const [opReferenceNo, setOpReferenceNo] = useState('');
  const [opDestination, setOpDestination] = useState('Main Store Vault');
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState('');

  // Selected movement for detail modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Historical Z-Report viewer modal
  const [selectedZReportShift, setSelectedZReportShift] = useState<any | null>(null);

  // Quick Live Cash Count (Independent Denomination Auditor)
  const [quickCounts, setQuickCounts] = useState<Record<string, number>>({
    '1000': 0,
    '500': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
  });
  const [coinsMiscAmount, setCoinsMiscAmount] = useState<string>('');

  // Ledger filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('ALL');

  // Accountant Reconciliation Desk form state
  const [selectedReconcileShiftId, setSelectedReconcileShiftId] = useState<number | null>(null);
  const [reconcileSupervisorPin, setReconcileSupervisorPin] = useState('');
  const [reconcileAuditNote, setReconcileAuditNote] = useState('');
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileError, setReconcileError] = useState('');
  const [reconcileSuccessMsg, setReconcileSuccessMsg] = useState('');

  const isDark = theme === 'dark';

  // Live metrics from active shift
  const openingFloat = Number(activeShift?.liveMetrics?.openingFloat ?? activeShift?.openingFloat ?? 0);
  const cashSales = Number(activeShift?.liveMetrics?.cashSales ?? activeShift?.totalCashSales ?? 0);
  const cardSales = Number(activeShift?.liveMetrics?.cardSales ?? activeShift?.totalCardSales ?? 0);
  const qrSales = Number(activeShift?.liveMetrics?.qrSales ?? activeShift?.totalQrSales ?? 0);
  const totalSales = Number(activeShift?.liveMetrics?.totalSales ?? activeShift?.totalSales ?? 0);
  const cashIn = Number(activeShift?.liveMetrics?.totalCashIn ?? 0);
  const cashOut = Number(activeShift?.liveMetrics?.totalCashOut ?? 0);
  const safeDrops = Number(activeShift?.liveMetrics?.totalSafeDrops ?? 0);
  const totalPetty = Number(activeShift?.liveMetrics?.totalPettyCash ?? 0);
  const totalRefunds = Number(activeShift?.liveMetrics?.totalRefundPayout ?? 0);
  const expectedCash = Number(activeShift?.liveMetrics?.expectedCash ?? activeShift?.expectedCash ?? 0);
  const totalOrdersCount = Number(activeShift?.liveMetrics?.totalOrders ?? activeShift?.totalTransactions ?? 0);

  // Total counted in Quick Denomination Count
  const totalCountedLive = useMemo(() => {
    let sum = 0;
    for (const d of NEPALI_DENOMINATIONS) {
      const q = quickCounts[d.value.toString()] || 0;
      sum += d.value * q;
    }
    const misc = parseFloat(coinsMiscAmount);
    if (!isNaN(misc) && misc > 0) sum += misc;
    return sum;
  }, [quickCounts, coinsMiscAmount]);

  // Live Variance (Visible only in Accountant Mode)
  const liveVariance = totalCountedLive - expectedCash;

  // Filtered Cash Movements
  const filteredTransactions = useMemo(() => {
    return cashTransactions.filter((tx) => {
      const matchesType =
        ledgerTypeFilter === 'ALL' ||
        tx.type === ledgerTypeFilter ||
        (ledgerTypeFilter === 'CASH_OUT' && (tx.type === 'PETTY_CASH' || tx.type === 'REFUND_PAYOUT'));
      const q = ledgerSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tx.reason?.toLowerCase().includes(q) ||
        tx.performedByName?.toLowerCase().includes(q) ||
        tx.type?.toLowerCase().includes(q) ||
        tx.amount?.toString().includes(q);
      return matchesType && matchesSearch;
    });
  }, [cashTransactions, ledgerTypeFilter, ledgerSearch]);

  // Format currency helper
  const formatNpr = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return `NPR ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Human duration helper
  const getShiftDuration = (openedAtStr: string | undefined) => {
    if (!openedAtStr) return '0m';
    const start = new Date(openedAtStr).getTime();
    const now = Date.now();
    const diffMins = Math.max(0, Math.floor((now - start) / 60000));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const openCashOpModal = (type: 'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP' | 'PETTY_CASH' | 'REFUND_PAYOUT') => {
    setOpType(type);
    setOpAmount('');
    setOpCustomReason('');
    setOpError('');
    if (type === 'CASH_IN') setOpReasonPreset('Additional Float');
    else if (type === 'PETTY_CASH') setOpReasonPreset('Tea & Office Refreshments');
    else if (type === 'SAFE_DROP') setOpReasonPreset('Mid-Shift Safe Drop to Vault');
    else if (type === 'REFUND_PAYOUT') setOpReasonPreset('Customer Product Return Cash Payout');
    else setOpReasonPreset('Supplier / Vendor Payment');
    setOpReferenceNo(`${type.slice(0, 3)}-${Date.now().toString().slice(-4)}`);
    setIsCashOpOpen(true);
  };

  const handleCashOpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(opAmount);
    if (isNaN(amt) || amt <= 0) {
      setOpError('Please enter a valid amount greater than 0.');
      return;
    }

    setOpLoading(true);
    setOpError('');

    try {
      const finalReason = opCustomReason ? `${opReasonPreset} - ${opCustomReason}` : opReasonPreset;
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cash_op',
          shiftId: activeShift.id,
          type: opType,
          amount: amt,
          reason: finalReason,
          referenceNo: opReferenceNo,
          destination: opDestination,
          performedByName: cashier?.name || 'Staff Cashier',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCashOpOpen(false);
        onCashOpSuccess();
      } else {
        setOpError(data.error || 'Failed to record cash operation.');
      }
    } catch (err: any) {
      setOpError(err.message || 'Server error.');
    } finally {
      setOpLoading(false);
    }
  };

  // Accountant Reconciliation Handler (Stage 4)
  const handleAccountantReconcileSubmit = async (shiftToReconcile: any) => {
    if (!reconcileSupervisorPin) {
      setReconcileError('Supervisor or Accountant PIN is strictly required to finalize reconciliation.');
      return;
    }

    setReconcileLoading(true);
    setReconcileError('');
    setReconcileSuccessMsg('');

    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          shiftId: shiftToReconcile.id,
          closingCash: Number(shiftToReconcile.closingCash || 0),
          closingDenominations: shiftToReconcile.closingDenominations || {},
          supervisorEmail: cashier?.email,
          supervisorPin: reconcileSupervisorPin.trim(),
          note: reconcileAuditNote.trim(),
          varianceReason: reconcileAuditNote.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.eodReport) {
        setReconcileSuccessMsg(`Shift ${shiftToReconcile.shiftNumber} successfully audited and reconciled!`);
        setSelectedZReportShift({ ...shiftToReconcile, eodReport: data.eodReport, status: 'CLOSED' });
        setReconcileSupervisorPin('');
        setReconcileAuditNote('');
        onCashOpSuccess();
      } else {
        setReconcileError(data.error || 'Reconciliation approval failed.');
      }
    } catch (err: any) {
      setReconcileError(err.message || 'Server error while reconciling shift.');
    } finally {
      setReconcileLoading(false);
    }
  };

  // Find shift selected for reconciliation
  const targetReconcileShift = useMemo(() => {
    if (selectedReconcileShiftId) {
      return recentShifts.find((s) => s.id === selectedReconcileShiftId) || activeShift;
    }
    return activeShift?.status === 'SUBMITTED' ? activeShift : recentShifts.find((s) => s.status === 'SUBMITTED') || activeShift;
  }, [selectedReconcileShiftId, recentShifts, activeShift]);

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden font-sans transition-colors ${
        isDark ? 'bg-[#0d1410] text-[#dfe4e0]' : 'bg-[#f4f6f8] text-slate-900'
      }`}
    >
      {/* 1. TOP STATUS & QUICK ACTIONS BAR */}
      <div
        className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              activeShift?.status === 'OPEN'
                ? 'bg-emerald-500 animate-pulse'
                : activeShift?.status === 'SUBMITTED'
                ? 'bg-amber-500 animate-bounce'
                : 'bg-slate-400'
            }`}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Cash Drawer &amp; Shift Reconciliation
              </h2>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                  activeShift?.status === 'OPEN'
                    ? isDark
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                    : activeShift?.status === 'SUBMITTED'
                    ? isDark
                      ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                      : 'bg-amber-50 text-amber-700 border-amber-300 font-bold'
                    : isDark
                    ? 'bg-slate-900 text-slate-400 border-slate-700'
                    : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}
              >
                {activeShift?.status === 'OPEN'
                  ? `SHIFT OPEN: ${activeShift.shiftNumber}`
                  : activeShift?.status === 'SUBMITTED'
                  ? `ENVELOPE SUBMITTED: ${activeShift.shiftNumber} (PENDING AUDIT)`
                  : 'DRAWER CLOSED (NO ACTIVE SHIFT)'}
              </span>

              {/* View Mode Tag */}
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${
                  viewMode === 'cashier'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
                }`}
              >
                {viewMode === 'cashier' ? 'CASHIER BLIND VIEW' : 'ACCOUNTANT AUDIT VIEW'}
              </span>
            </div>

            <div className={`text-[11px] flex items-center gap-2 mt-0.5 flex-wrap ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
              <span>
                Terminal: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{registerCode}</strong>
              </span>
              <span>•</span>
              <span>
                Cashier: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{cashier?.name || 'Staff Cashier'}</strong>
              </span>
              {activeShift && (
                <>
                  <span>•</span>
                  <span>
                    BOD Float: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatNpr(openingFloat)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Duration: <strong className={`font-mono ${isDark ? 'text-[#82d8a9]' : 'text-emerald-700 font-bold'}`}>{getShiftDuration(activeShift.openedAt)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <button
            onClick={() => setViewMode((prev) => (prev === 'cashier' ? 'accountant' : 'cashier'))}
            className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              viewMode === 'accountant'
                ? 'bg-purple-700 hover:bg-purple-800 text-white border-purple-400 shadow-xs'
                : isDark
                ? 'bg-[#1c211e] hover:bg-[#262b29] text-slate-300 border-[#3f4942]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Toggle between Cashier Operating View and Accountant Audit View"
          >
            {viewMode === 'accountant' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                <span>Accountant View Active</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                <span>Switch to Accountant View</span>
              </>
            )}
          </button>

          {!activeShift ? (
            <button
              onClick={onOpenShiftClick}
              className="px-4 py-2 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-[#82d8a9] shadow-md cursor-pointer transition-all"
            >
              <Banknote className="w-4 h-4 text-emerald-300" />
              [1. BOD] Receive Float &amp; Open Shift
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => openCashOpModal('CASH_IN')}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  isDark
                    ? 'bg-[#14231b] hover:bg-[#1a3024] text-emerald-300 hover:text-emerald-200 border-emerald-500/40'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-xs'
                }`}
                title="Record Cash Inflow / Float Addition"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Cash IN</span>
              </button>

              <button
                onClick={() => openCashOpModal('CASH_OUT')}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  isDark
                    ? 'bg-[#261616] hover:bg-[#331c1c] text-rose-300 hover:text-rose-200 border-rose-500/40'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-xs'
                }`}
                title="Record Cash Outflow / Expense"
              >
                <Minus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Cash OUT</span>
              </button>

              <button
                onClick={() => openCashOpModal('SAFE_DROP')}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  isDark
                    ? 'bg-[#261f14] hover:bg-[#33291a] text-amber-300 hover:text-amber-200 border-amber-500/40'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300 shadow-xs'
                }`}
                title="Transfer excess cash from drawer to store vault"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Safe Drop</span>
              </button>

              <button
                onClick={() => openCashOpModal('PETTY_CASH')}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  isDark
                    ? 'bg-[#142028] hover:bg-[#1a2b36] text-blue-300 hover:text-blue-200 border-blue-500/40'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 shadow-xs'
                }`}
                title="Record Tea, Courier, or Minor Store Expense"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Petty Cash</span>
              </button>

              {activeShift.status === 'OPEN' && (
                <button
                  onClick={onCloseShiftClick}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border border-amber-500 shadow-xs cursor-pointer transition-all"
                  title="Count physical notes and submit sealed envelope to Accounts"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>[3. EOD] Blind Close &amp; Submit</span>
                </button>
              )}

              {activeShift.status === 'SUBMITTED' && (
                <button
                  onClick={() => setSubTab('reconciliation')}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500 shadow-xs cursor-pointer transition-all"
                  title="Verify submitted envelope and finalize reconciliation"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>[4. AUDIT] Reconcile Envelope</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div
        className={`px-5 pt-2 border-b flex items-center gap-1 shrink-0 overflow-x-auto ${
          isDark ? 'bg-[#0f1311] border-[#262b29]' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          onClick={() => setSubTab('dashboard')}
          className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'dashboard'
              ? isDark
                ? 'border-[#82d8a9] text-white bg-[#181d1b]'
                : 'border-emerald-600 text-emerald-800 bg-white font-bold shadow-xs'
              : isDark
              ? 'border-transparent text-[#88938b] hover:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Live Shift &amp; Drawer (लाइभ सिफ्ट)</span>
        </button>

        <button
          onClick={() => setSubTab('ledger')}
          className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'ledger'
              ? isDark
                ? 'border-[#82d8a9] text-white bg-[#181d1b]'
                : 'border-emerald-600 text-emerald-800 bg-white font-bold shadow-xs'
              : isDark
              ? 'border-transparent text-[#88938b] hover:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Movement Log ({cashTransactions.length})</span>
        </button>

        <button
          onClick={() => setSubTab('denominations')}
          className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'denominations'
              ? isDark
                ? 'border-[#82d8a9] text-white bg-[#181d1b]'
                : 'border-emerald-600 text-emerald-800 bg-white font-bold shadow-xs'
              : isDark
              ? 'border-transparent text-[#88938b] hover:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-500" />
          <span>Physical Cash Counter (नोट काउन्टर)</span>
        </button>

        <button
          onClick={() => setSubTab('reconciliation')}
          className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'reconciliation'
              ? isDark
                ? 'border-[#82d8a9] text-white bg-[#181d1b]'
                : 'border-emerald-600 text-emerald-800 bg-white font-bold shadow-xs'
              : isDark
              ? 'border-transparent text-[#88938b] hover:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Accountant Reconciliation Desk (लेखा मिलान)</span>
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'history'
              ? isDark
                ? 'border-[#82d8a9] text-white bg-[#181d1b]'
                : 'border-emerald-600 text-emerald-800 bg-white font-bold shadow-xs'
              : isDark
              ? 'border-transparent text-[#88938b] hover:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Previous Shifts &amp; Z-Reports ({recentShifts.length})</span>
        </button>
      </div>

      {/* 3. SUBTAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* SUBTAB 1: LIVE SHIFT & DRAWER (BLIND CASHIER / AUDIT ACCOUNTANT) */}
        {subTab === 'dashboard' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* 4-STAGE RETAIL WORKFLOW STEPPER BANNER */}
            <div
              className={`p-3 border text-xs grid grid-cols-2 md:grid-cols-4 gap-2 ${
                isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div
                className={`p-2 border flex items-center gap-2 ${
                  activeShift ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  1
                </div>
                <div>
                  <div className="font-bold text-[11px]">BOD (Opening Float)</div>
                  <div className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Float received from Accounts</div>
                </div>
              </div>

              <div
                className={`p-2 border flex items-center gap-2 ${
                  activeShift?.status === 'OPEN' ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  2
                </div>
                <div>
                  <div className="font-bold text-[11px]">Operating Hours</div>
                  <div className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Invoices &amp; Vouchers in tray (Blind)</div>
                </div>
              </div>

              <div
                className={`p-2 border flex items-center gap-2 ${
                  activeShift?.status === 'SUBMITTED' ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  3
                </div>
                <div>
                  <div className="font-bold text-[11px]">EOD Blind Submission</div>
                  <div className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Count notes &amp; submit envelope</div>
                </div>
              </div>

              <div
                className={`p-2 border flex items-center gap-2 ${
                  activeShift?.status === 'CLOSED' ? 'border-purple-500/40 bg-purple-500/5' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  4
                </div>
                <div>
                  <div className="font-bold text-[11px]">Accountant Audit</div>
                  <div className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Variance verification &amp; Z-Report</div>
                </div>
              </div>
            </div>

            {/* 6 KEY METRIC CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Card 1: BOD Opening Float */}
              <div
                className={`p-3 border flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  BOD Opening Float
                </span>
                <div className={`text-base font-bold font-mono my-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatNpr(openingFloat)}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Received from Accounts</span>
              </div>

              {/* Card 2: Operating Invoices vs Cash Sales (ROLE CONTROLLED) */}
              <div
                className={`p-3 border flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  {viewMode === 'cashier' ? 'Invoices In Drawer' : 'Cash Sales (POS)'}
                </span>
                <div className={`text-base font-bold font-mono my-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {viewMode === 'cashier' ? `${totalOrdersCount} Invoices Filed` : `+${formatNpr(cashSales)}`}
                </div>
                <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  {viewMode === 'cashier' ? 'Physical copies in tray' : 'Direct checkout cash'}
                </span>
              </div>

              {/* Card 3: Cash In */}
              <div
                className={`p-3 border flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  Cash IN (Manual)
                </span>
                <div className={`text-base font-bold font-mono my-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  +{formatNpr(cashIn)}
                </div>
                <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Added manual floats</span>
              </div>

              {/* Card 4: Cash Out & Petty */}
              <div
                className={`p-3 border flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  Cash OUT &amp; Petty
                </span>
                <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 my-1">
                  -{formatNpr(cashOut)}
                </div>
                <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Expense vouchers</span>
              </div>

              {/* Card 5: Safe Drops */}
              <div
                className={`p-3 border flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  Safe Drops (Vault)
                </span>
                <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 my-1">
                  -{formatNpr(safeDrops)}
                </div>
                <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Transfers to vault</span>
              </div>

              {/* Card 6: EXPECTED IN DRAWER vs BLIND PROTECTION */}
              <div
                className={`p-3 border-2 flex flex-col justify-between transition-all ${
                  viewMode === 'cashier'
                    ? isDark
                      ? 'bg-[#141f1a] border-emerald-500/40'
                      : 'bg-emerald-50/70 border-emerald-400 shadow-xs'
                    : isDark
                    ? 'bg-[#101b15] border-[#82d8a9]'
                    : 'bg-emerald-50 border-emerald-600 shadow-xs'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold tracking-wider flex items-center justify-between ${
                  isDark ? 'text-[#82d8a9]' : 'text-emerald-800'
                }`}>
                  <span>{viewMode === 'cashier' ? 'Drawer Security' : 'Expected in Drawer'}</span>
                  {viewMode === 'cashier' ? <Lock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                </span>
                <div className={`text-base font-bold font-mono my-1 ${
                  viewMode === 'cashier'
                    ? isDark ? 'text-emerald-300' : 'text-emerald-800'
                    : isDark ? 'text-[#82d8a9]' : 'text-emerald-700'
                }`}>
                  {viewMode === 'cashier' ? 'BLIND DRAWER' : formatNpr(expectedCash)}
                </div>
                <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                  {viewMode === 'cashier' ? 'Balance concealed for audit' : 'Float + Sales + In − Out'}
                </span>
              </div>
            </div>

            {/* MAIN TWO-COLUMN DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (7 cols): Cash Movements & Drawer Invoices Tray */}
              <div className="lg:col-span-7 space-y-4">
                {/* INVOICE & VOUCHER TRAY (BLIND FOR CASHIER) OR FINANCIAL SNAPSHOT (ACCOUNTANT) */}
                {viewMode === 'cashier' ? (
                  <div
                    className={`p-4 border ${
                      isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-[#262b29]">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                        <h3 className={`font-bold text-xs uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          [2. Operating Hours] Physical Invoice &amp; Voucher Tray
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {totalOrdersCount} Customer Orders
                      </span>
                    </div>

                    <div className={`p-3 border text-xs space-y-2 ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={isDark ? 'text-[#dfe4e0]' : 'text-slate-700'}>
                        <strong>Retail Internal Control Rule:</strong> Under store accounting policy, live sales revenue
                        and expected drawer totals are sealed during active shifts.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="p-2 border bg-white dark:bg-[#181d1b] border-slate-200 dark:border-[#262b29]">
                          <span className="font-bold block text-slate-800 dark:text-slate-200">1. Customer Invoices:</span>
                          <span className="text-slate-500">Keep duplicate customer receipts in drawer tray for EOD bundle.</span>
                        </div>
                        <div className="p-2 border bg-white dark:bg-[#181d1b] border-slate-200 dark:border-[#262b29]">
                          <span className="font-bold block text-slate-800 dark:text-slate-200">2. Expense Vouchers:</span>
                          <span className="text-slate-500">Attach supplier receipts or tea chits for each Cash OUT operation.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* FINANCIAL LEDGER FOR ACCOUNTANT VIEW */
                  <div
                    className={`p-4 border ${
                      isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-[#262b29]">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <h3 className={`font-bold text-xs uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Shift Sales Turnover &amp; Tax Ledger (Accountant Audit)
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{totalOrdersCount} Orders Today</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className={`p-2.5 border ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Gross Sales</span>
                        <span className={`font-mono font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {formatNpr(totalSales)}
                        </span>
                      </div>
                      <div className={`p-2.5 border ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Discounts Given</span>
                        <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                          -{formatNpr(activeShift?.liveMetrics?.totalDiscounts || 0)}
                        </span>
                      </div>
                      <div className={`p-2.5 border ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>13% VAT Collected</span>
                        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          +{formatNpr(activeShift?.liveMetrics?.totalVat || 0)}
                        </span>
                      </div>
                      <div className={`p-2.5 border ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Net Shift Turnover</span>
                        <span className={`font-mono font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {formatNpr(totalSales)}
                        </span>
                      </div>
                    </div>

                    {/* Payment Channels */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className={`p-2 border ${isDark ? 'bg-[#14231b] border-emerald-500/40' : 'bg-emerald-50 border-emerald-200'}`}>
                        <span className="text-[10px] font-bold block text-emerald-700 dark:text-emerald-400">Cash in Drawer:</span>
                        <span className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-300">
                          {formatNpr(cashSales)}
                        </span>
                      </div>
                      <div className={`p-2 border ${isDark ? 'bg-[#141828] border-blue-500/40' : 'bg-blue-50 border-blue-200'}`}>
                        <span className="text-[10px] font-bold block text-blue-700 dark:text-blue-400">POS Card Swipe:</span>
                        <span className="font-mono font-bold text-sm text-blue-800 dark:text-blue-300">
                          {formatNpr(cardSales)}
                        </span>
                      </div>
                      <div className={`p-2 border ${isDark ? 'bg-[#251828] border-purple-500/40' : 'bg-purple-50 border-purple-200'}`}>
                        <span className="text-[10px] font-bold block text-purple-700 dark:text-purple-400">Fonepay / eSewa:</span>
                        <span className="font-mono font-bold text-sm text-purple-800 dark:text-purple-300">
                          {formatNpr(qrSales)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* RECENT CASH MOVEMENTS (VOUCHERS) */}
                <div
                  className={`p-4 border ${
                    isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-[#262b29]">
                    <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-600 dark:text-[#82d8a9]" />
                      Recent Cash Movements &amp; Vouchers ({cashTransactions.length})
                    </span>
                    <button
                      onClick={() => setSubTab('ledger')}
                      className={`text-xs font-bold underline cursor-pointer ${
                        isDark ? 'text-[#82d8a9] hover:text-white' : 'text-emerald-700 hover:text-emerald-900'
                      }`}
                    >
                      View Full Ledger &gt;
                    </button>
                  </div>

                  {cashTransactions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 font-mono">
                      No cash movements recorded yet in this shift.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cashTransactions.slice(0, 4).map((tx) => (
                        <div
                          key={tx.id}
                          className={`p-2.5 border flex items-center justify-between text-xs transition-colors ${
                            isDark ? 'bg-[#101512] border-[#262b29] hover:bg-[#161c18]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${
                                tx.type === 'CASH_IN'
                                  ? isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : tx.type === 'SAFE_DROP'
                                  ? isDark ? 'bg-amber-950/60 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-300'
                                  : isDark ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}
                            >
                              {tx.type}
                            </span>
                            <div>
                              <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.reason}</div>
                              <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                                {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tx.performedByName}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`font-mono font-bold text-xs ${
                                tx.type === 'CASH_IN'
                                  ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                                  : isDark ? 'text-rose-400' : 'text-rose-600'
                              }`}
                            >
                              {tx.type === 'CASH_IN' ? '+' : '−'}NPR {Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (5 cols): Blind Physical Note Counter & Handover Action */}
              <div className="lg:col-span-5 space-y-4">
                <div
                  className={`p-4 text-xs space-y-3 border ${
                    isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#262b29]">
                    <div>
                      <span className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        <Coins className="w-4 h-4 text-amber-500" />
                        {viewMode === 'cashier' ? 'Physical Note Scratchpad (Blind)' : 'Live Cash Count & Audit'}
                      </span>
                      <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                        {viewMode === 'cashier'
                          ? 'Audit physical notes anytime. System expected cash is concealed.'
                          : 'Count drawer currency and audit against system expected balance.'}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setQuickCounts({
                          '1000': 0,
                          '500': 0,
                          '100': 0,
                          '50': 0,
                          '20': 0,
                          '10': 0,
                          '5': 0,
                          '2': 0,
                          '1': 0,
                        });
                        setCoinsMiscAmount('');
                      }}
                      className={`text-[10px] underline cursor-pointer ${
                        isDark ? 'text-[#88938b] hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Clear count inputs"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Notes input grid */}
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {NEPALI_DENOMINATIONS.slice(0, 7).map((denom) => {
                      const qty = quickCounts[denom.value.toString()] || 0;
                      const subtotal = denom.value * qty;
                      return (
                        <div
                          key={denom.value}
                          className={`flex items-center justify-between p-2 border ${
                            isDark ? 'bg-[#101512] border-[#2a342e]' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="w-24">
                            <span className={`font-black font-mono text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              ₨ {denom.value.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setQuickCounts((prev) => ({
                                  ...prev,
                                  [denom.value.toString()]: Math.max(0, (prev[denom.value.toString()] || 0) - 1),
                                }))
                              }
                              className={`w-6 h-6 flex items-center justify-center font-bold text-xs border cursor-pointer ${
                                isDark
                                  ? 'bg-[#1f2823] hover:bg-[#2b3830] text-white border-[#3f4942]'
                                  : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                              }`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setQuickCounts((prev) => ({
                                  ...prev,
                                  [denom.value.toString()]: isNaN(val) ? 0 : Math.max(0, val),
                                }));
                              }}
                              placeholder="0"
                              className={`w-14 py-1 text-center text-xs font-mono font-bold focus:outline-none ${
                                isDark
                                  ? 'bg-[#050806] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                                  : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQuickCounts((prev) => ({
                                  ...prev,
                                  [denom.value.toString()]: (prev[denom.value.toString()] || 0) + 1,
                                }))
                              }
                              className={`w-6 h-6 flex items-center justify-center font-bold text-xs border cursor-pointer ${
                                isDark
                                  ? 'bg-[#1f2823] hover:bg-[#2b3830] text-white border-[#3f4942]'
                                  : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                              }`}
                            >
                              +
                            </button>
                          </div>

                          <div className="w-24 text-right">
                            <span className={`font-mono text-xs font-black ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                              ₨ {subtotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Loose coins / other */}
                    <div
                      className={`flex items-center justify-between p-2 border ${
                        isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className={`text-xs font-medium ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>Coins &amp; Loose:</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>NPR</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={coinsMiscAmount}
                          onChange={(e) => setCoinsMiscAmount(e.target.value)}
                          placeholder="0.00"
                          className={`w-24 py-1 text-right px-2 text-xs font-mono font-bold focus:outline-none ${
                            isDark
                              ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                              : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Count Result Box */}
                  <div
                    className={`p-3 border space-y-2 ${
                      isDark ? 'bg-[#0f1412] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className={isDark ? 'text-[#88938b]' : 'text-slate-600'}>Counted Physical Cash:</span>
                      <span className={`font-mono font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {formatNpr(totalCountedLive)}
                      </span>
                    </div>

                    {/* In Accountant Mode: Reveal Expected Cash & Variance */}
                    {viewMode === 'accountant' && (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className={isDark ? 'text-[#88938b]' : 'text-slate-600'}>Expected System Cash:</span>
                          <span className={`font-mono font-bold text-sm ${isDark ? 'text-[#ffb95f]' : 'text-amber-700'}`}>
                            {formatNpr(expectedCash)}
                          </span>
                        </div>

                        <div
                          className={`flex justify-between items-center p-2 font-bold font-mono text-xs border ${
                            Math.abs(liveVariance) < 0.01
                              ? isDark
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : liveVariance > 0
                              ? isDark
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                              : isDark
                              ? 'bg-rose-950/60 text-rose-300 border-rose-500/50'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {Math.abs(liveVariance) < 0.01 ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            )}
                            <span>
                              {Math.abs(liveVariance) < 0.01
                                ? 'DRAWER BALANCED'
                                : liveVariance > 0
                                ? 'CASH OVER'
                                : 'CASH SHORT'}
                            </span>
                          </div>
                          <span>{liveVariance > 0 ? `+${formatNpr(liveVariance)}` : formatNpr(liveVariance)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Primary Call to Action Button */}
                  {activeShift?.status === 'OPEN' && (
                    <button
                      onClick={onCloseShiftClick}
                      className="w-full py-2.5 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[#82d8a9] shadow cursor-pointer transition-all"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>[3. EOD Submission] Blind Close &amp; Envelope Handover</span>
                    </button>
                  )}

                  {activeShift?.status === 'SUBMITTED' && (
                    <button
                      onClick={() => setSubTab('reconciliation')}
                      className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-purple-400 shadow cursor-pointer transition-all"
                    >
                      <Scale className="w-4 h-4" />
                      <span>[4. Audit Desk] Reconcile Cash Handover</span>
                    </button>
                  )}
                </div>

                {/* 4-Step Retail Cash Drawer Protocol Card */}
                <div
                  className={`p-3 border text-[11px] space-y-1.5 ${
                    isDark ? 'bg-[#181d1b] border-[#262b29] text-[#88938b]' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] pb-1 border-b border-slate-100 dark:border-[#262b29]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#82d8a9]" />
                    <span>POS Retail Cash Control Protocol</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1. BOD Float Receipt:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Accountant Assigned</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2. Counter Hours:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">Blind Drawer (Sales Hidden)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>3. EOD Handover:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">Physical Envelope Seal</span>
                  </div>
                  <div className="flex justify-between">
                    <span>4. Final Reconciliation:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">Accountant Z-Report</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: FULL CASH MOVEMENT LOG (LEDGER) */}
        {subTab === 'ledger' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Filter and Search Bar */}
            <div
              className={`p-4 border flex flex-wrap items-center justify-between gap-3 text-xs ${
                isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`uppercase font-bold text-[10px] flex items-center gap-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                  <Filter className="w-3 h-3 text-emerald-600 dark:text-[#82d8a9]" /> Filter:
                </span>
                {['ALL', 'CASH_IN', 'CASH_OUT', 'SAFE_DROP', 'PETTY_CASH', 'REFUND_PAYOUT'].map((typeKey) => (
                  <button
                    key={typeKey}
                    onClick={() => setLedgerTypeFilter(typeKey)}
                    className={`px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer ${
                      ledgerTypeFilter === typeKey
                        ? 'bg-[#006b45] text-white border-[#82d8a9]'
                        : isDark
                        ? 'bg-[#141816] text-[#88938b] hover:text-white border-[#262b29]'
                        : 'bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200'
                    }`}
                  >
                    {typeKey.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search reason, ref, cashier..."
                    className={`pl-8 pr-3 py-1.5 text-xs w-56 focus:outline-none ${
                      isDark
                        ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                        : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                    }`}
                  />
                </div>

                {activeShift?.status === 'OPEN' && (
                  <button
                    onClick={() => openCashOpModal('CASH_IN')}
                    className="px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs flex items-center gap-1 border border-[#82d8a9] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Movement</span>
                  </button>
                )}
              </div>
            </div>

            {/* Complete Ledger Table */}
            <div className={`border overflow-hidden ${isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className="overflow-x-auto">
                <table className={`w-full text-left text-xs ${isDark ? 'text-[#dfe4e0]' : 'text-slate-800'}`}>
                  <thead className={`text-[10px] uppercase font-bold border-b ${
                    isDark ? 'bg-[#141816] text-[#88938b] border-[#262b29]' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Movement Type</th>
                      <th className="p-3">Reason / Voucher</th>
                      <th className="p-3">Performed By</th>
                      <th className="p-3 text-right">Amount (NPR)</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#262b29]' : 'divide-slate-200'}`}>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={`p-8 text-center font-mono ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                          No cash drawer operations found matching your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className={`transition-colors ${isDark ? 'hover:bg-[#1a201c]' : 'hover:bg-slate-50'}`}>
                          <td className={`p-3 font-mono text-[11px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${
                                tx.type === 'CASH_IN'
                                  ? isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : tx.type === 'SAFE_DROP'
                                  ? isDark ? 'bg-amber-950/60 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-300'
                                  : isDark ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.reason}</div>
                          </td>
                          <td className={`p-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tx.performedByName}</td>
                          <td className="p-3 text-right font-mono font-bold text-sm">
                            <span
                              className={
                                tx.type === 'CASH_IN'
                                  ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                                  : isDark ? 'text-rose-400' : 'text-rose-600'
                              }
                            >
                              {tx.type === 'CASH_IN' ? '+' : '−'}NPR {Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] px-1.5 py-0.5 font-mono border ${
                              isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            }`}>
                              RECORDED
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className={`px-2 py-1 border text-[10px] font-bold cursor-pointer ${
                                isDark
                                  ? 'bg-[#1c211e] hover:bg-[#262b29] text-[#82d8a9] border-[#3f4942]'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                              }`}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: PHYSICAL CASH COUNTER (BLIND NOTE AUDIT SHEET) */}
        {subTab === 'denominations' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className={`p-4 border flex items-center justify-between ${
              isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Coins className="w-4 h-4 text-amber-500" />
                  Full Physical Note &amp; Coin Audit Sheet
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  Count physical currency in the cash drawer to audit physical notes.
                </p>
              </div>

              {viewMode === 'accountant' && (
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                    Expected Drawer Cash: <strong className={`font-mono text-sm ${isDark ? 'text-[#ffb95f]' : 'text-amber-700'}`}>{formatNpr(expectedCash)}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Denomination Rows */}
            <div className={`border overflow-hidden ${isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'}`}>
              <table className={`w-full text-left text-xs ${isDark ? 'text-[#dfe4e0]' : 'text-slate-800'}`}>
                <thead className={`text-[10px] uppercase font-bold border-b ${
                  isDark ? 'bg-[#141816] text-[#88938b] border-[#262b29]' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  <tr>
                    <th className="p-3">Denomination (NPR)</th>
                    <th className="p-3 text-center">Note Quantity</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#262b29]' : 'divide-slate-200'}`}>
                  {NEPALI_DENOMINATIONS.map((d) => {
                    const qty = quickCounts[d.value.toString()] || 0;
                    const subtotal = d.value * qty;
                    return (
                      <tr key={d.value} className={isDark ? 'hover:bg-[#141816]' : 'hover:bg-slate-50'}>
                        <td className={`p-3 font-mono font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          <span className={d.color}>{d.label}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setQuickCounts((prev) => ({
                                  ...prev,
                                  [d.value.toString()]: Math.max(0, (prev[d.value.toString()] || 0) - 1),
                                }))
                              }
                              className={`w-7 h-7 flex items-center justify-center font-bold border cursor-pointer ${
                                isDark
                                  ? 'bg-[#1c211e] hover:bg-[#262b29] text-white border-[#262b29]'
                                  : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                              }`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setQuickCounts((prev) => ({
                                  ...prev,
                                  [d.value.toString()]: isNaN(val) ? 0 : Math.max(0, val),
                                }));
                              }}
                              placeholder="0"
                              className={`w-16 py-1 text-center font-mono font-bold text-sm focus:outline-none ${
                                isDark
                                  ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                                  : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQuickCounts((prev) => ({
                                  ...prev,
                                  [d.value.toString()]: (prev[d.value.toString()] || 0) + 1,
                                }))
                              }
                              className={`w-7 h-7 flex items-center justify-center font-bold border cursor-pointer ${
                                isDark
                                  ? 'bg-[#1c211e] hover:bg-[#262b29] text-white border-[#262b29]'
                                  : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className={`p-3 text-right font-mono font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          ₨ {subtotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Loose Coins */}
                  <tr className={isDark ? 'hover:bg-[#141816]' : 'hover:bg-slate-50'}>
                    <td className={`p-3 font-bold ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                      Coins &amp; Fractional Notes
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={coinsMiscAmount}
                        onChange={(e) => setCoinsMiscAmount(e.target.value)}
                        placeholder="0.00"
                        className={`w-32 py-1 px-3 text-center font-mono font-bold text-sm focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </td>
                    <td className={`p-3 text-right font-mono font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ₨ {(parseFloat(coinsMiscAmount) || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Banner */}
              <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-4 ${
                isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                    Total Counted Physical Cash:
                  </span>
                  <span className={`text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatNpr(totalCountedLive)}
                  </span>
                </div>

                {activeShift?.status === 'OPEN' && (
                  <button
                    onClick={onCloseShiftClick}
                    className="px-4 py-2 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider border border-[#82d8a9] cursor-pointer"
                  >
                    Transfer to EOD Blind Submission
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: ACCOUNTANT RECONCILIATION DESK (STAGE 4) */}
        {subTab === 'reconciliation' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className={`p-4 border flex items-center justify-between ${
              isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-purple-600 text-white flex items-center justify-center font-bold">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    [4. RECONCILIATION] Accountant Verification &amp; Variance Audit Desk
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                    Verify physical cash and invoice bundles submitted by cashier. Audit variances and finalize Z-Report.
                  </p>
                </div>
              </div>
            </div>

            {/* Reconciliation Workspace */}
            {targetReconcileShift ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left (7 cols): Submitted Cash vs System Expected Comparison */}
                <div className="lg:col-span-7 space-y-4">
                  <div className={`p-4 border space-y-4 ${isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'}`}>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#262b29]">
                      <span className="font-bold text-xs uppercase tracking-wider">
                        Shift #{targetReconcileShift.shiftNumber} Verification
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${
                          targetReconcileShift.status === 'SUBMITTED'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : targetReconcileShift.status === 'CLOSED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {targetReconcileShift.status === 'SUBMITTED' ? 'ENVELOPE PENDING AUDIT' : targetReconcileShift.status}
                      </span>
                    </div>

                    {/* Step-by-Step Variance Mathematics */}
                    <div className="space-y-2 text-xs font-mono">
                      <div className={`p-3 border space-y-1.5 ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="font-bold uppercase text-[10px] text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-800">
                          1. Cashier Handover Envelope (भौतिक नगद बुझाएको):
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Envelope Seal No:</span>
                          <span className="font-bold">{targetReconcileShift.eodReport?.handoverSlip?.envelopeNumber || 'ENV-N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Submitted By Cashier:</span>
                          <span className="font-bold">{targetReconcileShift.cashierName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Attached Invoices &amp; Vouchers:</span>
                          <span className="font-bold">{targetReconcileShift.eodReport?.handoverSlip?.vouchersBundleCount || 0} Bundled</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-200 dark:border-slate-800">
                          <span>Actual Cash Counted &amp; Enclosed:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ₨ {Number(targetReconcileShift.closingCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className={`p-3 border space-y-1.5 ${isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="font-bold uppercase text-[10px] text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-800">
                          2. Expected System Cash (प्रणाली अनुसार हुनुपर्ने हिसाब):
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">BOD Opening Float:</span>
                          <span>₨ {Number(targetReconcileShift.openingFloat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">(+) POS Cash Sales:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ₨ {Number(targetReconcileShift.totalCashSales || targetReconcileShift.liveMetrics?.cashSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">(+) Cash In:</span>
                          <span>₨ {Number(targetReconcileShift.liveMetrics?.totalCashIn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">(−) Cash Out &amp; Safe Drops:</span>
                          <span className="text-rose-600 dark:text-rose-400">
                            ₨ {(Number(targetReconcileShift.liveMetrics?.totalCashOut || 0) + Number(targetReconcileShift.liveMetrics?.totalSafeDrops || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-200 dark:border-slate-800">
                          <span>Total Expected System Cash:</span>
                          <span className="text-amber-600 dark:text-[#ffb95f]">
                            ₨ {Number(targetReconcileShift.expectedCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Variance Indicator */}
                      {(() => {
                        const actual = Number(targetReconcileShift.closingCash || 0);
                        const expected = Number(targetReconcileShift.expectedCash || 0);
                        const diff = actual - expected;
                        const isMatch = Math.abs(diff) < 0.01;
                        const isSurplus = diff > 0.01;

                        return (
                          <div
                            className={`p-3 border font-bold text-xs flex items-center justify-between ${
                              isMatch
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                                : isSurplus
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isMatch ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5" />}
                              <div>
                                <div className="text-xs uppercase">
                                  {isMatch ? 'PERFECT BALANCE (सन्तुलित)' : isSurplus ? 'CASH OVER / SURPLUS (नगद बढी)' : 'CASH SHORT / DEFICIT (नगद अभाव)'}
                                </div>
                                <div className="text-[10px] font-normal opacity-90">
                                  Variance = Actual Cash Submitted − Expected System Cash
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black">
                                {isSurplus ? '+' : ''}₨ {diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right (5 cols): Accountant Approval Form & PIN */}
                <div className="lg:col-span-5 space-y-4">
                  <div className={`p-4 border space-y-3 ${isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'}`}>
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-[#262b29]">
                      <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-bold text-xs uppercase tracking-wider">Accountant Audit Sign-Off</h4>
                    </div>

                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Accountant / Supervisor PIN *:
                      </label>
                      <input
                        type="password"
                        value={reconcileSupervisorPin}
                        onChange={(e) => setReconcileSupervisorPin(e.target.value)}
                        placeholder="Enter PIN (e.g. 9999, 1234)"
                        className={`w-full p-2 font-mono text-xs focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Audit Explanation / Resolution Memo:
                      </label>
                      <textarea
                        rows={3}
                        value={reconcileAuditNote}
                        onChange={(e) => setReconcileAuditNote(e.target.value)}
                        placeholder="e.g. Verified envelope cash notes against printed invoices bundle. Variance accepted and posted to GL."
                        className={`w-full p-2 text-xs focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    {reconcileError && (
                      <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{reconcileError}</span>
                      </div>
                    )}

                    {reconcileSuccessMsg && (
                      <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{reconcileSuccessMsg}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={reconcileLoading}
                      onClick={() => handleAccountantReconcileSubmit(targetReconcileShift)}
                      className="w-full py-3 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[#82d8a9] shadow cursor-pointer transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{reconcileLoading ? 'Auditing...' : 'Approve Settlement & Issue Z-Report (अडिट अनुमोदन)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 font-mono text-xs border border-dashed">
                No shift envelope currently submitted for reconciliation.
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 5: PREVIOUS SHIFTS & Z-REPORTS */}
        {subTab === 'history' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className={`p-4 border flex items-center justify-between ${
              isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-[#82d8a9]" />
                  Historical Closed Shifts &amp; EOD Z-Reports
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  Audit past shifts, verified variance settlements, and re-print historical Z-Report slips.
                </p>
              </div>
            </div>

            <div className={`border overflow-hidden ${isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className="overflow-x-auto">
                <table className={`w-full text-left text-xs ${isDark ? 'text-[#dfe4e0]' : 'text-slate-800'}`}>
                  <thead className={`text-[10px] uppercase font-bold border-b ${
                    isDark ? 'bg-[#141816] text-[#88938b] border-[#262b29]' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <tr>
                      <th className="p-3">Shift #</th>
                      <th className="p-3">Cashier</th>
                      <th className="p-3">Opened</th>
                      <th className="p-3">Closed</th>
                      <th className="p-3 text-right">Opening Float</th>
                      <th className="p-3 text-right">Cash Sales</th>
                      <th className="p-3 text-right">Closing Cash</th>
                      <th className="p-3 text-center">Variance</th>
                      <th className="p-3 text-right">Z-Report</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#262b29]' : 'divide-slate-200'}`}>
                    {recentShifts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className={`p-8 text-center font-mono ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                          No previous shift records found on this register.
                        </td>
                      </tr>
                    ) : (
                      recentShifts.map((s) => {
                        const disc = Number(s.cashDiscrepancy) || 0;
                        const isClosed = s.status === 'CLOSED';
                        return (
                          <tr key={s.id} className={`transition-colors ${isDark ? 'hover:bg-[#1a201c]' : 'hover:bg-slate-50'}`}>
                            <td className={`p-3 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {s.shiftNumber}
                              {s.status === 'OPEN' && (
                                <span className={`ml-1.5 text-[8px] px-1 font-mono border ${
                                  isDark ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                  ACTIVE
                                </span>
                              )}
                              {s.status === 'SUBMITTED' && (
                                <span className={`ml-1.5 text-[8px] px-1 font-mono border ${
                                  isDark ? 'bg-amber-950 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}>
                                  SUBMITTED
                                </span>
                              )}
                            </td>
                            <td className={`p-3 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{s.cashierName}</td>
                            <td className={`p-3 font-mono text-[11px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                              {new Date(s.openedAt).toLocaleDateString()}{' '}
                              {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className={`p-3 font-mono text-[11px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                              {s.closedAt
                                ? `${new Date(s.closedAt).toLocaleDateString()} ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : '—'}
                            </td>
                            <td className="p-3 text-right font-mono">
                              ₨ {Number(s.openingFloat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                              ₨ {Number(s.totalCashSales || s.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {s.closingCash ? `₨ ${Number(s.closingCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="p-3 text-center">
                              {!isClosed ? (
                                <span className={`text-[10px] font-mono ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                  {s.status === 'SUBMITTED' ? 'Pending Audit' : 'In Progress'}
                                </span>
                              ) : Math.abs(disc) < 0.01 ? (
                                <span className={`text-[9px] px-1.5 py-0.5 font-mono font-bold border ${
                                  isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                }`}>
                                  BALANCED
                                </span>
                              ) : disc > 0 ? (
                                <span className={`text-[9px] px-1.5 py-0.5 font-mono font-bold border ${
                                  isDark ? 'bg-amber-950/60 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  +₨ {disc.toLocaleString('en-IN')} (OVER)
                                </span>
                              ) : (
                                <span className={`text-[9px] px-1.5 py-0.5 font-mono font-bold border ${
                                  isDark ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}>
                                  −₨ {Math.abs(disc).toLocaleString('en-IN')} (SHORT)
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {s.eodReport ? (
                                <button
                                  onClick={() => setSelectedZReportShift(s)}
                                  className={`px-2.5 py-1 text-xs font-bold flex items-center gap-1 ml-auto cursor-pointer border ${
                                    isDark
                                      ? 'bg-[#1c211e] hover:bg-[#262b29] text-[#82d8a9] border-[#82d8a9]/40'
                                      : 'bg-slate-100 hover:bg-slate-200 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Z-Report</span>
                                </button>
                              ) : s.status === 'SUBMITTED' ? (
                                <button
                                  onClick={() => {
                                    setSelectedReconcileShiftId(s.id);
                                    setSubTab('reconciliation');
                                  }}
                                  className="px-2 py-1 text-[10px] font-bold bg-purple-700 hover:bg-purple-800 text-white cursor-pointer ml-auto"
                                >
                                  Reconcile
                                </button>
                              ) : (
                                <span className={`text-[10px] font-mono ${isDark ? 'text-[#88938b]' : 'text-slate-400'}`}>No Slip</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. CASH IN / CASH OUT / SAFE DROP / PETTY CASH MODAL DIALOG */}
      {isCashOpOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border-2 w-full max-w-lg p-5 text-xs shadow-2xl space-y-4 ${
            isDark ? 'bg-[#181d1b] border-[#82d8a9] text-[#dfe4e0]' : 'bg-white border-emerald-600 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#262b29]' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs ${
                    opType === 'CASH_IN'
                      ? isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : opType === 'SAFE_DROP'
                      ? isDark ? 'bg-amber-950 text-amber-400 border border-amber-500/40' : 'bg-amber-100 text-amber-800 border border-amber-300'
                      : isDark ? 'bg-rose-950 text-rose-400 border border-rose-500/40' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {opType === 'CASH_IN' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {opType === 'CASH_IN'
                      ? 'Record Cash Inflow (+)'
                      : opType === 'SAFE_DROP'
                      ? 'Record Vault Safe Drop (−)'
                      : opType === 'PETTY_CASH'
                      ? 'Record Petty Cash Expense (−)'
                      : 'Record Cash Outflow (−)'}
                  </h3>
                  <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                    Terminal: {registerCode} • Cashier: {cashier?.name || 'Staff Cashier'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsCashOpOpen(false)}
                className={`p-1 cursor-pointer ${isDark ? 'text-[#88938b] hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {opError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{opError}</span>
              </div>
            )}

            <form onSubmit={handleCashOpSubmit} className="space-y-3">
              <div>
                <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                  Movement Category:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[
                    { key: 'CASH_IN', label: 'Cash In (+)' },
                    { key: 'CASH_OUT', label: 'Cash Out (−)' },
                    { key: 'SAFE_DROP', label: 'Safe Drop' },
                    { key: 'PETTY_CASH', label: 'Petty Cash' },
                    { key: 'REFUND_PAYOUT', label: 'Refund' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => openCashOpModal(btn.key as any)}
                      className={`py-1.5 text-center font-bold text-[10px] border cursor-pointer ${
                        opType === btn.key
                          ? 'bg-[#006b45] text-white border-[#82d8a9]'
                          : isDark
                          ? 'bg-[#141816] text-[#88938b] border-[#262b29]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                    Amount (NPR) *:
                  </label>
                  <div className="flex items-center gap-1">
                    {[500, 1000, 2000, 5000].map((quickAmt) => (
                      <button
                        key={quickAmt}
                        type="button"
                        onClick={() => setOpAmount(quickAmt.toString())}
                        className={`px-1.5 py-0.5 border text-[9px] font-mono font-bold cursor-pointer ${
                          isDark
                            ? 'bg-[#141816] hover:bg-[#202722] text-[#82d8a9] border-[#262b29]'
                            : 'bg-slate-100 hover:bg-slate-200 text-emerald-700 border-slate-300'
                        }`}
                      >
                        +{quickAmt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className={`absolute left-3 top-2.5 font-mono font-bold text-sm ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>NPR</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={opAmount}
                    onChange={(e) => setOpAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    autoFocus
                    className={`w-full pl-14 pr-3 py-2 font-mono text-base font-bold focus:outline-none ${
                      isDark
                        ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                        : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                  Reason Preset:
                </label>
                <select
                  value={opReasonPreset}
                  onChange={(e) => setOpReasonPreset(e.target.value)}
                  className={`w-full p-2 text-xs focus:outline-none ${
                    isDark
                      ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                      : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                >
                  {opType === 'CASH_IN' ? (
                    <>
                      <option value="Additional Float">Additional Float / Morning Cash Replenishment</option>
                      <option value="Cash Added by Owner / Manager">Cash Added by Store Owner / Manager</option>
                      <option value="Customer Payment Correction">Customer Underpayment Cash Correction</option>
                      <option value="Change Replenishment">Change Replenishment from Bank</option>
                      <option value="Other Cash Inflow">Other Miscellaneous Cash Inflow</option>
                    </>
                  ) : opType === 'PETTY_CASH' ? (
                    <>
                      <option value="Tea & Office Refreshments">Staff Tea, Coffee &amp; Refreshments</option>
                      <option value="Courier & Transport">Courier, Local Delivery &amp; Transport</option>
                      <option value="Stationery & Cleaning">Cleaning, Soap &amp; Cashier Stationery</option>
                      <option value="Minor Hardware Repair Tool">Minor Store Tool / Repair Expense</option>
                    </>
                  ) : opType === 'SAFE_DROP' ? (
                    <>
                      <option value="Mid-Shift Safe Drop to Vault">Mid-Shift Excess Drawer Cash Reduction</option>
                      <option value="End of Afternoon Safe Transfer">End of Afternoon Safe Transfer</option>
                      <option value="High Cash Volume Safeguard">High Volume Safeguard (Limit Exceeded)</option>
                    </>
                  ) : opType === 'REFUND_PAYOUT' ? (
                    <>
                      <option value="Customer Product Return Cash Payout">Customer Product Return Cash Payout</option>
                      <option value="Overcharge Reimbursement">Customer Overcharge Cash Refund</option>
                      <option value="Cancelled Order Cash Refund">Cancelled Counter Order Cash Refund</option>
                    </>
                  ) : (
                    <>
                      <option value="Supplier / Vendor Payment">Supplier / Vendor Cash Payment</option>
                      <option value="Bank Branch Deposit">Bank Cash Deposit</option>
                      <option value="Emergency Cash Withdrawal">Emergency Cash Withdrawal</option>
                      <option value="Other Authorized Cash Withdrawal">Other Authorized Cash Outflow</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                    Voucher / Reference No:
                  </label>
                  <input
                    type="text"
                    value={opReferenceNo}
                    onChange={(e) => setOpReferenceNo(e.target.value)}
                    placeholder="e.g. CI-001, EXP-014"
                    className={`w-full p-2 font-mono text-xs focus:outline-none ${
                      isDark
                        ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                        : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                    Cashier / Performed By:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={cashier?.name || 'Staff Cashier'}
                    className={`w-full p-2 text-xs font-medium cursor-not-allowed border ${
                      isDark ? 'bg-[#141816] border-[#262b29] text-[#88938b]' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex items-center gap-2 pt-3 border-t ${isDark ? 'border-[#262b29]' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsCashOpOpen(false)}
                  className={`flex-1 py-2.5 font-bold cursor-pointer ${
                    isDark
                      ? 'bg-[#1c211e] hover:bg-[#262b29] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opLoading}
                  className={`flex-1 py-2.5 font-bold text-white border flex items-center justify-center gap-1.5 cursor-pointer ${
                    opType === 'CASH_IN'
                      ? 'bg-[#006b45] hover:bg-[#036c46] border-[#82d8a9]'
                      : 'bg-rose-700 hover:bg-rose-600 border-rose-400'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{opLoading ? 'Recording...' : 'Confirm Movement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. TRANSACTION DETAIL MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border w-full max-w-md p-5 text-xs shadow-2xl space-y-4 ${
            isDark ? 'bg-[#181d1b] border-[#82d8a9] text-[#dfe4e0]' : 'bg-white border-slate-300 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#262b29]' : 'border-slate-200'}`}>
              <span className={`font-bold uppercase tracking-wider text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Cash Movement Audit Details
              </span>
              <button
                onClick={() => setSelectedTx(null)}
                className={`p-1 cursor-pointer ${isDark ? 'text-[#88938b] hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className={`flex justify-between p-2 border ${isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                <span className={isDark ? 'text-[#88938b]' : 'text-slate-500'}>Operation Type:</span>
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedTx.type}</span>
              </div>
              <div className={`flex justify-between p-2 border ${isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                <span className={isDark ? 'text-[#88938b]' : 'text-slate-500'}>Amount:</span>
                <span className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{formatNpr(selectedTx.amount)}</span>
              </div>
              <div className={`flex justify-between p-2 border ${isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                <span className={isDark ? 'text-[#88938b]' : 'text-slate-500'}>Reason / Note:</span>
                <span className={`font-bold text-right max-w-[200px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedTx.reason}</span>
              </div>
              <div className={`flex justify-between p-2 border ${isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                <span className={isDark ? 'text-[#88938b]' : 'text-slate-500'}>Performed By:</span>
                <span className={isDark ? 'text-white' : 'text-slate-900'}>{selectedTx.performedByName}</span>
              </div>
              <div className={`flex justify-between p-2 border ${isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'}`}>
                <span className={isDark ? 'text-[#88938b]' : 'text-slate-500'}>Timestamp:</span>
                <span className={isDark ? 'text-white' : 'text-slate-900'}>{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className={`w-full py-2 font-bold cursor-pointer ${
                  isDark
                    ? 'bg-[#1c211e] hover:bg-[#262b29] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. HISTORICAL Z-REPORT VIEWER SLIP */}
      {selectedZReportShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border-2 w-full max-w-lg p-5 text-xs shadow-2xl max-h-[90vh] flex flex-col ${
            isDark ? 'bg-[#181d1b] border-[#82d8a9] text-[#dfe4e0]' : 'bg-white border-emerald-600 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${isDark ? 'border-[#262b29]' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  EOD Z-Report Slip #{selectedZReportShift.shiftNumber}
                </h3>
                <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>Official End of Day Settlement Audit</span>
              </div>
              <button
                onClick={() => setSelectedZReportShift(null)}
                className={`p-1 cursor-pointer ${isDark ? 'text-[#88938b] hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Paper Slip Simulation */}
            <div className="flex-1 overflow-y-auto my-3 p-4 bg-white text-black font-mono text-[11px] space-y-3 border shadow-inner">
              <div className="text-center border-b border-dashed border-gray-400 pb-2">
                <div className="font-bold text-sm">INTEL COMPUTER CENTER</div>
                <div className="text-[10px] text-gray-600">Dhangadhi Flagship Station #287</div>
                <div className="text-[10px] text-gray-600">VAT Registration: 601284920</div>
                <div className="font-bold text-xs mt-1 border-t border-b border-black py-0.5">
                  OFFICIAL EOD Z-REPORT SLIP
                </div>
              </div>

              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Shift Number:</span>
                  <span className="font-bold">{selectedZReportShift.shiftNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Register:</span>
                  <span>{selectedZReportShift.registerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{selectedZReportShift.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Closed By Supervisor:</span>
                  <span>{selectedZReportShift.closedBySupervisorName || 'Accountant / Manager'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Opened At:</span>
                  <span>{new Date(selectedZReportShift.openedAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Closed At:</span>
                  <span>{new Date(selectedZReportShift.closedAt || Date.now()).toLocaleString()}</span>
                </div>
              </div>

              {/* Cash Reconciliation Math */}
              <div className="border-t border-b border-dashed border-gray-400 py-2 space-y-0.5">
                <div className="font-bold text-[10px] uppercase text-gray-700">Cash Drawer Reconciliation:</div>
                <div className="flex justify-between">
                  <span>Opening Float:</span>
                  <span>₨ {Number(selectedZReportShift.openingFloat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Cash Sales:</span>
                  <span>₨ {Number(selectedZReportShift.totalCashSales || selectedZReportShift.eodReport?.cashSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Drawer Cash:</span>
                  <span className="font-bold">₨ {Number(selectedZReportShift.expectedCash || selectedZReportShift.eodReport?.expectedCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Counted Physical Cash:</span>
                  <span className="font-bold">₨ {Number(selectedZReportShift.closingCash || selectedZReportShift.eodReport?.closingCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-gray-300">
                  <span>Variance / Discrepancy:</span>
                  <span className={Number(selectedZReportShift.cashDiscrepancy) < 0 ? 'text-red-600' : 'text-green-700'}>
                    ₨ {Number(selectedZReportShift.cashDiscrepancy || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-600">
                End of Day Settlement Complete • Verified by Accountant
              </div>
            </div>

            <div className={`flex items-center gap-2 pt-2 border-t shrink-0 ${isDark ? 'border-[#262b29]' : 'border-slate-200'}`}>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                className="flex-1 py-2 bg-[#006b45] hover:bg-[#036c46] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Slip</span>
              </button>
              <button
                onClick={() => setSelectedZReportShift(null)}
                className={`flex-1 py-2 font-bold cursor-pointer ${
                  isDark
                    ? 'bg-[#1c211e] hover:bg-[#262b29] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
