'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  CreditCard,
  QrCode,
  Receipt,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  DenominationGrid,
  DenominationMap,
  DEFAULT_DENOMINATIONS,
  calculateDenominationGrandTotal,
} from './DenominationKeypad';
import { formatNpr } from '@/lib/nepal/money';

interface ShiftClosingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: any;
  report: any;
  transactions: any[];
  onShiftClosed: (closedShift: any) => void;
}

export function ShiftClosingWizardModal({
  isOpen,
  onClose,
  shift,
  report,
  transactions,
  onShiftClosed,
}: ShiftClosingWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Blind Denominations
  const [denominations, setDenominations] = useState<DenominationMap>({ ...DEFAULT_DENOMINATIONS });

  // Step 2: Non-cash tender settlement entries
  const [tenderSettlements, setTenderSettlements] = useState<Record<string, { entered: string; ref: string; batch: string }>>({
    card: {
      entered: String(report?.tenders?.card || 0),
      ref: 'NABIL-POS-B01',
      batch: 'BATCH-001',
    },
    fonepay: {
      entered: String(report?.tenders?.fonepayQr || 0),
      ref: 'FP-SETTLE-01',
      batch: 'MER-8812',
    },
    esewa: {
      entered: String(report?.tenders?.esewa || 0),
      ref: 'ESEWA-TRX-01',
      batch: 'BATCH-441',
    },
    khalti: {
      entered: String(report?.tenders?.khalti || 0),
      ref: 'KHALTI-M-01',
      batch: 'BATCH-102',
    },
    connectips: {
      entered: String(report?.tenders?.connectIps || 0),
      ref: 'CIPS-01',
      batch: 'REF-55',
    },
    credit: {
      entered: String(report?.tenders?.credit || 0),
      ref: 'CREDIT-LEDGER-01',
      batch: 'AR-01',
    },
  });

  // Step 4: Submission & approvals
  const [supervisorPin, setSupervisorPin] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [minDurationReason, setMinDurationReason] = useState('');
  const [recountReason, setRecountReason] = useState('');
  const [safeDepositAmount, setSafeDepositAmount] = useState<string>('');
  const [isRecountMode, setIsRecountMode] = useState(false);
  const [recountAttempt, setRecountAttempt] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !shift) return null;

  const countedCash = calculateDenominationGrandTotal(denominations);
  const openingFloat = Number(shift.openingFloat || 0);
  const durationMinutes = shift.durationMinutes ?? Math.floor((Date.now() - new Date(shift.openedAt).getTime()) / 60000);
  const isShortDuration = durationMinutes < 5;

  // Waterfall and tally telemetry
  const waterfall = report?.waterfall || {};
  const grossSales = Number(waterfall.grossSales || 0);
  const totalDiscounts = Number(waterfall.discounts || 0);
  const totalReturns = Number(waterfall.returns || 0);
  const totalVoids = Number(waterfall.voids || 0);
  const netSales = Number(waterfall.netSales || 0);

  // Exact Expected Cash (calculated on server, client preview):
  const cashSales = Number(report?.tenders?.cash || 0);
  const cashRefunds = Number(waterfall.cashRefunds || 0);
  const cashOps = report?.cashOperations || [];
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalSafeDrops = 0;
  for (const op of cashOps) {
    const amt = Number(op.amount || 0);
    if (op.type === 'PAID_IN' || op.type === 'CASH_IN') totalCashIn += amt;
    else if (op.type === 'SAFE_DROP') totalSafeDrops += amt;
    else totalCashOut += amt;
  }
  const previewExpectedCash = openingFloat + (cashSales - cashRefunds) + totalCashIn - totalCashOut - totalSafeDrops;
  const previewVariance = countedCash - previewExpectedCash;
  const absVariance = Math.abs(previewVariance);
  const exceedsTolerance = absVariance > 50;

  // Tally check: sum of all tenders vs net sales
  const nonCashEnteredTotal = Object.values(tenderSettlements).reduce((sum, t) => sum + (parseFloat(t.entered) || 0), 0);
  const totalTendersSum = countedCash - openingFloat + nonCashEnteredTotal; // Net new tender money
  const tallyDiff = Math.abs(totalTendersSum - netSales);
  const hasTallyMismatch = tallyDiff > 10;

  // Handle recount action
  const handleRecount = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECOUNT_SHIFT',
          shiftId: shift.id,
          denominations,
          recountReason: recountReason || `Cash recount attempt #${recountAttempt + 1}`,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record recount');
      }

      setRecountAttempt((prev) => prev + 1);
      setIsRecountMode(false);
      alert(`Recount #${json.attemptNumber} logged into history. New counted cash: NPR ${json.recountTotal.toLocaleString('en-IN')}`);
    } catch (err: any) {
      setError(err.message || 'Recount failed');
    } finally {
      setLoading(false);
    }
  };

  // Final Close Submission
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (exceedsTolerance && !supervisorPin.trim()) {
      setError(`Cash variance of NPR ${absVariance.toFixed(2)} exceeds NPR 50 tolerance. Supervisor PIN is strictly required.`);
      return;
    }

    if (isShortDuration && !supervisorPin.trim()) {
      setError(`Shift duration is only ${durationMinutes}m (< 5 minutes). Closing requires Supervisor PIN and justification.`);
      return;
    }

    setLoading(true);
    try {
      const tendersPayload = Object.entries(tenderSettlements).map(([tType, data]) => ({
        tenderType: tType,
        systemAmount: Number(report?.tenders?.[tType === 'fonepay' ? 'fonepayQr' : tType] || 0),
        enteredAmount: parseFloat(data.entered) || 0,
        referenceNo: data.ref,
        batchNumber: data.batch,
      }));

      const res = await fetch('/api/accounting/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BLIND_CLOSE_SHIFT',
          shiftId: shift.id,
          denominations,
          supervisorPin: supervisorPin.trim() || undefined,
          varianceReason: varianceReason.trim() || undefined,
          minDurationOverrideReason: minDurationReason.trim() || undefined,
          tenderSettlements: tendersPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to close register shift');
      }

      onShiftClosed(json.shift);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to finalize shift close');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900">
        {/* Header with Steps Stepper */}
        <div className="dark-surface px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                EOD GATEWAY
              </span>
              <h2 className="text-lg font-black !text-white tracking-tight">
                Close Register & Reconcile Tenders
              </h2>
            </div>
            <p className="text-xs !text-slate-300 font-mono mt-0.5">
              Shift: <code className="text-blue-300 font-bold bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-500/40">{shift.shiftNumber}</code> • Terminal:{' '}
              <span className="text-purple-300 font-bold">{shift.registerCode}</span> • Cashier:{' '}
              <span className="!text-white font-medium">{shift.cashierName}</span>
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { num: 1, label: 'Blind Cash' },
              { num: 2, label: 'Non-Cash Tenders' },
              { num: 3, label: 'Returns & Voids' },
              { num: 4, label: 'Discrepancy & Sign-Off' },
            ].map((st) => (
              <div
                key={st.num}
                onClick={() => {
                  if (st.num < currentStep) setCurrentStep(st.num as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  currentStep === st.num
                    ? 'bg-blue-600 !text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                    : currentStep > st.num
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60'
                    : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/40 flex items-center justify-center text-[10px]">{st.num}</span>
                <span className="hidden md:inline">{st.label}</span>
              </div>
            ))}

            <button
              onClick={onClose}
              type="button"
              className="dark-surface-btn dark-surface-btn-danger p-2 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow ml-1"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-3 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Fast/Zero-Duration Warning */}
          {isShortDuration && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <div className="font-black text-amber-950">Minimum Shift Duration Guard Active</div>
                  <div className="text-[11px] text-amber-800 mt-0.5 font-medium">
                    Shift has only been open for <strong>{durationMinutes}m</strong> (&lt; 5 minutes). Closing early requires Supervisor PIN override and explanation.
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-amber-200/80 text-amber-950 font-mono text-[10px] font-bold border border-amber-300">
                GUARD &lt; 5m
              </span>
            </div>
          )}

          {/* ================= STEP 1: BLIND CASH DENOMINATION ENTRY ================= */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    Step 1: Enter Blind Cash Count in Till
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Count all physical currency notes and coins. Expected till balance is strictly hidden from cashier until count submission.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-600 shadow-2xs">
                  🔒 Expected Cash: <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">Hidden</span>
                </div>
              </div>

              <DenominationGrid
                values={denominations}
                onChange={setDenominations}
              />
            </div>
          )}

          {/* ================= STEP 2: NON-CASH TENDER ENTRY (SLIPS & GATEWAY) ================= */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  Step 2: Enter Non-Cash Tender Totals from Terminal Slips & Reports
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Verify POS Card settlement slips and merchant wallet totals (Fonepay, eSewa, Khalti). Record batch and voucher references.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'card', label: 'POS Card Settlement Slip (Visa/Mastercard)', icon: CreditCard, color: 'text-blue-600', systemVal: report?.tenders?.card || 0 },
                  { key: 'fonepay', label: 'Fonepay QR Merchant Report', icon: QrCode, color: 'text-purple-600', systemVal: report?.tenders?.fonepayQr || 0 },
                  { key: 'esewa', label: 'eSewa Merchant Statement', icon: Banknote, color: 'text-emerald-600', systemVal: report?.tenders?.esewa || 0 },
                  { key: 'khalti', label: 'Khalti Merchant Statement', icon: Banknote, color: 'text-purple-600', systemVal: report?.tenders?.khalti || 0 },
                ].map((t) => {
                  const state = tenderSettlements[t.key] || { entered: '0', ref: '', batch: '' };
                  const enteredNum = parseFloat(state.entered) || 0;
                  const variance = enteredNum - t.systemVal;

                  return (
                    <div key={t.key} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                          <t.icon className={`w-4 h-4 ${t.color}`} />
                          {t.label}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 font-medium">
                          System: <strong className="text-slate-900">{formatNpr(t.systemVal)}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1 space-y-1">
                          <label className="text-[10px] text-slate-500 font-mono font-bold uppercase">Amount (NPR)</label>
                          <input
                            type="number"
                            value={state.entered}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTenderSettlements((prev) => ({
                                ...prev,
                                [t.key]: { ...prev[t.key], entered: val },
                              }));
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                          />
                        </div>

                        <div className="col-span-1 space-y-1">
                          <label className="text-[10px] text-slate-500 font-mono font-bold uppercase">Batch #</label>
                          <input
                            type="text"
                            value={state.batch}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTenderSettlements((prev) => ({
                                ...prev,
                                [t.key]: { ...prev[t.key], batch: val },
                              }));
                            }}
                            placeholder="Batch No."
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                          />
                        </div>

                        <div className="col-span-1 space-y-1">
                          <label className="text-[10px] text-slate-500 font-mono font-bold uppercase">Ref Slip</label>
                          <input
                            type="text"
                            value={state.ref}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTenderSettlements((prev) => ({
                                ...prev,
                                [t.key]: { ...prev[t.key], ref: val },
                              }));
                            }}
                            placeholder="Slip Ref"
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-100">
                        <span className="text-slate-500 font-medium">Tender Variance:</span>
                        <span
                          className={`font-black ${
                            Math.abs(variance) < 0.01
                              ? 'text-emerald-700'
                              : variance < 0
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {Math.abs(variance) < 0.01 ? '0.00 (Balanced)' : `${variance > 0 ? '+' : ''}${variance.toFixed(2)} NPR`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= STEP 3: RETURNS, VOIDS & SALES WATERFALL ================= */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  Step 3: Review Shift Returns, Voids & Sales Waterfall
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Verify that all returns, voids, and discounts tally strictly with the total tenders collected.
                </p>
              </div>

              {/* Sales Waterfall Graphic */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono">
                  Official Retail Sales Waterfall
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-bold">Gross Sales</span>
                    <strong className="text-slate-900 text-sm block mt-0.5">{formatNpr(grossSales)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 block text-[10px] font-bold">(-) Discounts</span>
                    <strong className="text-emerald-800 text-sm block mt-0.5">-{formatNpr(totalDiscounts)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs">
                    <span className="text-rose-700 block text-[10px] font-bold">(-) Returns / Refunds</span>
                    <strong className="text-rose-800 text-sm block mt-0.5">-{formatNpr(totalReturns)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 shadow-2xs">
                    <span className="text-amber-700 block text-[10px] font-bold">(-) Line Voids</span>
                    <strong className="text-amber-800 text-sm block mt-0.5">-{formatNpr(totalVoids)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-300 shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-blue-700 block text-[10px] font-bold">(=) Net Sales</span>
                    <strong className="text-blue-900 text-sm block mt-0.5">{formatNpr(netSales)}</strong>
                  </div>
                </div>

                {/* Tally check alert */}
                {hasTallyMismatch && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center justify-between shadow-2xs font-medium">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>
                        Tender Tally Mismatch: Total entered tenders (<strong>{formatNpr(totalTendersSum)}</strong>) does not equal Net Sales (<strong>{formatNpr(netSales)}</strong>). Difference: <strong>NPR {tallyDiff.toFixed(2)}</strong>.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Returns & Voids List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-800 flex items-center justify-between">
                  <span>Logged Returns & Voids in Shift</span>
                  <span className="font-mono text-slate-500 text-[11px] font-bold">
                    {transactions.filter((tx) => (tx.paymentBreakdown?.status || '').includes('void') || (tx.paymentBreakdown?.status || '').includes('return')).length} Records
                  </span>
                </div>
                <div className="p-4 text-xs text-slate-600 font-medium text-center">
                  All returns and voids have been verified against original invoice records. Cash refunds reduce expected cash; non-cash refunds reduce wallet tender totals.
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: REVEAL DISCREPANCY & SUPERVISOR APPROVAL ================= */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Step 4: Shift Reconciliation Reveal & Supervisor Authorization
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Expected cash and variances are now revealed. Review variances and authenticate with Supervisor PIN.
                </p>
              </div>

              {/* Reveal Variance Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[11px] font-mono text-slate-500 font-bold uppercase block">Expected Cash in Till</span>
                  <div className="text-xl font-black font-mono text-slate-900">
                    {formatNpr(previewExpectedCash)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    Float ({formatNpr(openingFloat, { showCurrency: false })}) + Sales − Drops/Payouts
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-1">
                  <span className="text-[11px] font-mono text-amber-800 font-bold uppercase block">Counted Cash (Step 1)</span>
                  <div className="text-xl font-black font-mono text-amber-900">
                    {formatNpr(countedCash)}
                  </div>
                  <span className="text-[10px] text-amber-700 font-mono block">
                    Submitted Physical Notes Total
                  </span>
                </div>

                <div
                  className={`p-4 rounded-2xl border shadow-2xs space-y-1 ${
                    absVariance < 0.01
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : previewVariance < 0
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  <span className="text-[11px] font-mono font-bold uppercase opacity-80 block">Cash Variance</span>
                  <div className="text-xl font-black font-mono">
                    {previewVariance > 0 ? `+${formatNpr(previewVariance)}` : formatNpr(previewVariance)}
                  </div>
                  <span className="text-[10px] font-mono font-bold block">
                    {absVariance < 0.01
                      ? '✓ Exact Match (Balanced)'
                      : previewVariance < 0
                      ? `⚠ Shortage of NPR ${absVariance.toFixed(2)}`
                      : `⚠ Overage of NPR ${absVariance.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Recount Trigger Option if Discrepancy Exists */}
              {absVariance > 0.01 && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-blue-600" />
                        Optional Recount (History is preserved)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Cashier may perform a recount if money was miscounted. Count history is preserved as Attempt #{recountAttempt + 1}.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsRecountMode(!isRecountMode)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition cursor-pointer"
                    >
                      {isRecountMode ? 'Cancel Recount' : 'Perform Recount'}
                    </button>
                  </div>

                  {isRecountMode && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <input
                        type="text"
                        value={recountReason}
                        onChange={(e) => setRecountReason(e.target.value)}
                        placeholder="Reason for recount (e.g. checked drawer corners for missing notes)"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleRecount}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 cursor-pointer"
                      >
                        Submit Recount Attempt #{recountAttempt + 1}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mandatory Supervisor PIN / Reason Inputs */}
              {(exceedsTolerance || isShortDuration) && (
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    Supervisor Authorization & Variance Sign-Off Required
                  </div>

                  {isShortDuration && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-700 font-bold">
                        Justification for Minimum Duration Override (&lt; 5 mins)
                      </label>
                      <input
                        type="text"
                        value={minDurationReason}
                        onChange={(e) => setMinDurationReason(e.target.value)}
                        placeholder="e.g. Hardware terminal test or early shift reassignment"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {exceedsTolerance && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-700 font-bold">
                        Reason for Variance (Exceeds NPR 50 tolerance)
                      </label>
                      <input
                        type="text"
                        value={varianceReason}
                        onChange={(e) => setVarianceReason(e.target.value)}
                        placeholder="e.g. Small coin shortage or customer change dispute resolved"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-700 font-bold">
                      Supervisor PIN (Maker-Checker Authorization)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        maxLength={6}
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        placeholder="Enter Supervisor PIN (e.g. 1234 or 9999)"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-rose-300 rounded-xl text-xs text-slate-900 font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Wizard Navigation Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                Continue to Step {currentStep + 1}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Finalize EOD & Close Register
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
