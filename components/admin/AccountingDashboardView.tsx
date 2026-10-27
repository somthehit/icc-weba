'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  Calculator,
  Banknote,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  FileText,
  FileCheck,
  Shield,
  ShieldCheck,
  Calendar,
  Clock,
  Printer,
  ChevronRight,
  ChevronLeft,
  Menu,
  ExternalLink,
  X,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Plus,
  Search,
  Filter,
  Download,
  Boxes,
  Truck,
  Building2,
  Users,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Hash,
  Landmark,
  Scale,
  Activity,
  Sliders,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { AccountingModule } from '@/components/admin/AccountingModule';
import { BankReconciliationView } from '@/components/admin/BankReconciliationView';
import { CashierShiftDetailsModal } from '@/components/admin/CashierShiftDetailsModal';
import { CashierRosterView } from '@/components/admin/CashierRosterView';
import { formatNpr } from '@/lib/nepal/money';
import { adToBs, formatDualDate } from '@/lib/nepal/date';

export type AccountingTab =
  | 'overview'
  | 'shifts'
  | 'cashiers'
  | 'eod'
  | '3way-match'
  | 'supplier-payments'
  | 'vat-registers'
  | 'statements'
  | 'bank-reconciliation'
  | 'ledger';

export const AccountingDashboardView: React.FC = () => {
  const { products, orders, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<AccountingTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [useBsDate, setUseBsDate] = useState(true);

  // Accounting Officer Identity from session cookie
  const [accountingOfficer, setAccountingOfficer] = useState<{
    id: string;
    name: string;
    staffCode: string;
    role: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)accounting_session=([^;]+)/);
      if (match) {
        setAccountingOfficer(JSON.parse(decodeURIComponent(match[1])));
      }
    } catch {}
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    document.cookie = 'accounting_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = '/accounting/login';
  };

  // Client-only date/time state (prevents SSR hydration mismatch)
  const [clientDate, setClientDate] = useState('');
  const [clientTime, setClientTime] = useState('');

  // Global State
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Cashier Shifts State
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<'OPEN' | 'CLOSE'>('OPEN');
  const [denominations, setDenominations] = useState<Record<string, number>>({
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });
  const [supervisorPin, setSupervisorPin] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [isProcessingShift, setIsProcessingShift] = useState(false);

  // Cashier Shift Detailed Inspection Modal State
  const [inspectingShiftId, setInspectingShiftId] = useState<number | null>(null);
  const [isShiftDetailsOpen, setIsShiftDetailsOpen] = useState(false);

  // Cashier Shifts Sub-Navigation View
  const [shiftsSubTab, setShiftsSubTab] = useState<'sessions' | 'transactions' | 'logs'>('sessions');
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isLoadingAllTx, setIsLoadingAllTx] = useState(false);
  const [allTxSearch, setAllTxSearch] = useState('');
  const [allTxPaymentFilter, setAllTxPaymentFilter] = useState('all');
  const [expandedAllTxIds, setExpandedAllTxIds] = useState<Record<string, boolean>>({});

  const [allShiftLogs, setAllShiftLogs] = useState<{ logs: any[]; cashOperations: any[] }>({ logs: [], cashOperations: [] });
  const [isLoadingAllLogs, setIsLoadingAllLogs] = useState(false);

  // Cashiers Roster State
  const [cashiersList, setCashiersList] = useState<any[]>([]);
  const [selectedCashierForPin, setSelectedCashierForPin] = useState<any | null>(null);
  const [newCashierPin, setNewCashierPin] = useState('');

  // EOD & Z-Report State
  const [eodData, setEodData] = useState<any | null>(null);
  const [isEodModalOpen, setIsEodModalOpen] = useState(false);
  const [eodPin, setEodPin] = useState('');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [viewingZReport, setViewingZReport] = useState<any | null>(null);
  const [isFinalizingEod, setIsFinalizingEod] = useState(false);

  // 3-Way Match & Procurement State
  const [matchesList, setMatchesList] = useState<any[]>([]);

  // Supplier Payments & AP Aging State
  const [supplierPaymentsData, setSupplierPaymentsData] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    supplierId: '',
    billId: '',
    grossAmount: '',
    tdsRate: 1.5,
    paymentMethod: 'Nabil Bank Operating A/C',
    bankReference: '',
    notes: '',
  });

  // VAT Registers State
  const [vatData, setVatData] = useState<any | null>(null);

  // Financial Statements State
  const [statementType, setStatementType] = useState<'balance_sheet' | 'income_statement' | 'cash_flow' | 'day_book'>('balance_sheet');
  const [statementsData, setStatementsData] = useState<any | null>(null);

  // Bank Reconciliation State
  const [bankData, setBankData] = useState<any | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  // Live Total Denomination Counter calculation
  const totalDenominationSum = useMemo(() => {
    const keys = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
    return keys.reduce((acc, val) => acc + (Number(denominations[val] || 0) * val), 0);
  }, [denominations]);

  // Populate client-side date/time after mount to avoid SSR hydration mismatch
  useEffect(() => {
    const now = new Date();
    setClientDate(now.toDateString());
    setClientTime(now.toLocaleTimeString());
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    fetchOverview();
    fetchShifts();
    fetchCashiers();
    fetchEodStatus();
    fetch3WayMatches();
    fetchSupplierPayments();
    fetchVatRegisters();
    fetchStatements();
    fetchBankReconciliation();
  };

  const fetchOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const res = await fetch('/api/accounting/overview');
      const data = await res.json();
      if (data.success) setOverviewData(data);
    } catch (e) {
      console.warn('Error fetching overview:', e);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/accounting/shifts');
      const data = await res.json();
      if (data.success) setShiftsList(data.shifts || []);
    } catch (e) {
      console.warn('Error fetching shifts:', e);
    }
  };

  const fetchAllTransactions = async () => {
    setIsLoadingAllTx(true);
    try {
      const res = await fetch('/api/accounting/shifts?view=all_transactions');
      const data = await res.json();
      if (data.success) {
        setAllTransactions(data.transactions || []);
        if (data.transactions?.length > 0) {
          setExpandedAllTxIds({ [data.transactions[0].id]: true });
        }
      }
    } catch (e) {
      console.warn('Error fetching all transactions:', e);
    } finally {
      setIsLoadingAllTx(false);
    }
  };

  const fetchAllShiftLogs = async () => {
    setIsLoadingAllLogs(true);
    try {
      const res = await fetch('/api/accounting/shifts?view=all_logs');
      const data = await res.json();
      if (data.success) {
        setAllShiftLogs({
          logs: data.logs || [],
          cashOperations: data.cashOperations || [],
        });
      }
    } catch (e) {
      console.warn('Error fetching all logs:', e);
    } finally {
      setIsLoadingAllLogs(false);
    }
  };

  // Re-fetch transactions or logs when switching shifts sub-tabs
  useEffect(() => {
    if (activeTab === 'shifts') {
      if (shiftsSubTab === 'transactions' && allTransactions.length === 0) {
        fetchAllTransactions();
      } else if (shiftsSubTab === 'logs' && allShiftLogs.logs.length === 0) {
        fetchAllShiftLogs();
      }
    }
  }, [activeTab, shiftsSubTab]);

  const fetchCashiers = async () => {
    try {
      const res = await fetch('/api/accounting/cashiers');
      const data = await res.json();
      if (data.success) setCashiersList(data.cashiers || []);
    } catch (e) {
      console.warn('Error fetching cashiers:', e);
    }
  };

  const fetchEodStatus = async () => {
    try {
      const res = await fetch('/api/accounting/eod');
      const data = await res.json();
      if (data.success) setEodData(data);
    } catch (e) {
      console.warn('Error fetching EOD:', e);
    }
  };

  const fetch3WayMatches = async () => {
    try {
      const res = await fetch('/api/accounting/3-way-match');
      const data = await res.json();
      if (data.success) setMatchesList(data.matches || []);
    } catch (e) {
      console.warn('Error fetching 3-way matches:', e);
    }
  };

  const fetchSupplierPayments = async () => {
    try {
      const res = await fetch('/api/accounting/supplier-payments');
      const data = await res.json();
      if (data.success) setSupplierPaymentsData(data);
    } catch (e) {
      console.warn('Error fetching supplier payments:', e);
    }
  };

  const fetchVatRegisters = async () => {
    try {
      const res = await fetch('/api/accounting/vat-register');
      const data = await res.json();
      if (data.success) setVatData(data);
    } catch (e) {
      console.warn('Error fetching VAT registers:', e);
    }
  };

  const fetchStatements = async () => {
    try {
      const res = await fetch('/api/accounting/statements');
      const data = await res.json();
      if (data.success) setStatementsData(data);
    } catch (e) {
      console.warn('Error fetching statements:', e);
    }
  };

  const fetchBankReconciliation = async () => {
    try {
      const res = await fetch('/api/accounting/bank-reconciliation');
      const data = await res.json();
      if (data.success) setBankData(data);
    } catch (e) {
      console.warn('Error fetching bank reconciliation:', e);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  // Handle Shift Submit (Open / Blind Close)
  const handleShiftAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingShift(true);
    try {
      const payload: any = {
        action: shiftModalMode === 'OPEN' ? 'OPEN_SHIFT' : 'BLIND_CLOSE_SHIFT',
        denominations,
        notes: shiftNotes,
      };

      if (shiftModalMode === 'CLOSE' && selectedShift) {
        payload.shiftId = selectedShift.id;
        if (supervisorPin) payload.supervisorPin = supervisorPin;
      }

      const res = await fetch('/api/accounting/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Shift action completed successfully.');
        setIsShiftModalOpen(false);
        setSelectedShift(null);
        setSupervisorPin('');
        setShiftNotes('');
        setDenominations({ 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
        fetchAllData();
      } else {
        if (data.needsSupervisorApproval) {
          showToast('error', data.message || 'Supervisor PIN required due to variance.');
        } else {
          showToast('error', data.error || 'Failed to complete shift action.');
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error');
    } finally {
      setIsProcessingShift(false);
    }
  };

  // Handle Cashier PIN Reset
  const handleResetCashierPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCashierForPin || !newCashierPin) return;
    try {
      const res = await fetch('/api/accounting/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESET_PIN',
          userId: selectedCashierForPin.id,
          posPin: newCashierPin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `PIN updated for ${selectedCashierForPin.name}`);
        setSelectedCashierForPin(null);
        setNewCashierPin('');
        fetchCashiers();
      } else {
        showToast('error', data.error || 'Failed to reset PIN');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle EOD Finalize
  const handleFinalizeEod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eodPin) {
      showToast('error', 'Supervisor PIN is required to finalize business day.');
      return;
    }
    setIsFinalizingEod(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/accounting/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FINALIZE_EOD',
          businessDate: todayStr,
          supervisorPin: eodPin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'EOD Finalized and Z-Report generated!');
        setIsEodModalOpen(false);
        setEodPin('');
        if (data.zReport) setViewingZReport(data.zReport);
        fetchAllData();
      } else {
        showToast('error', data.error || 'Failed to finalize EOD.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsFinalizingEod(false);
    }
  };

  // Handle Reopen Business Day
  const handleReopenDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eodPin || !reopenReason) {
      showToast('error', 'Admin PIN and written justification reason are required.');
      return;
    }
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/accounting/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REOPEN_DAY',
          businessDate: todayStr,
          supervisorPin: eodPin,
          reopenReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsReopenModalOpen(false);
        setEodPin('');
        setReopenReason('');
        fetchAllData();
      } else {
        showToast('error', data.error || 'Failed to reopen day.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle Supplier Payment Record
  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.supplierId || !paymentForm.grossAmount) {
      showToast('error', 'Please select a supplier and enter gross payment amount.');
      return;
    }
    try {
      const res = await fetch('/api/accounting/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: paymentForm.supplierId,
          billId: paymentForm.billId || undefined,
          grossAmount: paymentForm.grossAmount,
          tdsRate: paymentForm.tdsRate,
          paymentMethod: paymentForm.paymentMethod,
          bankReference: paymentForm.bankReference,
          notes: paymentForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Payment recorded and posted to GL with 1.5% TDS.');
        setIsPaymentModalOpen(false);
        setPaymentForm({
          supplierId: '',
          billId: '',
          grossAmount: '',
          tdsRate: 1.5,
          paymentMethod: 'Nabil Bank Operating A/C',
          bankReference: '',
          notes: '',
        });
        fetchAllData();
      } else {
        showToast('error', data.error || 'Failed to record supplier payment.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle Bank Statement Line Reconcile
  const handleReconcileStatementLine = async (statementId: number) => {
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECONCILE_LINE',
          statementId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Statement line reconciled.');
        fetchBankReconciliation();
      } else {
        showToast('error', data.error || 'Failed to reconcile line.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const kpis = overviewData?.kpis;
  const nepaliDate = overviewData?.nepaliDate;

  const tabMeta: Record<
    AccountingTab,
    { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    overview: {
      title: 'Executive Financial Overview & General Ledger',
      subtitle: 'Derived directly from posted double-entry journals: turnover, 13% VAT, liquidity, and margins',
      icon: TrendingUp,
    },
    shifts: {
      title: 'Cashier Shifts & Blind Close Audit',
      subtitle: 'NPR denomination counter, blind counts, variance detection, and supervisor PIN authorization',
      icon: Banknote,
    },
    cashiers: {
      title: 'Cashier Management & Performance Roster',
      subtitle: 'Staff POS roles, device-bound limits, PIN resets, and cash variance anomaly tracking',
      icon: Users,
    },
    eod: {
      title: 'End of Day (EOD) Close & Z-Report',
      subtitle: 'Maker-checker EOD gate, immutable SHA-256 Z-Reports, and business day locking',
      icon: Lock,
    },
    '3way-match': {
      title: 'Procurement 3-Way Match (PO → GRN → Bill)',
      subtitle: 'Reconcile purchase orders, warehouse goods received notes, and supplier tax invoices',
      icon: Boxes,
    },
    'supplier-payments': {
      title: 'Supplier Payables & 1.5% TDS Settlement',
      subtitle: 'AP Aging (0-30/31-60/61-90/90+ days), bill allocations, and statutory withholding tax',
      icon: Landmark,
    },
    'vat-registers': {
      title: 'Nepal IRD VAT Registers (Annex 13 & Annex 8)',
      subtitle: 'Official Sales Register, Purchase Register, monthly VAT return worksheet, and CBMS sync',
      icon: Receipt,
    },
    statements: {
      title: 'Statutory Financial Statements (P&L, Balance Sheet)',
      subtitle: 'Income statement with gross margins, balanced balance sheet, cash flow, and day book',
      icon: Scale,
    },
    'bank-reconciliation': {
      title: 'Bank & Digital Wallet Reconciliation',
      subtitle: 'Nabil Bank, NIMB Bank, eSewa, Khalti, and Fonepay QR statement auto-matching',
      icon: Wallet,
    },
    ledger: {
      title: 'Chart of Accounts & Double-Entry Journal Postings',
      subtitle: 'Universal Nepal chart of accounts, immutable journals, and voucher drill-down',
      icon: Layers,
    },
  };

  const CurrentTabIcon = tabMeta[activeTab]?.icon || TrendingUp;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border transition-all animate-bounce ${
            notice.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50'
              : notice.type === 'info'
              ? 'bg-blue-950/95 text-blue-200 border-blue-500/50'
              : 'bg-rose-950/95 text-rose-200 border-rose-500/50'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : notice.type === 'info' ? (
            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{notice.message}</span>
          <button onClick={() => setNotice(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Layout: Left Sidebar + Main Stage */}
      <div className="flex-1 flex">
        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* ================= LEFT SIDEBAR NAVIGATION ================= */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900/98 backdrop-blur-2xl border-r border-slate-800 flex flex-col justify-between flex-shrink-0 transition-transform duration-300 lg:transition-none ${
            isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          } lg:translate-x-0 lg:sticky lg:top-0 lg:bottom-auto lg:self-start lg:h-screen lg:z-30`}
        >
          {/* Top Header and Nav Links */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Brand Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-white shadow-lg shadow-blue-500/20 border border-blue-400/30">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                    <span>Accounting Hub</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                      ERP
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Single Source of Truth</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Menu Items */}
            <div className="px-3 py-4 space-y-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Section 1: Executive */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Executive Suite
                </div>
                <button
                  onClick={() => {
                    setActiveTab('overview');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'overview'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className={`w-4 h-4 ${activeTab === 'overview' ? 'text-white' : 'text-blue-400'}`} />
                    <span>Executive Overview</span>
                  </div>
                  {activeTab === 'overview' && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                </button>
              </div>

              {/* Section 2: Cash & Operations */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Cash & Cashier Control
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('shifts');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'shifts'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className={`w-4 h-4 ${activeTab === 'shifts' ? 'text-white' : 'text-emerald-400'}`} />
                      <span>Cashier Blind Close</span>
                    </div>
                    {overviewData?.kpis?.openShifts > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-bold">
                        {overviewData?.kpis?.openShifts} Open
                      </span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('cashiers');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'cashiers'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className={`w-4 h-4 ${activeTab === 'cashiers' ? 'text-white' : 'text-cyan-400'}`} />
                      <span>Cashier Staff & PINs</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('eod');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'eod'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Lock className={`w-4 h-4 ${activeTab === 'eod' ? 'text-white' : 'text-amber-400'}`} />
                      <span>EOD & Z-Report Gate</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      Argon2id
                    </span>
                  </button>
                </div>
              </div>

              {/* Section 3: Procurement & Vendor AP */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Procurement & Payables
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('3way-match');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === '3way-match'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Boxes className={`w-4 h-4 ${activeTab === '3way-match' ? 'text-white' : 'text-indigo-400'}`} />
                      <span>3-Way Match (PO/GRN/Bill)</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('supplier-payments');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'supplier-payments'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Landmark className={`w-4 h-4 ${activeTab === 'supplier-payments' ? 'text-white' : 'text-purple-400'}`} />
                      <span>Supplier Payables & TDS</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.5 rounded">
                      1.5% TDS
                    </span>
                  </button>
                </div>
              </div>

              {/* Section 4: Taxation & Statutory Books */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Tax & Financial Statements
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('vat-registers');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'vat-registers'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className={`w-4 h-4 ${activeTab === 'vat-registers' ? 'text-white' : 'text-purple-400'}`} />
                      <span>IRD Nepal VAT Registers</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.5 rounded">
                      Annex 8 & 13
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('statements');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'statements'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Scale className={`w-4 h-4 ${activeTab === 'statements' ? 'text-white' : 'text-blue-400'}`} />
                      <span>Financial Statements (P&L)</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('bank-reconciliation');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'bank-reconciliation'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className={`w-4 h-4 ${activeTab === 'bank-reconciliation' ? 'text-white' : 'text-emerald-400'}`} />
                      <span>Bank & Wallet Match</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('ledger');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'ledger'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Layers className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-white' : 'text-cyan-400'}`} />
                      <span>General Ledger & COA</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-xs text-slate-950 shrink-0 shadow-sm">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {accountingOfficer?.name || currentUser?.name || 'Chief Accountant'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono font-medium truncate flex items-center gap-1">
                    <span>{accountingOfficer?.staffCode || 'ACC01'}</span>
                    <span>•</span>
                    <span className="uppercase">{accountingOfficer?.role || currentUser?.role || 'Finance'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Switch Officer / Sign Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ================= MAIN CONTENT STAGE ================= */}
        <main className="flex-1 min-w-0 bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Top Stage Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm hidden sm:block">
                <CurrentTabIcon className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                    {tabMeta[activeTab]?.title}
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30 hidden md:inline-block">
                    FY 2082/83 (Nepal)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tabMeta[activeTab]?.subtitle}
                </p>
              </div>
            </div>

            {/* Controls: BS/AD Toggle + Live Sync */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* BS/AD Date Switcher */}
              <button
                onClick={() => setUseBsDate(!useBsDate)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
                title="Toggle Nepali BS & Gregorian AD Dates"
              >
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>{useBsDate ? 'Bikram Sambat (BS)' : 'Gregorian (AD)'}</span>
              </button>

              <button
                onClick={fetchAllData}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
                title="Sync from General Ledger"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Sync GL</span>
              </button>

              {activeTab === 'shifts' && (
                <button
                  onClick={() => {
                    setShiftModalMode('OPEN');
                    setIsShiftModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Open Shift</span>
                </button>
              )}

              {activeTab === 'supplier-payments' && (
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-900/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Payment & TDS</span>
                </button>
              )}
            </div>
          </div>

          {/* ================= TAB 1: OVERVIEW & GENERAL LEDGER KPIS ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Data Freshness & Fiscal Period Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>General Ledger Source of Truth</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 font-semibold">
                        LIVE GL FEED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Current Date: <b className="text-slate-200">{useBsDate ? nepaliDate?.bsLong || '16 Ashwin 2082' : clientDate}</b> | Fiscal Year: <b className="text-blue-300">{nepaliDate?.fiscalYear || '2082/83'}</b>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  <div className="text-right text-[11px] font-mono text-slate-400">
                    <div>Refreshed: <span className="text-slate-200">{clientTime || '—'}</span></div>
                    <div className="text-emerald-400 font-semibold">Balanced (Dr = Cr)</div>
                  </div>
                </div>
              </div>

              {/* Primary 4 Core KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>Gross Sales Turnover</span>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold font-mono text-white tracking-tight">
                      NPR {(kpis?.todayGrossSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                      <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" /> +{kpis?.marginPercent || '25.0'}%
                      </span>
                      <span>Realized Margin</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>13% VAT Output Liability</span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold font-mono text-purple-300 tracking-tight">
                      NPR {(kpis?.totalVatLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                      <span className="text-purple-400 font-medium">IRD Annex 13 Output</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>Total Liquid Cash & Bank</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                      NPR {(kpis?.totalLiquidAssets || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                      <span>Vault + Till + Nabil + eSewa</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>Inventory Asset (GL 1060)</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Boxes className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
                      NPR {(kpis?.totalInventoryValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                      <span>{kpis?.totalSkuCount || 0} Stock Items Valued</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Metrics: Liquidity Breakdown & Channel Split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liquidity Accounts */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-bold text-white">Liquid Asset Position (GL Sub-Ledgers)</h3>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Multi-Bank / Wallet</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Till Drawer (1010)</div>
                      <div className="text-base font-bold font-mono text-white mt-1">
                        NPR {(overviewData?.liquidityBreakdown?.posTillCash || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Main Vault (1020)</div>
                      <div className="text-base font-bold font-mono text-white mt-1">
                        NPR {(overviewData?.liquidityBreakdown?.vaultCash || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Nabil Bank (1030)</div>
                      <div className="text-base font-bold font-mono text-white mt-1">
                        NPR {(overviewData?.liquidityBreakdown?.nabilBank || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">eSewa Wallet (1040)</div>
                      <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                        NPR {(overviewData?.liquidityBreakdown?.esewaWallet || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Channel Breakdown */}
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-300 mb-2">Sales Revenue by Channel</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/20">
                        <div className="text-[10px] text-blue-300 font-medium">Physical POS Counter</div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">
                          NPR {(overviewData?.channelSplit?.posSales || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
                        <div className="text-[10px] text-purple-300 font-medium">E-Commerce Store</div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">
                          NPR {(overviewData?.channelSplit?.ecomSales || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                        <div className="text-[10px] text-emerald-300 font-medium">Services & Repairs</div>
                        <div className="text-sm font-bold font-mono text-white mt-0.5">
                          NPR {(overviewData?.channelSplit?.services || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Center & Anomaly Alerts */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">Action Center & Alerts</h3>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-200">Open Shifts Remaining</div>
                        <div className="text-[10px] text-slate-400">Must be blind closed before EOD</div>
                      </div>
                      <span className="font-mono font-bold text-amber-400">{kpis?.openShifts || 0}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-200">VAT Return Deadline</div>
                        <div className="text-[10px] text-slate-400">Monthly IRD Annex 13 Filing</div>
                      </div>
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                        25th Ashwin
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-200">Maker-Checker Policy</div>
                        <div className="text-[10px] text-slate-400">Supervisor PIN required for variances</div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: CASHIER SHIFTS & BLIND CLOSE ================= */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              {/* Header & Sub-Navigation Pills */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Cashier Shifts, Live Transactions & Audit Logs</h2>
                    <span className="text-xs text-slate-400 font-mono">({shiftsList.length} Shifts Recorded)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any shift row to inspect line-by-line items, denomination counts, variance audits, and official X/Z reports.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => setShiftsSubTab('sessions')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      shiftsSubTab === 'sessions'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Shift Sessions ({shiftsList.length})</span>
                  </button>

                  <button
                    onClick={() => setShiftsSubTab('transactions')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      shiftsSubTab === 'transactions'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Live Transactions (Line-by-Line)</span>
                  </button>

                  <button
                    onClick={() => setShiftsSubTab('logs')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      shiftsSubTab === 'logs'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Shift & Terminal Logs</span>
                  </button>
                </div>
              </div>

              {/* SUB-VIEW 1: SHIFT SESSIONS TABLE */}
              {shiftsSubTab === 'sessions' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Shift # & Terminal</th>
                          <th className="p-3.5">Cashier</th>
                          <th className="p-3.5">Opening Float</th>
                          <th className="p-3.5">Expected Cash</th>
                          <th className="p-3.5">Counted Cash</th>
                          <th className="p-3.5">Variance</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {shiftsList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500">
                              No cashier shifts recorded yet. Open a shift to begin counter sales.
                            </td>
                          </tr>
                        ) : (
                          shiftsList.map((s) => {
                            const disc = Number(s.cashDiscrepancy || 0);
                            const isShort = disc < 0;
                            const isOver = disc > 0;
                            const openingFloatVal = Number(s.openingFloat || s.openingCash || 0);
                            const expectedVal = Number(s.expectedCash || 0);
                            const countedVal = s.closingCash !== null && s.closingCash !== undefined ? Number(s.closingCash) : null;

                            return (
                              <tr
                                key={s.id}
                                onClick={() => {
                                  setInspectingShiftId(s.id);
                                  setIsShiftDetailsOpen(true);
                                }}
                                className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                              >
                                <td className="p-3.5">
                                  <div className="font-mono font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                    <Receipt className="w-3.5 h-3.5 text-blue-400" />
                                    {s.shiftNumber}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                    <span className="text-slate-300 font-semibold">{s.registerCode || 'REG-01'}</span>
                                    <span>•</span>
                                    <span>{s.totalTransactions || 0} Bills</span>
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <div className="font-semibold text-slate-200">{s.cashierName || 'Cashier'}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    Opened: {s.openedAt ? new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </div>
                                </td>
                                <td className="p-3.5 font-mono text-slate-300">
                                  {formatNpr(openingFloatVal)}
                                </td>
                                <td className="p-3.5 font-mono font-semibold text-white">
                                  {formatNpr(expectedVal)}
                                </td>
                                <td className="p-3.5 font-mono">
                                  {countedVal !== null ? (
                                    <span className="text-white font-semibold">{formatNpr(countedVal)}</span>
                                  ) : (
                                    <span className="text-slate-500">—</span>
                                  )}
                                </td>
                                <td className="p-3.5 font-mono">
                                  {s.status === 'CLOSED' || countedVal !== null ? (
                                    <span
                                      className={`px-2 py-0.5 rounded font-bold ${
                                        disc === 0
                                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                          : isShort
                                          ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                                          : 'bg-blue-950 text-blue-300 border border-blue-500/30'
                                      }`}
                                    >
                                      {disc > 0 ? `+${disc}` : disc}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">In Progress</span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      s.status === 'OPEN'
                                        ? 'bg-amber-950 text-amber-400 border border-amber-500/30 animate-pulse'
                                        : s.status === 'SUBMITTED'
                                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {s.status}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectingShiftId(s.id);
                                        setIsShiftDetailsOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all"
                                      title="Inspect Line-by-line Transactions, Items, and Reports"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                                      <span>Audit & Txns</span>
                                    </button>

                                    {s.status === 'OPEN' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedShift(s);
                                          setShiftModalMode('CLOSE');
                                          setIsShiftModalOpen(true);
                                        }}
                                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
                                      >
                                        Blind Close
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: LIVE CASHIER TRANSACTIONS (LINE-BY-LINE) */}
              {shiftsSubTab === 'transactions' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={allTxSearch}
                        onChange={(e) => setAllTxSearch(e.target.value)}
                        placeholder="Search cashier transactions by Invoice #, cashier name, customer, product..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">Payment:</span>
                      {['all', 'cash', 'card', 'qr', 'esewa', 'khalti'].map((m) => (
                        <button
                          key={m}
                          onClick={() => setAllTxPaymentFilter(m)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                            allTxPaymentFilter === m
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {m === 'qr' ? 'Fonepay QR' : m}
                        </button>
                      ))}
                      <button
                        onClick={fetchAllTransactions}
                        disabled={isLoadingAllTx}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                        title="Refresh Transactions"
                      >
                        <RefreshCw className={`w-4 h-4 ${isLoadingAllTx ? 'animate-spin text-blue-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                          <tr>
                            <th className="p-3.5 w-8"></th>
                            <th className="p-3.5">Invoice #</th>
                            <th className="p-3.5">Date & Time</th>
                            <th className="p-3.5">Cashier</th>
                            <th className="p-3.5">Terminal</th>
                            <th className="p-3.5">Customer</th>
                            <th className="p-3.5">Tender Method</th>
                            <th className="p-3.5 text-center">Items</th>
                            <th className="p-3.5 text-right">Total (NPR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {isLoadingAllTx ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-slate-500">
                                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                                Loading cashier sales ledger...
                              </td>
                            </tr>
                          ) : allTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-slate-500">
                                No POS transactions recorded yet.
                              </td>
                            </tr>
                          ) : (
                            allTransactions
                              .filter((tx) => {
                                if (allTxPaymentFilter !== 'all') {
                                  const p = (tx.paymentMethod || '').toLowerCase();
                                  if (allTxPaymentFilter === 'cash' && p !== 'cash') return false;
                                  if (allTxPaymentFilter === 'card' && p !== 'card') return false;
                                  if (allTxPaymentFilter === 'qr' && !p.includes('fonepay') && !p.includes('qr') && p !== 'esewa' && p !== 'khalti') return false;
                                  if (allTxPaymentFilter === 'esewa' && p !== 'esewa') return false;
                                  if (allTxPaymentFilter === 'khalti' && p !== 'khalti') return false;
                                }
                                if (allTxSearch.trim()) {
                                  const q = allTxSearch.toLowerCase().trim();
                                  const inv = (tx.invoiceNumber || '').toLowerCase();
                                  const cName = (tx.cashierName || '').toLowerCase();
                                  const custName = (tx.customerName || '').toLowerCase();
                                  const custPhone = (tx.customerPhone || '').toLowerCase();
                                  const hasItem = Array.isArray(tx.items) && tx.items.some((it: any) =>
                                    (it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q)
                                  );
                                  return inv.includes(q) || cName.includes(q) || custName.includes(q) || custPhone.includes(q) || hasItem;
                                }
                                return true;
                              })
                              .map((tx) => {
                                const isExp = Boolean(expandedAllTxIds[tx.id]);
                                const items = Array.isArray(tx.items) ? tx.items : [];
                                const totalAmt = Number(tx.totalAmount || 0);

                                return (
                                  <React.Fragment key={tx.id}>
                                    <tr
                                      onClick={() => {
                                        setExpandedAllTxIds((prev) => ({ ...prev, [tx.id]: !prev[tx.id] }));
                                      }}
                                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                                    >
                                      <td className="p-3 text-center text-slate-500">
                                        {isExp ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4" />}
                                      </td>
                                      <td className="p-3 font-mono font-bold text-white flex items-center gap-1.5">
                                        <Receipt className="w-3.5 h-3.5 text-blue-400" />
                                        {tx.invoiceNumber}
                                      </td>
                                      <td className="p-3 font-mono text-slate-400 text-[11px]">
                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                      </td>
                                      <td className="p-3 font-semibold text-slate-200">
                                        {tx.cashierName || 'Cashier'}
                                      </td>
                                      <td className="p-3 font-mono text-blue-400 text-[11px]">
                                        {tx.terminalCode || 'REG-01'}
                                      </td>
                                      <td className="p-3 text-slate-300">
                                        {tx.customerName || 'Walk-in'}
                                      </td>
                                      <td className="p-3">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                                          {tx.paymentMethod}
                                        </span>
                                      </td>
                                      <td className="p-3 text-center font-mono font-semibold">
                                        {items.length}
                                      </td>
                                      <td className="p-3 text-right font-mono font-bold text-white text-sm">
                                        {formatNpr(totalAmt)}
                                      </td>
                                    </tr>

                                    {/* Line Items Expansion */}
                                    {isExp && (
                                      <tr className="bg-slate-950/80 border-y border-slate-800">
                                        <td colSpan={9} className="p-4">
                                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                                            <div className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                                              <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                                              Line Items Sold ({items.length} items)
                                            </div>
                                            <div className="divide-y divide-slate-800/60">
                                              {items.map((line: any, lIdx: number) => {
                                                const uPrice = Number(line.unitPrice || line.price || 0);
                                                const qty = Number(line.quantity || 1);
                                                const lTotal = Number(line.lineTotal || uPrice * qty);
                                                return (
                                                  <div key={lIdx} className="py-1.5 flex items-center justify-between text-xs">
                                                    <div>
                                                      <span className="text-white font-medium">{line.name}</span>
                                                      <span className="text-[11px] font-mono text-slate-400 ml-2">SKU: {line.sku || '—'}</span>
                                                    </div>
                                                    <div className="font-mono text-right flex items-center gap-4">
                                                      <span className="text-slate-400">{formatNpr(uPrice, { showCurrency: false })} × {qty}</span>
                                                      <span className="font-bold text-emerald-400">{formatNpr(lTotal)}</span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
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

              {/* SUB-VIEW 3: SHIFT & TERMINAL AUDIT LOGS */}
              {shiftsSubTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Live Cashier & Shift Audit Trail
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tamper-evident logs of shift initializations, safe drops, supervisor PIN authorizations, and blind counts.
                      </p>
                    </div>
                    <button
                      onClick={fetchAllShiftLogs}
                      disabled={isLoadingAllLogs}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAllLogs ? 'animate-spin text-blue-400' : ''}`} />
                      Refresh Logs
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
                    {isLoadingAllLogs ? (
                      <div className="py-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                        Loading audit logs...
                      </div>
                    ) : (
                      <>
                        {/* Cash Operations */}
                        {allShiftLogs.cashOperations.map((op: any) => (
                          <div key={op.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono mt-0.5 ${
                                  op.type === 'CASH_IN'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : op.type === 'SAFE_DROP'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                                    : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {op.type}
                              </span>
                              <div>
                                <div className="font-semibold text-white">
                                  {op.reason} • Amount: <strong className="text-emerald-400">{formatNpr(op.amount)}</strong>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Shift #{op.shiftId || op.shift_id} • Performed by: <strong>{op.performedByName || op.performed_by_name}</strong>
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">
                              {op.createdAt || op.created_at ? new Date(op.createdAt || op.created_at).toLocaleString() : '—'}
                            </span>
                          </div>
                        ))}

                        {/* Audit Logs */}
                        {allShiftLogs.logs.map((log: any) => (
                          <div key={log.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                            <div className="flex items-start gap-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono mt-0.5 bg-amber-950 text-amber-300 border border-amber-500/30">
                                {log.action}
                              </span>
                              <div>
                                <div className="font-semibold text-white">
                                  Entity: {log.entityType || log.entity_type} #{log.entityId || log.entity_id}
                                </div>
                                {log.metadata && typeof log.metadata === 'object' && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {Object.entries(log.metadata)
                                      .filter(([k, v]) => !['hash', 'previoushash'].includes(k.toLowerCase()) && v !== null && v !== undefined && typeof v !== 'object')
                                      .map(([k, v]) => (
                                        <span
                                          key={k}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300"
                                        >
                                          <span className="text-slate-500">{k}:</span>
                                          <span className="text-slate-200 font-semibold">{String(v)}</span>
                                        </span>
                                      ))}
                                  </div>
                                )}
                                {log.metadata && typeof log.metadata === 'string' && (
                                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                                    {log.metadata}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">
                              {log.createdAt || log.created_at ? new Date(log.createdAt || log.created_at).toLocaleString() : '—'}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: CASHIERS ROSTER & PIN RESET ================= */}
          {activeTab === 'cashiers' && (
            <CashierRosterView useBsDate={useBsDate} showToast={showToast} />
          )}

          {/* ================= TAB 4: EOD GATE & Z-REPORT ================= */}
          {activeTab === 'eod' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Business Day Fiscal Close Validation</h3>
                      <p className="text-xs text-slate-400">Status: <b className="text-amber-400">{eodData?.status || 'OPEN'}</b></p>
                    </div>
                  </div>

                  {eodData?.status === 'CLOSED' ? (
                    <button
                      onClick={() => setIsReopenModalOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Reopen Day (Admin)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEodModalOpen(true)}
                      disabled={!eodData?.canFinalize}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Finalize EOD & Issue Z-Report</span>
                    </button>
                  )}
                </div>

                {eodData?.blockers?.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>EOD Finalization Blockers:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-300">
                      {eodData.blockers.map((b: string, i: number) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Day Summary Snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Day Total Orders</div>
                    <div className="text-base font-bold text-white mt-0.5">{eodData?.summary?.totalOrders || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Day Gross Sales</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      NPR {(eodData?.summary?.grossSales || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">13% VAT Collected</div>
                    <div className="text-base font-bold text-purple-400 mt-0.5">
                      NPR {(eodData?.summary?.vatAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Cash Variance</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">
                      NPR {(eodData?.summary?.totalCashVariance || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {eodData?.zReport && (
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-400 font-mono">
                      Active Z-Report: <b className="text-white">{eodData.zReport.reportNumber}</b> (Hash: {eodData.zReport.integrityHash?.slice(0, 16)}...)
                    </div>
                    <button
                      onClick={() => setViewingZReport(eodData.zReport)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Z-Report Slip</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 5: 3-WAY MATCH PROCUREMENT ================= */}
          {activeTab === '3way-match' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Purchase Order vs GRN vs Supplier Bill Match</h2>
                  <p className="text-xs text-slate-400">Three-way reconciliation for warehouse inventory procurement</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">PO #</th>
                        <th className="p-3.5">Supplier</th>
                        <th className="p-3.5">Ordered Qty / Amt</th>
                        <th className="p-3.5">GRN Received</th>
                        <th className="p-3.5">Billed Amt</th>
                        <th className="p-3.5">Variance (Qty / Price)</th>
                        <th className="p-3.5">Match Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                      {matchesList.map((m) => (
                        <tr key={m.poId} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">{m.poNumber}</td>
                          <td className="p-3.5 font-sans">{m.supplierName}</td>
                          <td className="p-3.5">
                            {m.poTotalQty} pcs (NPR {m.poTotalAmount?.toLocaleString('en-IN')})
                          </td>
                          <td className="p-3.5">
                            {m.grnTotalQty} pcs ({m.grnNumbers})
                          </td>
                          <td className="p-3.5">NPR {m.billedAmount?.toLocaleString('en-IN')}</td>
                          <td className="p-3.5">
                            <span className={m.qtyVariance !== 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                              Qty: {m.qtyVariance > 0 ? `+${m.qtyVariance}` : m.qtyVariance}
                            </span>{' '}
                            |{' '}
                            <span className={m.priceVariance !== 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                              Price: {m.priceVariance}
                            </span>
                          </td>
                          <td className="p-3.5 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                m.matchStatus === 'PERFECT_MATCH'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  : m.matchStatus === 'QTY_VARIANCE'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {m.matchStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 6: SUPPLIER PAYMENTS & 1.5% TDS ================= */}
          {activeTab === 'supplier-payments' && (
            <div className="space-y-6">
              {/* AP Aging Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>Accounts Payable (AP) Aging Breakdown</span>
                  </div>
                  <div className="text-xs font-mono text-purple-300 font-bold">
                    Total Dues: NPR {(supplierPaymentsData?.apAging?.totalOutstanding || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-emerald-400">Current (0 - 30 Days)</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      NPR {(supplierPaymentsData?.apAging?.current0to30 || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-blue-400">31 - 60 Days</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      NPR {(supplierPaymentsData?.apAging?.days31to60 || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-amber-400">61 - 90 Days</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      NPR {(supplierPaymentsData?.apAging?.days61to90 || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-rose-400">Over 90 Days (Overdue)</div>
                    <div className="text-base font-bold text-rose-300 mt-0.5">
                      NPR {(supplierPaymentsData?.apAging?.over90days || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments History */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Settlement & TDS Withholding History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">Payment #</th>
                        <th className="p-3.5">Supplier</th>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Gross Settled</th>
                        <th className="p-3.5">1.5% TDS Withheld</th>
                        <th className="p-3.5">Net Paid</th>
                        <th className="p-3.5">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {(supplierPaymentsData?.payments || []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">{p.paymentNumber}</td>
                          <td className="p-3.5 font-sans">{p.supplierName}</td>
                          <td className="p-3.5">{p.paymentDate}</td>
                          <td className="p-3.5">NPR {Number(p.grossSettledAmount).toLocaleString('en-IN')}</td>
                          <td className="p-3.5 text-purple-400 font-bold">
                            NPR {Number(p.tdsAmountWithheld).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-emerald-400 font-bold">
                            NPR {Number(p.netPaidAmount).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 font-sans">{p.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 7: NEPAL IRD VAT REGISTERS ================= */}
          {activeTab === 'vat-registers' && (
            <div className="space-y-6">
              {/* VAT Return Summary Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Monthly VAT Return Worksheet (IRD Nepal)</h3>
                      <p className="text-xs text-slate-400">Filing Period: <b className="text-purple-300">{vatData?.taxPeriod || 'Ashwin 2082'}</b> | Due: <b>{vatData?.vatReturnSummary?.dueDateBs || '25th Kartik 2082'}</b></p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                    {vatData?.vatReturnSummary?.filingStatus || 'READY_TO_FILE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Total Output VAT (Sales)</div>
                    <div className="text-base font-bold text-purple-300 mt-0.5">
                      NPR {(vatData?.vatReturnSummary?.outputVatCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Total Input VAT (Purchases)</div>
                    <div className="text-base font-bold text-blue-300 mt-0.5">
                      NPR {(vatData?.vatReturnSummary?.inputVatClaimable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Net VAT Payable</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">
                      NPR {(vatData?.vatReturnSummary?.netVatPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">CBMS Adapter Sync</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>{vatData?.cbmsAdapter?.status || 'ONLINE'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Register (Annex 13) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-2">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">बिक्री खाता (Sales Register - Annex 13)</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {vatData?.irdAnnex13Sales?.recordsCount || 0} Invoices
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date (BS/AD)</th>
                        <th className="p-3">Buyer Name</th>
                        <th className="p-3">Gross Total</th>
                        <th className="p-3">Taxable Amt</th>
                        <th className="p-3">13% VAT</th>
                        <th className="p-3">CBMS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {(vatData?.irdAnnex13Sales?.rows || []).slice(0, 15).map((r: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-white">{r.invoiceNo}</td>
                          <td className="p-3">{useBsDate ? r.invoiceDateBs : r.invoiceDateAd}</td>
                          <td className="p-3 font-sans">{r.buyerName}</td>
                          <td className="p-3">NPR {r.totalAmount?.toLocaleString('en-IN')}</td>
                          <td className="p-3">NPR {r.taxableAmount?.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-purple-400 font-bold">NPR {r.vatAmount?.toLocaleString('en-IN')}</td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px]">SYNCED</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 8: FINANCIAL STATEMENTS ================= */}
          {activeTab === 'statements' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setStatementType('balance_sheet')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    statementType === 'balance_sheet'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Balance Sheet
                </button>
                <button
                  onClick={() => setStatementType('income_statement')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    statementType === 'income_statement'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Profit & Loss (Income Statement)
                </button>
                <button
                  onClick={() => setStatementType('day_book')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    statementType === 'day_book'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  General Day Book
                </button>
              </div>

              {statementType === 'balance_sheet' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assets */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <h3 className="text-sm font-bold text-white">ASSETS (सम्पत्ति)</h3>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        NPR {(statementsData?.balanceSheet?.assets?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      {(statementsData?.balanceSheet?.assets?.rows || []).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                          <span className="text-slate-300 font-sans">{r.code} - {r.name}</span>
                          <span className="font-bold text-white">NPR {r.balance?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <h3 className="text-sm font-bold text-white">LIABILITIES & EQUITY (दायित्व तथा पुँजी)</h3>
                      <span className="text-xs font-mono font-bold text-purple-400">
                        NPR {(statementsData?.balanceSheet?.totalLiabilitiesAndEquity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="text-[10px] uppercase font-bold text-slate-400 pt-1">Liabilities</div>
                      {(statementsData?.balanceSheet?.liabilities?.rows || []).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                          <span className="text-slate-300 font-sans">{r.code} - {r.name}</span>
                          <span className="font-bold text-white">NPR {r.balance?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}

                      <div className="text-[10px] uppercase font-bold text-slate-400 pt-2">Equity & Retained Earnings</div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                        <span className="text-slate-300 font-sans">Current Year Realized Net Profit</span>
                        <span className="font-bold text-emerald-400">
                          NPR {(statementsData?.balanceSheet?.equity?.currentYearProfit || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {statementType === 'income_statement' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-3xl mx-auto">
                  <div className="text-center pb-3 border-b border-slate-800">
                    <h3 className="text-base font-bold text-white">INCOME STATEMENT (PROFIT & LOSS)</h3>
                    <p className="text-xs text-slate-400 font-mono">FY 2082/83 (Shrawan 1 to Ashadh 32)</p>
                  </div>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between p-2 rounded bg-slate-950 font-bold text-white">
                      <span>Total Revenue / Sales:</span>
                      <span className="text-blue-400">NPR {(statementsData?.incomeStatement?.revenue?.total || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                      <span>Less: Cost of Goods Sold (COGS):</span>
                      <span className="text-rose-400">- NPR {(statementsData?.incomeStatement?.cogs?.total || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between p-2.5 rounded bg-blue-950/40 border border-blue-500/20 font-bold text-white">
                      <span>GROSS PROFIT:</span>
                      <span className="text-emerald-400">NPR {(statementsData?.incomeStatement?.grossProfit || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between p-2 rounded bg-slate-950 text-slate-300">
                      <span>Less: Operating & Cashier Expenses:</span>
                      <span className="text-rose-400">- NPR {(statementsData?.incomeStatement?.operatingExpenses?.total || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 font-bold text-sm text-white">
                      <span>NET PROFIT / (LOSS):</span>
                      <span className="text-emerald-300">NPR {(statementsData?.incomeStatement?.netProfit || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}

              {statementType === 'day_book' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="p-3">Entry #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Lines (Dr / Cr)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {(statementsData?.dayBook || []).map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-bold text-white">{e.entryNumber}</td>
                            <td className="p-3">{e.entryDate}</td>
                            <td className="p-3 font-sans">{e.description}</td>
                            <td className="p-3 space-y-1">
                              {(e.lines || []).map((l: any, idx: number) => (
                                <div key={idx} className="text-[11px] text-slate-400">
                                  <b>{l.accountCode} - {l.accountName}:</b>{' '}
                                  {Number(l.debit) > 0 ? <span className="text-emerald-400">Dr NPR {l.debit}</span> : <span className="text-blue-400">Cr NPR {l.credit}</span>}
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 9: BANK & WALLET RECONCILIATION ================= */}
          {activeTab === 'bank-reconciliation' && (
            <BankReconciliationView
              bankData={bankData}
              useBsDate={useBsDate}
              onRefresh={fetchBankReconciliation}
              showToast={showToast}
            />
          )}

          {/* ================= TAB 10: FULL GENERAL LEDGER ================= */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <AccountingModule orders={orders} products={products} />
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL 1: DENOMINATION COUNTER & SHIFT ================= */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">
                  {shiftModalMode === 'OPEN' ? 'Open Cashier Shift (Float Count)' : 'Blind Close Cashier Shift'}
                </h3>
              </div>
              <button onClick={() => setIsShiftModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShiftAction} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-200">
                <Calculator className="w-4 h-4 inline mr-1.5 text-blue-400" />
                Enter count for each physical Nepali Rupee denomination note to calculate live float.
              </div>

              {/* Denomination Counter Matrix */}
              <div className="grid grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
                {[1000, 500, 100, 50, 20, 10, 5, 2, 1].map((denom) => (
                  <div key={denom} className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">NPR {denom} Notes</label>
                    <input
                      type="number"
                      min={0}
                      value={denominations[denom] || 0}
                      onChange={(e) =>
                        setDenominations({
                          ...denominations,
                          [denom]: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>

              {/* Live Counted Total */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between font-mono">
                <span className="text-xs text-emerald-300 font-semibold">Total Physical Cash:</span>
                <span className="text-lg font-bold text-emerald-400">
                  NPR {totalDenominationSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {shiftModalMode === 'CLOSE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Supervisor PIN Authorization (if variance &gt; NPR 500)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Supervisor PIN (e.g. 5678)"
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingShift}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isProcessingShift ? 'Saving...' : shiftModalMode === 'OPEN' ? 'Open Shift Float' : 'Submit Blind Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CASHIER PIN RESET ================= */}
      {selectedCashierForPin && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Reset POS PIN for {selectedCashierForPin.name}</h3>
              <button onClick={() => setSelectedCashierForPin(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetCashierPin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New 4-Digit POS PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="e.g. 1234"
                  value={newCashierPin}
                  onChange={(e) => setNewCashierPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono text-center tracking-widest focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCashierForPin(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white">
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: SUPPLIER PAYMENT & 1.5% TDS ================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Record Supplier Payment & 1.5% TDS</h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSupplierPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Select Supplier</label>
                <select
                  required
                  value={paymentForm.supplierId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, supplierId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Choose Supplier --</option>
                  {(supplierPaymentsData?.supplierBalances || []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Outstanding: NPR {s.outstanding?.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Gross Invoice Settled Amount (NPR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50000"
                  value={paymentForm.grossAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, grossAmount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Live Nepal TDS Calculation Breakdown */}
              {Number(paymentForm.grossAmount || 0) > 0 && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>1.5% Nepal TDS Withheld:</span>
                    <span className="text-purple-300 font-bold">
                      NPR {((Number(paymentForm.grossAmount) * 1.5) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-white font-bold border-t border-purple-500/20 pt-1">
                    <span>Net Paid via Bank:</span>
                    <span className="text-emerald-400">
                      NPR {(Number(paymentForm.grossAmount) - (Number(paymentForm.grossAmount) * 1.5) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Payment Method / Bank Account</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Nabil Bank Operating A/C">Nabil Bank Operating A/C</option>
                  <option value="NIMB Corporate A/C">Nepal Investment Mega Bank</option>
                  <option value="Cash Office Vault">Cash Office Vault</option>
                  <option value="eSewa Merchant Wallet">eSewa Merchant Wallet</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Bank Cheque / Transaction Reference</label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-998822 or FONEPAY-TXN"
                  value={paymentForm.bankReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankReference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md">
                  Post Payment & GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: EOD FINALIZATION ================= */}
      {isEodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Finalize Business Day (Maker-Checker Gate)</h3>
              </div>
              <button onClick={() => setIsEodModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFinalizeEod} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 inline mr-1.5 text-amber-400" />
                Closing EOD generates an immutable Z-Report, locks all sales registers for the day, and computes full day VAT liability.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supervisor / Manager PIN Authorization <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter Supervisor PIN (e.g. 5678)"
                  value={eodPin}
                  onChange={(e) => setEodPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono text-center tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEodModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFinalizingEod}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isFinalizingEod ? 'Finalizing...' : 'Issue Z-Report & Lock Day'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: REOPEN BUSINESS DAY ================= */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Reopen Closed Business Day</h3>
              </div>
              <button onClick={() => setIsReopenModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReopenDay} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200">
                Reopening a closed day requires Administrator authority and will be logged in the tamper-evident audit trail.
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Admin PIN Authorization</label>
                <input
                  type="password"
                  required
                  placeholder="Enter Admin PIN (e.g. 1234)"
                  value={eodPin}
                  onChange={(e) => setEodPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-center tracking-widest focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Written Justification (Audit Log)</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Reason for reopening locked business day..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white shadow-md">
                  Authorize Reopen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 6: IMMUTABLE Z-REPORT PRINT ================= */}
      {viewingZReport && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8 print:p-0">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <span className="text-xs font-bold text-slate-600 uppercase font-mono">Immutable Z-Report</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button onClick={() => setViewingZReport(null)} className="text-slate-400 hover:text-slate-700 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs font-mono">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-bold text-sm text-slate-900">INTEL COMPUTER CENTER</div>
                <div className="text-[11px] text-slate-600">Dhangadhi, Kailali, Nepal</div>
                <div className="font-bold text-slate-800">VAT/PAN: 601234567</div>
                <div className="font-bold text-purple-700 pt-1">DAILY FISCAL Z-REPORT</div>
              </div>

              <div className="text-[11px] space-y-1">
                <div><b>Report #:</b> {viewingZReport.reportNumber}</div>
                <div><b>Date:</b> {viewingZReport.businessDate} ({viewingZReport.fiscalYear})</div>
                <div><b>Finalized By:</b> {viewingZReport.closedByName}</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Gross Sales Turnover:</span>
                  <span className="font-bold">NPR {Number(viewingZReport.grossSales).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Sales (Excl. VAT):</span>
                  <span>NPR {Number(viewingZReport.netSales).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-purple-700 font-bold">
                  <span>13% Output VAT:</span>
                  <span>NPR {Number(viewingZReport.taxAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Cash Expected:</span>
                  <span>NPR {Number(viewingZReport.cashExpected).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Counted:</span>
                  <span>NPR {Number(viewingZReport.cashCounted).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-dashed border-slate-300">
                  <span>Cash Discrepancy / Variance:</span>
                  <span>NPR {Number(viewingZReport.cashVariance).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                SHA-256 Hash: {viewingZReport.integrityHash?.slice(0, 32)}...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 7: CASHIER SHIFT DETAILS, LINE-BY-LINE TRANSACTIONS & AUDIT ================= */}
      <CashierShiftDetailsModal
        isOpen={isShiftDetailsOpen}
        shiftId={inspectingShiftId}
        onClose={() => {
          setIsShiftDetailsOpen(false);
          setInspectingShiftId(null);
        }}
        onBlindCloseClick={(s) => {
          setSelectedShift(s);
          setShiftModalMode('CLOSE');
          setIsShiftModalOpen(true);
        }}
      />
    </div>
  );
};
