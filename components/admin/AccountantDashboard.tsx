'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  DollarSign,
  TrendingUp,
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
  ExternalLink,
  X,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

interface ShiftItem {
  id: number;
  shiftNumber: string;
  registerCode: string;
  cashierName: string;
  openingFloat: number;
  closingCash: string | null;
  expectedCash: number;
  actualCash: number;
  cashDiscrepancy: number;
  totalSales: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  varianceApproved: boolean;
  varianceApprovedBy: string | null;
  varianceApprovedAt: string | null;
  varianceReason: string | null;
  isHighVariance: boolean;
  requiresApproval: boolean;
}

interface AuditLogItem {
  id: number;
  action: string;
  entity: string;
  timestamp: string;
  actor: string;
  details: string;
  verificationHash: string;
  isVerified: boolean;
}

interface KpisData {
  businessDate: string;
  businessDayStatus: 'OPEN' | 'CLOSED';
  todayGrossSales: number;
  todayNetSales: number;
  vatLiability: number;
  totalExpectedCash: number;
  totalActualCash: number;
  totalNetVariance: number;
  isVarianceHigh: boolean;
  openShiftsCount: number;
  totalShiftsCount: number;
  closedAt: string | null;
  closedBySupervisorName: string | null;
  zReport: any | null;
}

export const AccountantDashboard: React.FC = () => {
  const [kpis, setKpis] = useState<KpisData | null>(null);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [auditStream, setAuditStream] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [approvingShift, setApprovingShift] = useState<ShiftItem | null>(null);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalReason, setApprovalReason] = useState('Variance physically verified in till drawer');
  const [isApproving, setIsApproving] = useState(false);

  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState(false);
  const [eodPin, setEodPin] = useState('');
  const [eodNote, setEodNote] = useState('');
  const [isClosingDay, setIsClosingDay] = useState(false);

  const [viewingZReport, setViewingZReport] = useState<any | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/accounting/eod?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
        setShifts(data.shifts);
        setAuditStream(data.auditStream);
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to load accountant data.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: 'Unable to connect to financial accounting server.' });
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Submit Variance Approval
  const handleApproveVariance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingShift || !approvalPin) return;

    setIsApproving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/accounting/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve-variance',
          shiftId: approvingShift.id,
          pin: approvalPin,
          reasonNote: approvalReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ type: 'success', message: data.message });
        setApprovingShift(null);
        setApprovalPin('');
        fetchFinancialData();
      } else {
        setNotice({ type: 'error', message: data.error || 'Variance approval rejected.' });
      }
    } catch (err) {
      setNotice({ type: 'error', message: 'Network error approving variance.' });
    } finally {
      setIsApproving(false);
    }
  };

  // 2. Close Business Day (EOD)
  const handleCloseBusinessDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eodPin) return;

    setIsClosingDay(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/accounting/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close-day',
          pin: eodPin,
          note: eodNote,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ type: 'success', message: data.message });
        setIsCloseDayModalOpen(false);
        setEodPin('');
        setEodNote('');
        if (data.zReport) {
          setViewingZReport(data.zReport);
        }
        fetchFinancialData();
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to close business day.' });
      }
    } catch (err) {
      setNotice({ type: 'error', message: 'Network error during EOD closure.' });
    } finally {
      setIsClosingDay(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Status Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
              Finance & Cash Control
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                kpis?.businessDayStatus === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              DAY STATUS: {kpis?.businessDayStatus || 'OPEN'}
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black text-slate-900">
            Accountant & Cash Reconciliation Console
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Real-time shift drawer balance audit, cash discrepancy clearance, and EOD Z-Report finalization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchFinancialData}
            title="Refresh figures"
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {kpis?.zReport && (
            <button
              onClick={() => setViewingZReport(kpis.zReport)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200"
            >
              <FileCheck className="h-4 w-4 text-emerald-600" />
              View Z-Report
            </button>
          )}

          {kpis?.businessDayStatus === 'OPEN' ? (
            <button
              onClick={() => setIsCloseDayModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm"
            >
              <Lock className="h-4 w-4 text-emerald-400" />
              Close Business Day (EOD)
            </button>
          ) : (
            <span className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Day Finalized ({new Date(kpis?.closedAt || '').toLocaleTimeString()})
            </span>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-xs font-bold ${
            notice.type === 'success'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. TOP FINANCIAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Gross / Net Sales */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Today&apos;s Gross Sales</span>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            NPR {(kpis?.todayGrossSales || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Net: NPR {(kpis?.todayNetSales || 0).toLocaleString('en-IN')}</span>
            <span className="font-semibold text-emerald-600">VAT: NPR {(kpis?.vatLiability || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Expected Cash in Drawer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">System Expected Cash</span>
            <Banknote className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            NPR {(kpis?.totalExpectedCash || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Opening Float + Cash Sales - Drops
          </div>
        </div>

        {/* Actual Counted Cash */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actual Cash Counted</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            NPR {(kpis?.totalActualCash || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Physical drawer cash declared
          </div>
        </div>

        {/* Net Cash Variance (Alerts in RED if > NPR 500) */}
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            kpis?.isVarianceHigh
              ? 'border-red-300 bg-red-50 text-red-950 animate-pulse'
              : (kpis?.totalNetVariance || 0) === 0
              ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Net Variance</span>
            <AlertTriangle className={`h-4 w-4 ${kpis?.isVarianceHigh ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div
            className={`mt-2 text-2xl font-black ${
              kpis?.isVarianceHigh ? 'text-red-600' : (kpis?.totalNetVariance || 0) > 0 ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {(kpis?.totalNetVariance || 0) > 0 ? '+' : ''}
            NPR {(kpis?.totalNetVariance || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs font-semibold">
            {kpis?.isVarianceHigh ? (
              <span className="text-red-700">⚠️ Discrepancy exceeds ±रु ५०० threshold!</span>
            ) : (kpis?.totalNetVariance || 0) === 0 ? (
              <span className="text-emerald-700">✓ Perfectly balanced</span>
            ) : (
              <span className="text-slate-500">Minor discrepancy within threshold</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. SHIFT RECONCILIATION TABLE */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Shift Drawer Reconciliation
            </h3>
            <p className="text-xs text-slate-500">
              Reconcile physical counted cash vs expected sales per register counter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              Active Shifts: {kpis?.openShiftsCount || 0} Open / {shifts.length} Total
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4">Shift ID</th>
                <th className="p-4">Terminal & Cashier</th>
                <th className="p-4">Period</th>
                <th className="p-4">Expected Cash</th>
                <th className="p-4">Actual Cash</th>
                <th className="p-4">Variance (Short/Over)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.map((s) => {
                const variance = s.cashDiscrepancy;
                const isOver = variance > 0;
                const isShort = variance < 0;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-900">
                      {s.shiftNumber}
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-900">{s.cashierName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{s.registerCode}</div>
                    </td>

                    <td className="p-4 text-slate-500 text-[11px]">
                      <div>In: {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>
                        {s.closedAt ? `Out: ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Shift Active'}
                      </div>
                    </td>

                    <td className="p-4 font-mono font-bold text-slate-700">
                      NPR {s.expectedCash.toLocaleString('en-IN')}
                    </td>

                    <td className="p-4 font-mono font-bold text-slate-900">
                      NPR {s.actualCash.toLocaleString('en-IN')}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold ${
                            isShort ? 'text-red-600' : isOver ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          {isOver ? '+' : ''}
                          NPR {variance.toLocaleString('en-IN')}
                        </span>

                        {s.requiresApproval && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-800 border border-red-200">
                            REQUIRES APPROVAL
                          </span>
                        )}

                        {s.varianceApproved && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                            Approved ✓
                          </span>
                        )}
                      </div>
                      {s.varianceApproved && s.varianceReason && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                          Note: {s.varianceReason}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          s.status === 'OPEN'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      {s.requiresApproval ? (
                        <button
                          onClick={() => {
                            setApprovingShift(s);
                            setApprovalPin('');
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 shadow-sm"
                        >
                          Approve Variance
                        </button>
                      ) : s.varianceApproved ? (
                        <span className="text-[11px] text-slate-400 font-medium">Cleared</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {shifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                    No active shift records for today yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. TAMPER-EVIDENT AUDIT STREAM */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Tamper-Evident Audit Stream
            </h3>
            <p className="text-xs text-slate-500">
              Cryptographically signed audit logs of all cash operations and financial overrides.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-mono font-bold text-slate-600">
            APPEND-ONLY LEDGER
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Details</th>
                <th className="p-4 text-right">Integrity Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditStream.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-4 text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4 font-bold text-blue-700">
                    {log.action}
                  </td>
                  <td className="p-4 font-semibold text-slate-900 font-sans">
                    {log.actor}
                  </td>
                  <td className="p-4 text-slate-600 font-sans text-xs">
                    {log.details}
                  </td>
                  <td className="p-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      {log.verificationHash}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: APPROVE VARIANCE */}
      {approvingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleApproveVariance}
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-base font-black text-slate-900">Approve Shift Variance</h3>
              <p className="text-xs text-slate-500">
                Shift #{approvingShift.shiftNumber} ({approvingShift.cashierName})
              </p>
            </div>

            <div className="space-y-4 p-6 text-xs">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-900">
                <div className="font-bold">Variance Discrepancy Amount:</div>
                <div className="mt-1 text-lg font-black font-mono">
                  {approvingShift.cashDiscrepancy > 0 ? '+' : ''}
                  NPR {approvingShift.cashDiscrepancy.toLocaleString('en-IN')}
                </div>
                <div className="mt-0.5 text-[11px] text-red-700">
                  Expected: NPR {approvingShift.expectedCash.toLocaleString('en-IN')} · Counted: NPR {approvingShift.actualCash.toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Variance Justification / Reason Note
                </label>
                <textarea
                  required
                  rows={2}
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Authorizing Supervisor / Accountant PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  autoFocus
                  value={approvalPin}
                  onChange={(e) => setApprovalPin(e.target.value)}
                  placeholder="••••"
                  className="w-full tracking-[0.4em] font-mono text-center font-bold text-lg rounded-xl border border-slate-200 p-2.5 focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setApprovingShift(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isApproving || !approvalPin}
                className="rounded-xl bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isApproving ? 'Verifying...' : 'Authorize Variance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CLOSE BUSINESS DAY (EOD) */}
      {isCloseDayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCloseBusinessDay}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-base font-black text-slate-900">Close Business Day & Generate Z-Report</h3>
              <p className="text-xs text-slate-500">
                Final reconciliation for date: {kpis?.businessDate}
              </p>
            </div>

            <div className="space-y-4 p-6 text-xs">
              {kpis && kpis.openShiftsCount > 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Validation Warning: {kpis.openShiftsCount} Active Shift(s) Detected
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800">
                    All terminal shifts must be reconciled and closed before finalizing EOD. Please ensure cashiers submit their shift closing envelopes first.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Pre-flight Check Passed: All shifts are closed.
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800">
                    Total Gross Sales of NPR {(kpis?.todayGrossSales || 0).toLocaleString('en-IN')} will be locked and an immutable Z-Report generated.
                  </p>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  EOD Closure Note
                </label>
                <input
                  type="text"
                  value={eodNote}
                  onChange={(e) => setEodNote(e.target.value)}
                  placeholder="e.g. End of Day physical reconciliation complete and balanced"
                  className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supervisor / Manager Authorization PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  autoFocus
                  value={eodPin}
                  onChange={(e) => setEodPin(e.target.value)}
                  placeholder="••••"
                  className="w-full tracking-[0.4em] font-mono text-center font-bold text-lg rounded-xl border border-slate-200 p-2.5 focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsCloseDayModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isClosingDay || !eodPin || (kpis ? kpis.openShiftsCount > 0 : false)}
                className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {isClosingDay ? 'Finalizing...' : 'Finalize & Lock Day'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW IMMUTABLE Z-REPORT */}
      {viewingZReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="text-base font-black">Official EOD Z-Report</h3>
                <p className="font-mono text-xs text-emerald-400">{viewingZReport.zReportNumber}</p>
              </div>
              <button onClick={() => setViewingZReport(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-4 text-slate-800">
              <div className="text-center border-b pb-3">
                <div className="font-bold text-sm">{viewingZReport.storeName}</div>
                <div className="text-[10px] text-slate-500">Business Date: {viewingZReport.businessDate}</div>
                <div className="text-[10px] text-slate-500">Generated: {new Date(viewingZReport.generatedAt).toLocaleString()}</div>
              </div>

              {/* Financial Totals */}
              <div className="space-y-1.5 border-b pb-3">
                <div className="font-bold text-slate-900 text-xs">FINANCIAL REVENUE SUMMARY:</div>
                <div className="flex justify-between">
                  <span>Gross Sales:</span>
                  <b>NPR {viewingZReport.financialTotals?.grossSales?.toLocaleString('en-IN')}</b>
                </div>
                <div className="flex justify-between">
                  <span>Net Sales (Excl VAT):</span>
                  <span>NPR {viewingZReport.financialTotals?.netSales?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax (13% VAT):</span>
                  <span>NPR {viewingZReport.financialTotals?.vatAmount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Invoices/Transactions:</span>
                  <span>{viewingZReport.financialTotals?.totalTransactions}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-1.5 border-b pb-3">
                <div className="font-bold text-slate-900 text-xs">TENDER BREAKDOWN:</div>
                <div className="flex justify-between">
                  <span>Cash:</span>
                  <span>NPR {viewingZReport.tenderBreakdown?.cash?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Card / POS Terminals:</span>
                  <span>NPR {viewingZReport.tenderBreakdown?.card?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fonepay QR:</span>
                  <span>NPR {viewingZReport.tenderBreakdown?.fonepayQr?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Cash Reconciliation */}
              <div className="space-y-1.5 border-b pb-3">
                <div className="font-bold text-slate-900 text-xs">DRAWER CASH AUDIT:</div>
                <div className="flex justify-between">
                  <span>Expected Cash:</span>
                  <span>NPR {viewingZReport.cashAudit?.expectedCash?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Actual Cash Counted:</span>
                  <span>NPR {viewingZReport.cashAudit?.countedActualCash?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Cash Discrepancy (Variance):</span>
                  <span className={viewingZReport.cashAudit?.netVariance !== 0 ? 'text-red-600' : 'text-emerald-600'}>
                    NPR {viewingZReport.cashAudit?.netVariance?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-sans">
                Closed by: <b>{viewingZReport.closedBy?.name}</b> ({viewingZReport.closedBy?.role?.toUpperCase()})
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <Printer className="h-4 w-4" /> Print Z-Report Slip
              </button>
              <button
                onClick={() => setViewingZReport(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
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
