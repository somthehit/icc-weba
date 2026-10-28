'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  Package,
  Banknote,
  Send,
  RefreshCw,
  Lock,
  ExternalLink,
} from 'lucide-react';
import PrintablePaperEodForm from './PrintablePaperEodForm';

interface BlindEodCloseModalProps {
  isOpen: boolean;
  terminalCode: string;
  shiftId: number | string | null;
  cashierName: string;
  onClosed: () => void;
  onCloseModal: () => void;
}

export default function BlindEodCloseModal({
  isOpen,
  terminalCode,
  shiftId,
  cashierName,
  onClosed,
  onCloseModal,
}: BlindEodCloseModalProps) {
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [envelopeSealNo, setEnvelopeSealNo] = useState(`ENV-${Date.now().toString().slice(-4)}`);
  const [voucherBundleCount, setVoucherBundleCount] = useState<number>(0);
  const [cashierNotes, setCashierNotes] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(true);

  // Supervisor sign-off PIN (optional/handover security)
  const [supervisorCode, setSupervisorCode] = useState('ADMIN');
  const [supervisorPin, setSupervisorPin] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedData, setSubmittedData] = useState<any | null>(null);
  const [activeView, setActiveView] = useState<'summary' | 'print'>('summary');

  useEffect(() => {
    if (isOpen) {
      fetchEodSummary();
    }
  }, [isOpen, terminalCode, shiftId]);

  const fetchEodSummary = async () => {
    setLoadingSummary(true);
    setErrorMessage('');
    try {
      const url = `/api/pos/eod/summary?terminalCode=${terminalCode}${shiftId ? `&shiftId=${shiftId}` : ''}&_t=${Date.now()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setSummaryData(data);
        if (data.isAlreadySubmitted && data.submission) {
          setSubmittedData(data.submission);
        }
      } else {
        setErrorMessage(data.error || 'Failed to load shift sales summary.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to POS EOD service.');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen) return null;

  const summary = summaryData?.summary || {};
  const isAlreadySubmitted = Boolean(submittedData || summaryData?.isAlreadySubmitted);
  const currentStatus = submittedData?.status || summaryData?.submission?.status || 'SUBMITTED_TO_ACCOUNTANT';
  const isReturnedForClarification = currentStatus === 'RETURNED_FOR_CLARIFICATION';

  const handleSubmitEod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationAccepted) {
      setErrorMessage('Please accept the cashier handover declaration before submitting.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/pos/eod/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: summary.shiftId || shiftId,
          terminalCode,
          envelopeSealNo,
          physicalVouchersCount: Number(voucherBundleCount) || 0,
          cashierNotes,
          supervisorPin: supervisorPin.trim(),
          summary,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit EOD sales summary.');
      }

      setSubmittedData(data.submission);
      setActiveView('print');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting EOD to Accountant.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFinishAndLock = () => {
    onClosed();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs font-sans">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        
        {/* HEADER BAR */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs">
              <FileText className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  End of Day (EOD)
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Simplified Cashier Summary &amp; Handover
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mt-0.5">
                Register Sales Summary &amp; Envelope Submission
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Register Till
              </span>
              <span className="text-xs font-black text-slate-900">
                {terminalCode} • {cashierName}
              </span>
            </div>
            {activeView === 'print' && (
              <button
                type="button"
                onClick={() => setActiveView('summary')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Back to Summary
              </button>
            )}
            <button
              type="button"
              onClick={onCloseModal}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
              title="Close window"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* BODY AREA */}
        {loadingSummary ? (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
            <p className="text-sm font-bold text-slate-800">Compiling register sales and drawer balance...</p>
            <p className="text-xs text-slate-500">Retrieving computer sales, tender breakdown, and accounting float.</p>
          </div>
        ) : activeView === 'print' ? (
          /* PRINTABLE PAPER EOD FORM VIEW */
          <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <strong className="block font-black text-sm">EOD Sales Summary Submitted Successfully!</strong>
                  <span>Your paper handover slip is ready. Print 2 copies: 1 for the sealed accounts envelope, 1 for your till binder.</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer transition active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinishAndLock}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs cursor-pointer transition active:scale-95"
                >
                  <Lock className="h-4 w-4" />
                  <span>Lock Register Till</span>
                </button>
              </div>
            </div>

            <PrintablePaperEodForm
              eodReference={summary.eodReference || submittedData?.eodReference || 'EOD-REF'}
              businessDate={summary.businessDate}
              branch={summary.branch || 'Dhangadhi Main Branch, Nepal'}
              registerCode={summary.registerCode || terminalCode}
              shiftNumber={summary.shiftNumber}
              cashierName={summary.cashierName || cashierName}
              cashierCode={summary.cashierCode}
              openedAt={summary.openedAt}
              submittedAt={submittedData?.submittedAt || new Date().toISOString()}
              openingFloat={summary.openingFloat || 0}
              totalSales={summary.totalSales || 0}
              cashSales={summary.cashSales || 0}
              cardSales={summary.cardSales || 0}
              qrSales={summary.qrSales || 0}
              bankTransferSales={summary.bankTransferSales || 0}
              creditSales={summary.creditSales || 0}
              taxableAmount={summary.taxableAmount || 0}
              vatAmount={summary.vatAmount || 0}
              discountAmount={summary.discountAmount || 0}
              refundsAmount={summary.refundsAmount || 0}
              voidsCount={summary.voidsCount || 0}
              voidsAmount={summary.voidsAmount || 0}
              totalTransactions={summary.totalTransactions || 0}
              cashAdditions={summary.cashAdditions || 0}
              cashPayouts={summary.cashPayouts || 0}
              safeDrops={summary.safeDrops || 0}
              expectedClosingCash={summary.expectedClosingCash || 0}
              envelopeSealNo={envelopeSealNo}
              physicalVouchersCount={Number(voucherBundleCount) || 0}
              cashierNotes={cashierNotes}
              cashierDeclaration={summary.cashierDeclaration}
              supervisorName={summary.openedBySupervisorName}
            />
          </div>
        ) : (
          /* READ-ONLY SUMMARY & SUBMISSION FORM */
          <form onSubmit={handleSubmitEod} className="flex-1 overflow-y-auto p-6 space-y-6">
            {errorMessage && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STATUS BANNER IF ALREADY SUBMITTED OR RETURNED */}
            {isAlreadySubmitted && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
                isReturnedForClarification
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : currentStatus === 'FINALIZED'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}>
                <div className="flex items-center gap-3">
                  {isReturnedForClarification ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                  )}
                  <div>
                    <strong className="block font-black text-sm">
                      {isReturnedForClarification
                        ? 'Returned by Accountant for Clarification'
                        : currentStatus === 'FINALIZED'
                        ? 'EOD Reconciled & Finalized by Accounts'
                        : `EOD Status: ${currentStatus.replace(/_/g, ' ')}`}
                    </strong>
                    {isReturnedForClarification ? (
                      <span className="font-semibold text-amber-800">
                        Reason: {submittedData?.clarificationReason || summaryData?.submission?.clarificationReason || 'Please verify physical voucher envelope count.'}
                      </span>
                    ) : (
                      <span>EOD Ref: {submittedData?.eodReference || summary.eodReference}. Original snapshot is preserved and locked.</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView('print')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold shadow-2xs hover:bg-slate-50 transition"
                >
                  <Printer className="h-4 w-4" />
                  <span>View Printable Form</span>
                </button>
              </div>
            )}

            {/* TOP METADATA CARD */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">EOD Reference</span>
                <span className="font-mono font-black text-slate-900 text-xs">{summary.eodReference || 'EOD-AUTO'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Business Date</span>
                <span className="font-mono font-bold text-slate-800">{summary.businessDate}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Branch &amp; Register</span>
                <span className="font-bold text-slate-800">{summary.registerCode} • Dhangadhi</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Shift &amp; Cashier</span>
                <span className="font-bold text-slate-800">{summary.cashierName} ({summary.shiftNumber})</span>
              </div>
            </div>

            {/* TWO-COLUMN WORKSPACE: LEFT = READ-ONLY SALES; RIGHT = DRAWER & HANDOVER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: READ-ONLY SALES SUMMARY BY TENDER (7 COLS) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      POS Sales &amp; Tender Totals (Read-Only)
                    </span>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {summary.totalTransactions} Invoices Generated
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <span className="font-bold text-slate-800">Cash Collections (Till Bills)</span>
                      <strong className="font-mono font-black text-emerald-900 text-sm">
                        Rs. {(summary.cashSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                      <span className="font-bold text-slate-800">Card (EDC / SCT / Visa)</span>
                      <strong className="font-mono font-bold text-blue-900">
                        Rs. {(summary.cardSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-purple-50/60 border border-purple-100">
                      <span className="font-bold text-slate-800">Dynamic QR (Fonepay / eSewa / Khalti)</span>
                      <strong className="font-mono font-bold text-purple-900">
                        Rs. {(summary.qrSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-700">Bank Transfer / ConnectIPS</span>
                      <strong className="font-mono font-bold text-slate-800">
                        Rs. {(summary.bankTransferSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-700">Credit Sales (Customer Accounts)</span>
                      <strong className="font-mono font-bold text-slate-800">
                        Rs. {(summary.creditSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    {/* Total Gross Sales */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                      <span>TOTAL GROSS REVENUE:</span>
                      <span className="font-mono text-base text-emerald-800">
                        Rs. {(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TAX, DISCOUNTS, VOIDS */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">13% Nepal Statutory VAT</span>
                    <strong className="font-mono text-sm text-slate-900">
                      Rs. {(summary.vatAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Taxable: Rs. {(summary.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Discounts &amp; Voids</span>
                    <strong className="font-mono text-sm text-slate-900">
                      Rs. {(summary.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Voids: {summary.voidsCount || 0} (Rs. {(summary.voidsAmount || 0).toLocaleString('en-IN')})
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: EXPECTED CASH ACCORDING TO ACCOUNTING RULES & ENVELOPE HANDOVER (5 COLS) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* EXPECTED CLOSING CASH CARD */}
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="font-black text-emerald-950 uppercase tracking-wide">
                      Expected Cash in Till (Accounting Rule)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      Standard Audit Formula
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-700">
                    <div className="flex justify-between">
                      <span>(+) Opening Float (BOD):</span>
                      <strong className="font-mono text-slate-900">Rs. {(summary.openingFloat || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>(+) Cash Sales Received:</span>
                      <strong className="font-mono text-slate-900">Rs. {(summary.cashSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>(+) Cash Additions (Paid In):</span>
                      <strong className="font-mono text-slate-900">Rs. {(summary.cashAdditions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>(-) Petty Cash Payouts:</span>
                      <strong className="font-mono">Rs. {(summary.cashPayouts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>(-) Safe Drops to Cash Office:</span>
                      <strong className="font-mono">Rs. {(summary.safeDrops || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>(-) Cash Refunds:</span>
                      <strong className="font-mono">Rs. {(summary.refundsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-emerald-200 flex items-center justify-between text-emerald-950">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        Expected Closing Cash
                      </span>
                      <span className="text-[10px] text-emerald-700">To be sealed in pouch</span>
                    </div>
                    <div className="font-mono text-xl font-black text-emerald-900">
                      Rs. {(summary.expectedClosingCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* ENVELOPE BUNDLE & HANDOVER INPUTS */}
                <div className="border border-slate-200 bg-white rounded-2xl p-4 space-y-3.5 text-xs shadow-2xs">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-amber-600" />
                      Physical Deposit Envelope Details
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cashier submits the sealed pouch; Accountant enters physical note counts upon receipt.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                        Envelope Seal Tag #
                      </label>
                      <input
                        type="text"
                        value={envelopeSealNo}
                        onChange={(e) => setEnvelopeSealNo(e.target.value)}
                        disabled={isAlreadySubmitted && !isReturnedForClarification}
                        className="w-full h-9 rounded-xl border border-slate-300 bg-slate-50 px-3 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                        Invoices / Vouchers Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={voucherBundleCount || ''}
                        onChange={(e) => setVoucherBundleCount(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        disabled={isAlreadySubmitted && !isReturnedForClarification}
                        className="w-full h-9 rounded-xl border border-slate-300 bg-slate-50 px-3 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Cashier Handover Notes */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                      Cashier Handover Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={cashierNotes}
                      onChange={(e) => setCashierNotes(e.target.value)}
                      placeholder="e.g. All counted physical notes, customer invoice duplicates, and expense slips sealed in pouch."
                      disabled={isAlreadySubmitted && !isReturnedForClarification}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden resize-none"
                    />
                  </div>

                  {/* Cashier Declaration Checkbox */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={declarationAccepted}
                        onChange={(e) => setDeclarationAccepted(e.target.checked)}
                        disabled={isAlreadySubmitted && !isReturnedForClarification}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-700 leading-snug">
                        I declare that the POS sales and tender totals presented in this summary represent a true and accurate record of transactions during my shift.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveView('print')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <Printer className="h-4 w-4 text-slate-600" />
                <span>Preview Paper Form (A4)</span>
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                {(!isAlreadySubmitted || isReturnedForClarification) ? (
                  <button
                    type="submit"
                    disabled={submitting || !declarationAccepted}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md cursor-pointer transition active:scale-95"
                  >
                    {submitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>{isReturnedForClarification ? 'Resubmit EOD with Clarification' : 'Submit EOD to Accountant'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishAndLock}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md cursor-pointer transition active:scale-95"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Lock Register Till</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
