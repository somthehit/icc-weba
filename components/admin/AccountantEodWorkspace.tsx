'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Banknote,
  Search,
  Filter,
  Check,
  X,
  RefreshCw,
  Plus,
  Minus,
  Save,
  Send,
  Lock,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Calendar,
  Building,
  CreditCard,
  QrCode,
  DollarSign,
  ChevronRight,
  ArrowRight,
  AlertOctagon,
} from 'lucide-react';
import { NEPALI_DENOMINATIONS } from '@/components/pos/BodFloatInputModal';
import PrintablePaperEodForm from '@/components/pos/PrintablePaperEodForm';

interface AccountantEodWorkspaceProps {
  onRefreshParent?: () => void;
}

export default function AccountantEodWorkspace({ onRefreshParent }: AccountantEodWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'submissions' | 'payroll'>('submissions');

  // Submissions State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [discrepancyFilter, setDiscrepancyFilter] = useState('ALL');
  const [registerFilter, setRegisterFilter] = useState('ALL');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [receiptModalSub, setReceiptModalSub] = useState<any | null>(null);
  const [receiverName, setReceiverName] = useState('Central Cash Accountant');
  const [isReceiving, setIsReceiving] = useState(false);

  const [reconcileSub, setReconcileSub] = useState<any | null>(null);
  const [denominations, setDenominations] = useState<Record<string, number>>({
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
  const [verifiedCard, setVerifiedCard] = useState<string>('');
  const [cardBatch, setCardBatch] = useState<string>('');
  const [verifiedQr, setVerifiedQr] = useState<string>('');
  const [qrRef, setQrRef] = useState<string>('');
  const [verifiedBank, setVerifiedBank] = useState<string>('');
  const [bankRef, setBankRef] = useState<string>('');
  const [accountantRemarks, setAccountantRemarks] = useState<string>('');
  const [isSavingReconciliation, setIsSavingReconciliation] = useState(false);

  // Clarification Modal
  const [clarifySub, setClarifySub] = useState<any | null>(null);
  const [clarificationReason, setClarificationReason] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Printable View Modal
  const [viewingPrintForm, setViewingPrintForm] = useState<any | null>(null);

  // Payroll Discrepancies State
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [loadingDiscrepancies, setLoadingDiscrepancies] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState('RESOLVED_NO_DEDUCTION');
  const [allowPayrollAdjustment, setAllowPayrollAdjustment] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('0.00');
  const [isResolvingDiscrepancy, setIsResolvingDiscrepancy] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    if (activeTab === 'payroll') {
      fetchDiscrepancies();
    }
  }, [activeTab, statusFilter, discrepancyFilter, registerFilter]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (discrepancyFilter !== 'ALL') params.set('discrepancy', discrepancyFilter);
      if (registerFilter !== 'ALL') params.set('register', registerFilter);
      params.set('_t', Date.now().toString());

      const res = await fetch(`/api/admin/accounting/eod-submissions?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmissions(data.submissions || []);
        setStats(data.stats || null);
      }
    } catch (err: any) {
      console.error('Failed to load EOD submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscrepancies = async () => {
    setLoadingDiscrepancies(true);
    try {
      const res = await fetch(`/api/admin/payroll/discrepancies?_t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDiscrepancies(data.discrepancies || []);
      }
    } catch (err: any) {
      console.error('Failed to load payroll discrepancies:', err);
    } finally {
      setLoadingDiscrepancies(false);
    }
  };

  // 1. Confirm Receipt of Paper EOD Form
  const handleConfirmReceipt = async () => {
    if (!receiptModalSub) return;
    setIsReceiving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/accounting/eod-submissions/${receiptModalSub.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_receipt',
          accountantName: receiverName.trim() || 'Central Cash Accountant',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: data.message });
        setReceiptModalSub(null);
        fetchSubmissions();
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to confirm receipt.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Network error confirming receipt.' });
    } finally {
      setIsReceiving(false);
    }
  };

  // 2. Open Reconciliation Cockpit
  const handleOpenReconcile = (sub: any) => {
    setReconcileSub(sub);
    const existingDenoms = sub.accountantDenominations || {};
    const initialDenoms: Record<string, number> = {
      '1000': existingDenoms['1000'] || 0,
      '500': existingDenoms['500'] || 0,
      '100': existingDenoms['100'] || 0,
      '50': existingDenoms['50'] || 0,
      '20': existingDenoms['20'] || 0,
      '10': existingDenoms['10'] || 0,
      '5': existingDenoms['5'] || 0,
      '2': existingDenoms['2'] || 0,
      '1': existingDenoms['1'] || 0,
    };
    setDenominations(initialDenoms);
    setVerifiedCard(sub.verifiedCardAmount || sub.cardSales || '0');
    setCardBatch(sub.cardBatchNumber || '');
    setVerifiedQr(sub.verifiedQrAmount || sub.qrSales || '0');
    setQrRef(sub.qrSettlementRef || '');
    setVerifiedBank(sub.verifiedBankAmount || sub.bankTransferSales || '0');
    setBankRef(sub.bankAdviceRef || '');
    setAccountantRemarks(sub.accountantRemarks || '');
  };

  const handleQtyChange = (valStr: string, count: number) => {
    const safeCount = Math.max(0, isNaN(count) ? 0 : count);
    setDenominations((prev) => ({
      ...prev,
      [valStr]: safeCount,
    }));
  };

  const countedPhysicalCash = NEPALI_DENOMINATIONS.reduce((sum, d) => {
    const qty = denominations[d.value.toString()] || 0;
    return sum + d.value * qty;
  }, 0);

  const expectedCash = reconcileSub ? Number(reconcileSub.expectedClosingCash || 0) : 0;
  // Positive = Overage, Negative = Shortage
  const cashVariance = Number((countedPhysicalCash - expectedCash).toFixed(2));

  const expectedCard = reconcileSub ? Number(reconcileSub.cardSales || 0) : 0;
  const numVerifiedCard = Number(verifiedCard) || 0;
  const cardVariance = Number((numVerifiedCard - expectedCard).toFixed(2));

  const expectedQr = reconcileSub ? Number(reconcileSub.qrSales || 0) : 0;
  const numVerifiedQr = Number(verifiedQr) || 0;
  const qrVariance = Number((numVerifiedQr - expectedQr).toFixed(2));

  const expectedBank = reconcileSub ? Number(reconcileSub.bankTransferSales || 0) : 0;
  const numVerifiedBank = Number(verifiedBank) || 0;
  const bankVariance = Number((numVerifiedBank - expectedBank).toFixed(2));

  // Save draft or finalize
  const handleSaveReconciliation = async (action: 'save_draft' | 'finalize') => {
    if (!reconcileSub) return;
    setIsSavingReconciliation(true);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/accounting/eod-submissions/${reconcileSub.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          accountantName: receiverName || 'Central Cash Accountant',
          accountantDenominations: denominations,
          verifiedCardAmount: numVerifiedCard,
          cardBatchNumber: cardBatch,
          verifiedQrAmount: numVerifiedQr,
          qrSettlementRef: qrRef,
          verifiedBankAmount: numVerifiedBank,
          bankAdviceRef: bankRef,
          accountantRemarks,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: data.message });
        setReconcileSub(null);
        fetchSubmissions();
        if (onRefreshParent) onRefreshParent();
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to save reconciliation.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Network error saving reconciliation.' });
    } finally {
      setIsSavingReconciliation(false);
    }
  };

  // Return for Clarification
  const handleReturnClarification = async () => {
    if (!clarifySub || !clarificationReason.trim()) return;
    setIsReturning(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/accounting/eod-submissions/${clarifySub.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return_clarification',
          clarificationReason: clarificationReason.trim(),
          accountantName: receiverName || 'Central Cash Accountant',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: data.message });
        setClarifySub(null);
        setClarificationReason('');
        fetchSubmissions();
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to return EOD.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error returning EOD.' });
    } finally {
      setIsReturning(false);
    }
  };

  // Resolve Payroll Discrepancy
  const handleResolveDiscrepancy = async () => {
    if (!selectedDiscrepancy) return;
    setIsResolvingDiscrepancy(true);
    try {
      const res = await fetch(`/api/admin/payroll/discrepancies/${selectedDiscrepancy.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          reviewerName: receiverName || 'Finance Manager / HR Officer',
          investigationNotes,
          reviewerAndApprovalStatus: resolutionStatus,
          resolutionStatus: 'RESOLVED',
          payrollAdjustmentApproved: allowPayrollAdjustment,
          payrollAdjustmentAmount: allowPayrollAdjustment ? adjustmentAmount : '0.00',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: data.message });
        setSelectedDiscrepancy(null);
        fetchDiscrepancies();
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to resolve discrepancy.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Network error resolving discrepancy.' });
    } finally {
      setIsResolvingDiscrepancy(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* NOTICE BANNER */}
      {notice && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-xs font-bold ${
            notice.type === 'success'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border border-rose-300 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="cursor-pointer hover:opacity-70 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* WORKSPACE NAVIGATION TABS & WORKFLOW KPI CARDS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            EOD Submissions &amp; Drawer Audit ({stats?.totalSubmissions || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer relative ${
              activeTab === 'payroll'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Payroll Discrepancy Review</span>
            {(stats?.payrollDiscrepanciesCount || 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {stats?.payrollDiscrepanciesCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">Accountant Session:</span>
          <input
            type="text"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 focus:outline-hidden"
            title="Accountant Name for audit signatures"
          />
          <button
            type="button"
            onClick={fetchSubmissions}
            className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase text-slate-500">Awaiting Paper Form</span>
            <strong className="text-xl font-black text-amber-700">{stats.pendingPaperCount}</strong>
            <span className="block text-[10px] text-slate-400">Cashier submitted</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase text-slate-500">Paper Received</span>
            <strong className="text-xl font-black text-blue-700">{stats.paperReceivedCount}</strong>
            <span className="block text-[10px] text-slate-400">Ready to recount</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase text-slate-500">In Progress</span>
            <strong className="text-xl font-black text-purple-700">{stats.inProgressCount}</strong>
            <span className="block text-[10px] text-slate-400">Draft saved</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase text-slate-500">With Discrepancy</span>
            <strong className="text-xl font-black text-rose-700">{stats.discrepancyReviewCount}</strong>
            <span className="block text-[10px] text-slate-400">Short / Over recorded</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase text-slate-500">Finalized EODs</span>
            <strong className="text-xl font-black text-emerald-700">{stats.finalizedCount}</strong>
            <span className="block text-[10px] text-slate-400">Shift closed</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase text-slate-500">Net Till Variance</span>
            <strong className={`text-xl font-black ${stats.totalNetVariance < 0 ? 'text-rose-700' : stats.totalNetVariance > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
              Rs. {stats.totalNetVariance.toLocaleString('en-IN')}
            </strong>
            <span className="block text-[10px] text-slate-400">Total net diff</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: EOD SUBMISSIONS TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'submissions' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Filters Bar */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-slate-500" /> Filter:
              </span>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED_TO_ACCOUNTANT">Awaiting Paper Form</option>
                <option value="PAPER_FORM_RECEIVED">Paper Received (Unreconciled)</option>
                <option value="RECONCILIATION_IN_PROGRESS">In Progress (Draft)</option>
                <option value="DISCREPANCY_REVIEW">Discrepancy Review</option>
                <option value="FINALIZED">Finalized</option>
                <option value="RETURNED_FOR_CLARIFICATION">Returned for Clarification</option>
              </select>

              {/* Discrepancy Type Filter */}
              <select
                value={discrepancyFilter}
                onChange={(e) => setDiscrepancyFilter(e.target.value)}
                className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Discrepancies</option>
                <option value="SHORTAGE">Shortage Only</option>
                <option value="OVERAGE">Overage Only</option>
                <option value="PAYMENT_SETTLEMENT_DIFFERENCE">Payment Settlement Diff</option>
                <option value="NONE">Balanced (No Variance)</option>
              </select>

              {/* Register Filter */}
              <select
                value={registerFilter}
                onChange={(e) => setRegisterFilter(e.target.value)}
                className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Registers</option>
                <option value="REG-01">REG-01</option>
                <option value="REG-02">REG-02</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Showing {submissions.length} submission(s)
            </div>
          </div>

          {/* Submissions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">EOD Reference &amp; Date</th>
                  <th className="p-3.5">Register &amp; Cashier</th>
                  <th className="p-3.5 text-right">Expected Cash</th>
                  <th className="p-3.5 text-right">Actual Counted</th>
                  <th className="p-3.5 text-right">Variance</th>
                  <th className="p-3.5">Workflow Status</th>
                  <th className="p-3.5 text-right">Accountant Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading EOD submissions...
                    </td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold">No EOD submissions match the selected filters.</p>
                      <p className="text-[11px] text-slate-400">Cashiers submit their shift sales summaries from the Counter POS.</p>
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => {
                    const hasActual = sub.actualClosingCash !== null && sub.actualClosingCash !== undefined;
                    const numVariance = Number(sub.cashVariance || 0);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                        {/* Ref & Date */}
                        <td className="p-3.5">
                          <strong className="block font-mono text-slate-900 font-bold">{sub.eodReference}</strong>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {sub.businessDate} • Shift #{sub.shiftNumber}
                          </span>
                        </td>

                        {/* Register & Cashier */}
                        <td className="p-3.5">
                          <strong className="block text-slate-800">{sub.cashierName}</strong>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">
                            {sub.registerCode} • Seal #{sub.envelopeSealNo || 'N/A'} ({sub.physicalVouchersCount} vouchers)
                          </span>
                        </td>

                        {/* Expected Cash */}
                        <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                          Rs. {Number(sub.expectedClosingCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Actual Counted */}
                        <td className="p-3.5 text-right font-mono">
                          {hasActual ? (
                            <strong className="text-slate-900">
                              Rs. {Number(sub.actualClosingCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          ) : (
                            <span className="text-slate-400 italic">Not counted</span>
                          )}
                        </td>

                        {/* Variance */}
                        <td className="p-3.5 text-right font-mono font-black">
                          {hasActual ? (
                            numVariance === 0 ? (
                              <span className="text-emerald-700">Balanced (0.00)</span>
                            ) : numVariance > 0 ? (
                              <span className="text-emerald-700">+Rs. {numVariance.toFixed(2)} (Over)</span>
                            ) : (
                              <span className="text-rose-700">-Rs. {Math.abs(numVariance).toFixed(2)} (Short)</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              sub.status === 'SUBMITTED_TO_ACCOUNTANT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : sub.status === 'PAPER_FORM_RECEIVED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : sub.status === 'RECONCILIATION_IN_PROGRESS'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : sub.status === 'FINALIZED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : sub.status === 'RETURNED_FOR_CLARIFICATION'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {sub.status.replace(/_/g, ' ')}
                          </span>
                          {sub.discrepancyType && sub.discrepancyType !== 'NONE' && (
                            <span className="block text-[9px] font-bold text-rose-600 mt-0.5">
                              ⚠️ {sub.discrepancyType}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Action 1: Confirm Receipt of paper form */}
                            {sub.status === 'SUBMITTED_TO_ACCOUNTANT' && (
                              <button
                                type="button"
                                onClick={() => setReceiptModalSub(sub)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                              >
                                Confirm Receipt
                              </button>
                            )}

                            {/* Action 2: Reconcile EOD / Count Denominations */}
                            {(sub.status === 'PAPER_FORM_RECEIVED' || sub.status === 'RECONCILIATION_IN_PROGRESS') && (
                              <button
                                type="button"
                                onClick={() => handleOpenReconcile(sub)}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                              >
                                Reconcile EOD
                              </button>
                            )}

                            {/* Action 3: Review Finalized Audit */}
                            {sub.status === 'FINALIZED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenReconcile(sub)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition cursor-pointer"
                              >
                                View Audit
                              </button>
                            )}

                            {/* Action 4: Printable Form */}
                            <button
                              type="button"
                              onClick={() => setViewingPrintForm(sub)}
                              title="Print Paper EOD Form"
                              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
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

      {/* ========================================================================= */}
      {/* TAB 2: PAYROLL DISCREPANCY REVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-800">
                  Payroll Discrepancy Link
                </span>
                <span className="text-xs font-bold text-slate-500">Legal &amp; Employment Protection Active</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">Cashier Discrepancy Review &amp; Resolution</h3>
              <p className="text-xs text-slate-500">
                Shortages and overages recorded during Accountant EOD counts. Strict policy: No automated deductions from salary without documented investigation and explicit authorization.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchDiscrepancies}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDiscrepancies ? 'animate-spin' : ''}`} />
              <span>Refresh Records</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Discrepancy ID &amp; EOD Ref</th>
                  <th className="p-3">Cashier &amp; Register</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Expected</th>
                  <th className="p-3 text-right">Actual Counted</th>
                  <th className="p-3 text-right">Difference Amount</th>
                  <th className="p-3">Approval Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingDiscrepancies ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading payroll discrepancies...
                    </td>
                  </tr>
                ) : discrepancies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="font-bold">No unresolved payroll discrepancies found.</p>
                      <p className="text-[11px] text-slate-400">All recent cashier shifts were balanced or have been cleared.</p>
                    </td>
                  </tr>
                ) : (
                  discrepancies.map((disc) => {
                    const diffAmt = Number(disc.differenceAmount || 0);
                    return (
                      <tr key={disc.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <strong className="block font-mono text-slate-900 font-bold">{disc.discrepancyNumber}</strong>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {disc.eodReference} • {disc.businessDate}
                          </span>
                        </td>
                        <td className="p-3">
                          <strong className="block text-slate-800">{disc.cashierName}</strong>
                          <span className="text-[10px] font-mono text-slate-500">
                            {disc.cashierCode} • {disc.registerCode}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              disc.discrepancyType === 'SHORTAGE'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : disc.discrepancyType === 'OVERAGE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {disc.discrepancyType}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700">
                          Rs. {Number(disc.expectedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          Rs. {Number(disc.actualAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-black">
                          <span className={diffAmt < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                            {diffAmt > 0 ? '+' : ''}Rs. {diffAmt.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              disc.reviewerAndApprovalStatus === 'PENDING_REVIEW'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : disc.reviewerAndApprovalStatus === 'UNDER_INVESTIGATION'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : disc.reviewerAndApprovalStatus === 'RESOLVED_NO_DEDUCTION'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {disc.reviewerAndApprovalStatus.replace(/_/g, ' ')}
                          </span>
                          {disc.payrollAdjustmentApproved && (
                            <span className="block text-[9px] text-rose-700 font-bold mt-0.5">
                              Approved for Payroll Adj
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscrepancy(disc);
                              setInvestigationNotes(disc.investigationNotes || '');
                              setResolutionStatus(disc.reviewerAndApprovalStatus);
                              setAllowPayrollAdjustment(disc.payrollAdjustmentApproved || false);
                              setAdjustmentAmount(disc.payrollAdjustmentAmount || Math.abs(diffAmt).toFixed(2));
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition cursor-pointer"
                          >
                            Investigate / Resolve
                          </button>
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

      {/* ========================================================================= */}
      {/* MODAL 1: CONFIRM RECEIPT OF PAPER FORM */}
      {/* ========================================================================= */}
      {receiptModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-black text-slate-900">Confirm Receipt of Paper EOD Form</h3>
              </div>
              <button onClick={() => setReceiptModalSub(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Confirm physical receipt of the paper EOD summary slip and sealed accounts envelope for <strong className="text-slate-900">{receiptModalSub.eodReference}</strong>.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1 font-medium">
              <div className="flex justify-between"><span>Register &amp; Shift:</span><strong>{receiptModalSub.registerCode} • {receiptModalSub.shiftNumber}</strong></div>
              <div className="flex justify-between"><span>Cashier Name:</span><strong>{receiptModalSub.cashierName}</strong></div>
              <div className="flex justify-between"><span>Envelope Seal Tag #:</span><strong className="font-mono text-emerald-800">{receiptModalSub.envelopeSealNo}</strong></div>
              <div className="flex justify-between"><span>Physical Vouchers Count:</span><strong className="font-mono text-slate-900">{receiptModalSub.physicalVouchersCount} items</strong></div>
              <div className="flex justify-between"><span>Expected Closing Cash:</span><strong className="font-mono text-slate-900">Rs. {Number(receiptModalSub.expectedClosingCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                Receiving Accountant Name
              </label>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiptModalSub(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReceipt}
                disabled={isReceiving}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                {isReceiving && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Mark as Received</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ACCOUNTANT RECONCILIATION COCKPIT (DENOMINATIONS & SETTLEMENTS) */}
      {/* ========================================================================= */}
      {reconcileSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                      Accountant Cockpit
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Ref: {reconcileSub.eodReference}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">
                    Physical Drawer Recount &amp; Payment Settlement Reconciliation
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingPrintForm(reconcileSub)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>View Paper Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReconcileSub(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split 2-Column: Left = POS Submitted Snapshot; Right = Accountant Recount */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
              
              {/* LEFT COLUMN: ORIGINAL POS-SUBMITTED SNAPSHOT (FROZEN READ-ONLY, 5 COLS) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-3 text-xs">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Original POS Submitted Snapshot (Frozen)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Submitted by cashier upon register close. Cannot be altered.
                    </p>
                  </div>

                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between"><span>Register &amp; Shift:</span><strong>{reconcileSub.registerCode} • {reconcileSub.shiftNumber}</strong></div>
                    <div className="flex justify-between"><span>Cashier:</span><strong>{reconcileSub.cashierName} ({reconcileSub.cashierCode})</strong></div>
                    <div className="flex justify-between"><span>Envelope Seal #:</span><strong className="font-mono text-emerald-800">{reconcileSub.envelopeSealNo}</strong></div>
                    <div className="flex justify-between"><span>Vouchers Enclosed:</span><strong className="font-mono text-slate-900">{reconcileSub.physicalVouchersCount}</strong></div>
                    {reconcileSub.cashierNotes && (
                      <div className="pt-1 border-t border-slate-100 text-[11px] italic text-slate-600">
                        &ldquo;{reconcileSub.cashierNotes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* POS Sales by tender */}
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <p className="font-bold text-slate-900 text-[11px] uppercase">POS Sales by Tender</p>
                    <div className="flex justify-between"><span>Cash Sales:</span><strong className="font-mono">Rs. {Number(reconcileSub.cashSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between"><span>Card Sales:</span><strong className="font-mono">Rs. {Number(reconcileSub.cardSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between"><span>QR / Wallet Sales:</span><strong className="font-mono">Rs. {Number(reconcileSub.qrSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between"><span>Bank Transfer Sales:</span><strong className="font-mono">Rs. {Number(reconcileSub.bankTransferSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between"><span>Credit Sales:</span><strong className="font-mono">Rs. {Number(reconcileSub.creditSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
                      <span>Total Gross Sales:</span>
                      <span className="font-mono text-emerald-800">Rs. {Number(reconcileSub.totalSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Drawer Expected Formula */}
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <p className="font-bold text-slate-900 text-[11px] uppercase">Drawer Accounting Balance</p>
                    <div className="flex justify-between"><span>(+) Opening Float:</span><strong className="font-mono">Rs. {Number(reconcileSub.openingFloat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between"><span>(+) Cash Collections:</span><strong className="font-mono">Rs. {Number(reconcileSub.cashSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between"><span>(+) Cash Additions (Paid In):</span><strong className="font-mono">Rs. {Number(reconcileSub.cashAdditions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between text-rose-700"><span>(-) Petty Cash Payouts:</span><strong className="font-mono">Rs. {Number(reconcileSub.cashPayouts).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between text-rose-700"><span>(-) Safe Drops:</span><strong className="font-mono">Rs. {Number(reconcileSub.safeDrops).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="flex justify-between text-rose-700"><span>(-) Cash Refunds:</span><strong className="font-mono">Rs. {Number(reconcileSub.refundsAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between items-center font-black text-emerald-950 mt-1">
                      <span>EXPECTED CLOSING CASH:</span>
                      <span className="font-mono text-sm">Rs. {expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: ACCOUNTANT RECOUNT & SETTLEMENTS (7 COLS) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* 1. PHYSICAL CASH DENOMINATION COUNTER */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      1. Physical Cash Denominations (Accountant Count)
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Enter envelope note counts
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-1">
                    {NEPALI_DENOMINATIONS.map((d) => {
                      const count = denominations[d.value.toString()] || 0;
                      const subtotal = d.value * count;
                      return (
                        <div key={d.value} className="grid grid-cols-12 items-center gap-2 p-1.5 hover:bg-slate-100/70 rounded-lg transition">
                          <div className="col-span-4 flex items-center gap-2 font-mono font-bold text-slate-800">
                            <span className={`w-2 h-2 rounded-full ${d.bg}`}></span>
                            {d.label}
                          </div>

                          <div className="col-span-4 flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(d.value.toString(), count - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={count || ''}
                              placeholder="0"
                              onChange={(e) => handleQtyChange(d.value.toString(), parseInt(e.target.value, 10))}
                              className="h-6 w-12 rounded-md border border-slate-300 bg-white text-center font-mono text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleQtyChange(d.value.toString(), count + 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="col-span-4 text-right font-mono font-bold text-slate-900">
                            Rs. {subtotal.toLocaleString('en-IN')}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cash Summary Banner (Actual vs Expected vs Variance) */}
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Actual Counted Physical Cash</span>
                      <strong className="font-mono text-base text-slate-900">
                        Rs. {countedPhysicalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Cash Variance</span>
                      <span
                        className={`font-mono font-black text-sm px-2 py-0.5 rounded-md ${
                          cashVariance === 0
                            ? 'bg-emerald-100 text-emerald-900'
                            : cashVariance > 0
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {cashVariance > 0 ? '+' : ''}Rs. {cashVariance.toFixed(2)}{' '}
                        {cashVariance === 0 ? '(Balanced)' : cashVariance > 0 ? '(OVERAGE)' : '(SHORTAGE)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. PAYMENT METHOD SETTLEMENT VERIFICATION */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-3 text-xs">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      2. Payment Method Settlement Verification
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verify external POS batch settlement, QR portal credits, and bank advices.
                    </p>
                  </div>

                  {/* Card EDC */}
                  <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="col-span-4">
                      <span className="font-bold text-slate-800 block">Card (EDC Terminal)</span>
                      <span className="text-[10px] text-slate-500">Exp: Rs. {expectedCard.toFixed(2)}</span>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9px] font-bold text-slate-500 block">Batch #</label>
                      <input
                        type="text"
                        placeholder="Batch #004"
                        value={cardBatch}
                        onChange={(e) => setCardBatch(e.target.value)}
                        className="w-full h-7 rounded border border-slate-300 bg-white px-2 font-mono text-[11px]"
                      />
                    </div>
                    <div className="col-span-4 text-right">
                      <label className="text-[9px] font-bold text-slate-500 block">Verified Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={verifiedCard}
                        onChange={(e) => setVerifiedCard(e.target.value)}
                        className="w-full h-7 rounded border border-slate-300 bg-white px-2 text-right font-mono font-bold text-[11px]"
                      />
                      <span className={`text-[10px] font-bold ${cardVariance === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                        Diff: {cardVariance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic QR */}
                  <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="col-span-4">
                      <span className="font-bold text-slate-800 block">Dynamic QR (Fonepay)</span>
                      <span className="text-[10px] text-slate-500">Exp: Rs. {expectedQr.toFixed(2)}</span>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9px] font-bold text-slate-500 block">Settlement Ref #</label>
                      <input
                        type="text"
                        placeholder="SETTL-889"
                        value={qrRef}
                        onChange={(e) => setQrRef(e.target.value)}
                        className="w-full h-7 rounded border border-slate-300 bg-white px-2 font-mono text-[11px]"
                      />
                    </div>
                    <div className="col-span-4 text-right">
                      <label className="text-[9px] font-bold text-slate-500 block">Verified Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={verifiedQr}
                        onChange={(e) => setVerifiedQr(e.target.value)}
                        className="w-full h-7 rounded border border-slate-300 bg-white px-2 text-right font-mono font-bold text-[11px]"
                      />
                      <span className={`text-[10px] font-bold ${qrVariance === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                        Diff: {qrVariance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Bank Transfer */}
                  <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="col-span-4">
                      <span className="font-bold text-slate-800 block">Bank Transfer</span>
                      <span className="text-[10px] text-slate-500">Exp: Rs. {expectedBank.toFixed(2)}</span>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[9px] font-bold text-slate-500 block">Advice / Trx Ref</label>
                      <input
                        type="text"
                        placeholder="TRX-10294"
                        value={bankRef}
                        onChange={(e) => setBankRef(e.target.value)}
                        className="w-full h-7 rounded border border-slate-300 bg-white px-2 font-mono text-[11px]"
                      />
                    </div>
                    <div className="col-span-4 text-right">
                      <label className="text-[9px] font-bold text-slate-500 block">Verified Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={verifiedBank}
                        onChange={(e) => setVerifiedBank(e.target.value)}
                        className="w-full h-7 rounded border border-slate-300 bg-white px-2 text-right font-mono font-bold text-[11px]"
                      />
                      <span className={`text-[10px] font-bold ${bankVariance === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                        Diff: {bankVariance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. ACCOUNTANT REMARKS & DISCREPANCY AUDIT NOTES */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-2 text-xs">
                  <label className="block text-xs font-black uppercase text-slate-800">
                    Accountant Audit Remarks / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={accountantRemarks}
                    onChange={(e) => setAccountantRemarks(e.target.value)}
                    placeholder="e.g. Physical notes matched exactly. Card batch terminal slips verified against statement."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-100 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setClarifySub(reconcileSub);
                    setClarificationReason('');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition cursor-pointer"
                >
                  Return for Clarification
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReconcileSub(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveReconciliation('save_draft')}
                  disabled={isSavingReconciliation}
                  className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveReconciliation('finalize')}
                  disabled={isSavingReconciliation}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {Math.abs(cashVariance) >= 0.01
                      ? 'Confirm Reconciliation & Create Discrepancy'
                      : 'Confirm & Finalize EOD (Balanced)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RETURN FOR CLARIFICATION */}
      {/* ========================================================================= */}
      {clarifySub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-base font-black">Return EOD to Cashier for Clarification</h3>
              </div>
              <button onClick={() => setClarifySub(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              This will return EOD <strong className="text-slate-900">{clarifySub.eodReference}</strong> to Cashier <strong className="text-slate-900">{clarifySub.cashierName}</strong> with an audit note requiring response before final approval.
            </p>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                Reason / Clarification Instructions (Required)
              </label>
              <textarea
                rows={3}
                value={clarificationReason}
                onChange={(e) => setClarificationReason(e.target.value)}
                placeholder="e.g. Physical voucher count was entered as 5, but envelope contained 4 slips. Please verify invoice duplicates."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClarifySub(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnClarification}
                disabled={isReturning || !clarificationReason.trim()}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                {isReturning && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Send to Cashier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INVESTIGATE / RESOLVE PAYROLL DISCREPANCY */}
      {/* ========================================================================= */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                <h3 className="text-base font-black text-slate-900">
                  Payroll Discrepancy Review • {selectedDiscrepancy.discrepancyNumber}
                </h3>
              </div>
              <button onClick={() => setSelectedDiscrepancy(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1 font-medium">
              <div className="flex justify-between"><span>EOD Reference:</span><strong className="font-mono text-slate-900">{selectedDiscrepancy.eodReference}</strong></div>
              <div className="flex justify-between"><span>Cashier:</span><strong>{selectedDiscrepancy.cashierName} ({selectedDiscrepancy.cashierCode})</strong></div>
              <div className="flex justify-between"><span>Discrepancy Type:</span><strong className="text-rose-700">{selectedDiscrepancy.discrepancyType}</strong></div>
              <div className="flex justify-between"><span>Difference Amount:</span><strong className="font-mono text-rose-800 text-sm">Rs. {Number(selectedDiscrepancy.differenceAmount).toFixed(2)}</strong></div>
              <div className="flex justify-between"><span>Accountant Remarks:</span><span>{selectedDiscrepancy.accountantRemarks || 'N/A'}</span></div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                Investigation Findings &amp; Cashier Explanation
              </label>
              <textarea
                rows={3}
                value={investigationNotes}
                onChange={(e) => setInvestigationNotes(e.target.value)}
                placeholder="Record employee interview, till audit findings, manager review notes..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Resolution Decision
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="RESOLVED_NO_DEDUCTION">Resolved (No Salary Deduction)</option>
                  <option value="AUTHORIZED_EXCEPTION">Authorized Exception / Store Absorption</option>
                  <option value="UNDER_INVESTIGATION">Under Ongoing Investigation</option>
                  <option value="APPROVED_FOR_PAYROLL_ADJUSTMENT">Approved for Payroll Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Payroll Adjustment Amount (NPR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustmentAmount}
                  disabled={!allowPayrollAdjustment}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-slate-50 px-3 font-mono text-xs font-bold text-slate-900 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Guardrail Checkbox for Payroll Adjustment */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-bold select-none">
                <input
                  type="checkbox"
                  checked={allowPayrollAdjustment}
                  onChange={(e) => setAllowPayrollAdjustment(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-purple-600 focus:ring-purple-500"
                />
                <span>
                  Authorize payroll deduction/addition in compliance with Employment Law &amp; Company Policy
                </span>
              </label>
              <p className="text-[10px] text-amber-800 leading-normal pl-6">
                Under retail compliance regulations, shortages cannot be automatically deducted without documented investigation and explicit authorization.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDiscrepancy(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveDiscrepancy}
                disabled={isResolvingDiscrepancy}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                {isResolvingDiscrepancy && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Save Resolution</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PRINTABLE PAPER FORM PREVIEW */}
      {/* ========================================================================= */}
      {viewingPrintForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3">
              <span className="font-bold text-xs text-slate-700">Official Paper EOD Slip Preview</span>
              <button
                onClick={() => setViewingPrintForm(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
              <PrintablePaperEodForm
                eodReference={viewingPrintForm.eodReference}
                businessDate={viewingPrintForm.businessDate}
                branch={viewingPrintForm.branch || 'Dhangadhi Main Branch, Nepal'}
                registerCode={viewingPrintForm.registerCode}
                shiftNumber={viewingPrintForm.shiftNumber}
                cashierName={viewingPrintForm.cashierName}
                cashierCode={viewingPrintForm.cashierCode}
                openedAt={viewingPrintForm.openedAt}
                submittedAt={viewingPrintForm.submittedAt}
                openingFloat={Number(viewingPrintForm.openingFloat || 0)}
                totalSales={Number(viewingPrintForm.totalSales || 0)}
                cashSales={Number(viewingPrintForm.cashSales || 0)}
                cardSales={Number(viewingPrintForm.cardSales || 0)}
                qrSales={Number(viewingPrintForm.qrSales || 0)}
                bankTransferSales={Number(viewingPrintForm.bankTransferSales || 0)}
                creditSales={Number(viewingPrintForm.creditSales || 0)}
                taxableAmount={Number(viewingPrintForm.taxableAmount || 0)}
                vatAmount={Number(viewingPrintForm.vatAmount || 0)}
                discountAmount={Number(viewingPrintForm.discountAmount || 0)}
                refundsAmount={Number(viewingPrintForm.refundsAmount || 0)}
                voidsCount={Number(viewingPrintForm.voidsCount || 0)}
                voidsAmount={Number(viewingPrintForm.voidsAmount || 0)}
                totalTransactions={Number(viewingPrintForm.totalTransactions || 0)}
                cashAdditions={Number(viewingPrintForm.cashAdditions || 0)}
                cashPayouts={Number(viewingPrintForm.cashPayouts || 0)}
                safeDrops={Number(viewingPrintForm.safeDrops || 0)}
                expectedClosingCash={Number(viewingPrintForm.expectedClosingCash || 0)}
                envelopeSealNo={viewingPrintForm.envelopeSealNo}
                physicalVouchersCount={Number(viewingPrintForm.physicalVouchersCount || 0)}
                cashierNotes={viewingPrintForm.cashierNotes}
                cashierDeclaration={viewingPrintForm.cashierDeclaration}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
