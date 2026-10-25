'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  ShieldCheck,
  ShieldAlert,
  Coins,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  KeyRound,
  Lock,
  Printer,
  FileText,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PosStaffUser } from './CashierAuthModal';
import { NEPALI_DENOMINATIONS } from './OpenShiftModal';

interface EodReconciliationModalProps {
  isOpen: boolean;
  shift: any;
  theme?: 'dark' | 'light';
  initialMode?: 'blind' | 'accountant';
  onClose: () => void;
  onShiftClosed: (closedShift: any, eodReport: any) => void;
}

export const EodReconciliationModal: React.FC<EodReconciliationModalProps> = ({
  isOpen,
  shift,
  theme = 'dark',
  initialMode = 'blind',
  onClose,
  onShiftClosed,
}) => {
  // Mode: 'blind' = Cashier Blind Count & Envelope Handover (Stage 3)
  //       'accountant' = Accountant Variance Reconciliation & EOD Z-Report (Stage 4)
  const [modalMode, setModalMode] = useState<'blind' | 'accountant'>(initialMode);

  // Cash denomination counts - Starts at 0 for true blind count
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

  // Stage 3: Cashier Envelope Handover Fields
  const [envelopeNumber, setEnvelopeNumber] = useState('');
  const [vouchersBundleCount, setVouchersBundleCount] = useState<string>('0');
  const [cashierNote, setCashierNote] = useState('All daily invoices, card merchant copies, and cash bundled.');

  // Handover slip generated after cashier submits blind count
  const [submittedHandoverSlip, setSubmittedHandoverSlip] = useState<any | null>(null);

  // Stage 4: Accountant Authorization State
  const [supervisors, setSupervisors] = useState<PosStaffUser[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [accountantAuditNote, setAccountantAuditNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Z-Report slip display state once finalized by accountant
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSupervisorPin('');
      setGeneratedReport(null);
      setSubmittedHandoverSlip(null);
      setModalMode(initialMode);
      setEnvelopeNumber(`ENV-${shift?.shiftNumber?.slice(-4) || Math.floor(1000 + Math.random() * 9000)}`);
      fetchSupervisors();

      // Clear denominations for blind count (Never pre-fill expected cash!)
      setDenominations({
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

      // If shift was already submitted by cashier, initialize denominations from submitted count
      if (shift?.closingDenominations && typeof shift.closingDenominations === 'object') {
        setDenominations(shift.closingDenominations);
        if (shift.status === 'SUBMITTED') {
          setModalMode('accountant');
        }
      }
    }
  }, [isOpen, shift, initialMode]);

  const fetchSupervisors = async () => {
    try {
      const res = await fetch('/api/pos/auth');
      const data = await res.json();
      if (data.success && data.staff) {
        const sups = data.staff.filter((s: PosStaffUser) => s.isSupervisor);
        setSupervisors(sups);
        if (sups.length > 0) {
          const defaultSup = sups.find((s: PosStaffUser) => s.role === 'admin') || sups[0];
          setSelectedSupervisorId(defaultSup.id);
        }
      }
    } catch (err) {
      console.error('Failed to load supervisors:', err);
    }
  };

  // Physical counted total
  const countedPhysicalCash = NEPALI_DENOMINATIONS.reduce((sum, denom) => {
    const qty = denominations[denom.value.toString()] || 0;
    return sum + denom.value * qty;
  }, 0);

  // Expected in drawer (Visible ONLY in Accountant Mode)
  const openingFloat = Number(shift?.liveMetrics?.openingFloat ?? shift?.openingFloat ?? 0);
  const cashSales = Number(shift?.liveMetrics?.cashSales ?? shift?.totalCashSales ?? 0);
  const cashIn = Number(shift?.liveMetrics?.totalCashIn ?? 0);
  const cashOut = Number(shift?.liveMetrics?.totalCashOut ?? 0);
  const safeDrops = Number(shift?.liveMetrics?.totalSafeDrops ?? 0);
  const expectedCash = Number(
    shift?.liveMetrics?.expectedCash ??
      shift?.expectedCash ??
      openingFloat + cashSales + cashIn - cashOut - safeDrops
  );

  const discrepancy = countedPhysicalCash - expectedCash;
  const isBalanced = Math.abs(discrepancy) < 0.01;
  const isOver = discrepancy > 0.01;
  const isShort = discrepancy < -0.01;

  const handleQtyChange = (valStr: string, qty: number) => {
    const clamped = Math.max(0, Math.min(999, isNaN(qty) ? 0 : qty));
    setDenominations((prev) => ({
      ...prev,
      [valStr]: clamped,
    }));
  };

  // 1. CASHIER BLIND SUBMISSION (STAGE 3)
  const handleSubmitBlindClose = async () => {
    if (countedPhysicalCash <= 0) {
      const confirmZero = confirm(
        'Warning: You have entered 0 physical notes. Are you sure the cash drawer is completely empty?'
      );
      if (!confirmZero) return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_blind_close',
          shiftId: shift.id,
          countedDenominations: denominations,
          envelopeNumber: envelopeNumber.trim() || `ENV-${shift.shiftNumber.slice(-4)}`,
          vouchersBundleCount: parseInt(vouchersBundleCount, 10) || 0,
          cashierNote: cashierNote.trim(),
          submittedByName: shift.cashierName,
        }),
      });

      const data = await res.json();
      if (data.success && data.handoverSlip) {
        setSubmittedHandoverSlip(data.handoverSlip);
        onShiftClosed(data.shift, null);
      } else {
        setErrorMsg(data.error || 'Failed to submit blind cash count.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error while submitting blind close.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. ACCOUNTANT RECONCILIATION & Z-REPORT (STAGE 4)
  const handleFinalizeReconciliation = async () => {
    if (!selectedSupervisorId) {
      setErrorMsg('Please select an Accountant or Store Manager to authorize settlement.');
      return;
    }

    if (!supervisorPin) {
      setErrorMsg('Accountant or Supervisor PIN is strictly required to finalize reconciliation.');
      return;
    }

    if (!isBalanced && !accountantAuditNote.trim()) {
      setErrorMsg(
        `A variance explanation is mandatory because actual cash differs from expected by NPR ${Math.abs(
          discrepancy
        ).toLocaleString('en-IN')}. Please state reasons in Audit Note.`
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          shiftId: shift.id,
          closingCash: countedPhysicalCash,
          closingDenominations: denominations,
          supervisorId: selectedSupervisorId,
          supervisorPin: supervisorPin.trim(),
          note: accountantAuditNote,
          varianceReason: accountantAuditNote.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.eodReport) {
        setGeneratedReport(data.eodReport);
        onShiftClosed(data.shift, data.eodReport);
      } else {
        setErrorMsg(data.error || 'Supervisor verification failed. EOD rejected.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error while reconciling shift.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-5xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] ${
          isDark ? 'bg-[#181d1b] border-[#82d8a9] text-[#dfe4e0]' : 'bg-white border-emerald-600 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isDark ? 'bg-[#0a0f0d] border-[#262b29]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 flex items-center justify-center font-bold text-lg border ${
                modalMode === 'blind'
                  ? isDark
                    ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                  : isDark
                  ? 'bg-[#1c211e] text-[#82d8a9] border-[#82d8a9]/40'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              {modalMode === 'blind' ? <PackageCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight">
                  {modalMode === 'blind'
                    ? '[3. EOD SUBMISSION] Cashier Blind Close & Envelope Handover'
                    : '[4. RECONCILIATION] Accountant Verification & EOD Z-Report'}
                </h2>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${
                    modalMode === 'blind'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {modalMode === 'blind' ? 'BLIND COUNT' : 'ACCOUNTANT AUDIT'}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                {modalMode === 'blind'
                  ? 'Count notes physically and submit sealed envelope to Accounts. Expected cash is strictly confidential.'
                  : 'Reconcile submitted cash against system sales, inspect variances, and finalize official settlement.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher Button for Managers / Supervisors */}
            {!submittedHandoverSlip && !generatedReport && (
              <button
                type="button"
                onClick={() => setModalMode((prev) => (prev === 'blind' ? 'accountant' : 'blind'))}
                className={`text-[11px] font-bold px-2.5 py-1.5 border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-[#1c211e] hover:bg-[#262b29] text-slate-300 border-[#3f4942]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="Switch between Cashier Blind Close and Accountant Audit mode"
              >
                {modalMode === 'blind' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#82d8a9]" />
                    <span>Accountant Mode</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cashier Blind Mode</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className={`p-1.5 border cursor-pointer ${
                isDark
                  ? 'text-[#88938b] hover:text-white border-[#262b29] hover:bg-[#262b29]'
                  : 'text-slate-500 hover:text-slate-900 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {submittedHandoverSlip ? (
          /* STAGE 3 RESULT: CASHIER SHIFT HANDOVER SLIP */
          <div className={`flex-1 overflow-y-auto p-6 flex flex-col items-center ${isDark ? 'bg-[#0a0f0d]' : 'bg-slate-100'}`}>
            <div className="w-full max-w-md bg-white text-black p-6 font-mono text-xs shadow-2xl border-2 border-slate-400 space-y-3">
              <div className="text-center border-b pb-3 border-dashed border-gray-400">
                <h3 className="font-bold text-base uppercase tracking-wider">INTEL COMPUTER CENTER</h3>
                <p className="text-[10px] text-gray-600">Dhangadhi Flagship Station #287 • Kailali</p>
                <div className="mt-2 text-xs font-bold bg-black text-white py-1 uppercase tracking-widest">
                  CASHIER SHIFT HANDOVER SLIP (खाम भौचर)
                </div>
                <div className="text-[10px] text-gray-700 mt-1 font-bold">
                  ENVELOPE SEAL NO: #{submittedHandoverSlip.envelopeNumber}
                </div>
              </div>

              <div className="text-[11px] space-y-1 border-b pb-2 border-dashed border-gray-400">
                <div className="flex justify-between">
                  <span>Shift Number:</span>
                  <span className="font-bold">{shift?.shiftNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Register Terminal:</span>
                  <span>{shift?.registerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier On Duty:</span>
                  <span className="font-bold">{submittedHandoverSlip.submittedByName}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Submitted At:</span>
                  <span>{new Date(submittedHandoverSlip.submittedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Physical Notes Table */}
              <div className="space-y-1 border-b pb-2 border-dashed border-gray-400 text-[11px]">
                <div className="font-bold uppercase text-[10px] text-gray-700 mb-1">
                  Enclosed Cash Breakdown (Blind Count):
                </div>
                {Object.entries(submittedHandoverSlip.denominations || {}).map(([note, qty]) => {
                  const q = Number(qty);
                  if (q <= 0) return null;
                  return (
                    <div key={note} className="flex justify-between">
                      <span>₨ {note} × {q}</span>
                      <span>₨ {(Number(note) * q).toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold text-sm border-t pt-1 border-gray-300">
                  <span>TOTAL CASH IN ENVELOPE:</span>
                  <span>₨ {Number(submittedHandoverSlip.totalSubmittedCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Attached Vouchers & Invoices */}
              <div className="text-[11px] space-y-1 border-b pb-2 border-dashed border-gray-400">
                <div className="flex justify-between">
                  <span>Attached Slips &amp; Vouchers:</span>
                  <span className="font-bold">{submittedHandoverSlip.vouchersBundleCount} Bundled</span>
                </div>
                <div className="text-[10px] text-gray-600 italic">
                  Note: {submittedHandoverSlip.cashierNote}
                </div>
              </div>

              {/* Dual Signatures */}
              <div className="pt-6 border-t border-dashed border-gray-400 grid grid-cols-2 gap-4 text-center text-[10px]">
                <div className="border-t border-gray-400 pt-1">
                  <div className="font-bold">{submittedHandoverSlip.submittedByName}</div>
                  <div className="text-gray-500">Cashier Signature (बुझाउने)</div>
                </div>
                <div className="border-t border-gray-400 pt-1">
                  <div className="text-gray-400">___________________</div>
                  <div className="text-gray-500">Accountant Signature (बुझिलिने)</div>
                </div>
              </div>

              <div className="text-center pt-2 text-[9px] text-gray-500">
                Insert this printed slip with physical cash &amp; invoices into Envelope #{submittedHandoverSlip.envelopeNumber}.
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                className="px-5 py-2.5 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Handover Slip (थर्मल प्रिन्ट)</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Close &amp; Deliver Envelope
              </button>
            </div>
          </div>
        ) : generatedReport ? (
          /* STAGE 4 RESULT: OFFICIAL EOD Z-REPORT SLIP */
          <div className={`flex-1 overflow-y-auto p-6 flex flex-col items-center ${isDark ? 'bg-[#0a0f0d]' : 'bg-slate-100'}`}>
            <div className="w-full max-w-md bg-white text-black p-6 font-mono text-xs shadow-2xl border-2 border-slate-400 space-y-3">
              <div className="text-center border-b pb-3 border-dashed border-gray-400">
                <h3 className="font-bold text-base uppercase tracking-wider">INTEL COMPUTER CENTER</h3>
                <p className="text-[10px] text-gray-600">Dhangadhi Flagship Station #287 • Kailali</p>
                <div className="mt-2 text-xs font-bold bg-black text-white py-1">
                  OFFICIAL END OF DAY Z-REPORT
                </div>
                <div className="text-[10px] text-gray-600 mt-1">REPORT ID: {generatedReport.zReportNumber}</div>
              </div>

              <div className="text-[11px] space-y-1 border-b pb-2 border-dashed border-gray-400">
                <div className="flex justify-between">
                  <span>Register Terminal:</span>
                  <span className="font-bold">{generatedReport.registerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shift Number:</span>
                  <span className="font-bold">{generatedReport.shiftNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier On Duty:</span>
                  <span className="font-bold">{generatedReport.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Authorized Accountant:</span>
                  <span className="font-bold">{generatedReport.closedBySupervisorName}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Opened / Closed:</span>
                  <span>
                    {new Date(generatedReport.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(generatedReport.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Drawer Cash Reconciliation Math */}
              <div className="space-y-1 border-b pb-2 border-dashed border-gray-400 text-[11px]">
                <div className="font-bold uppercase text-[10px] text-gray-600">Reconciliation Audit</div>
                <div className="flex justify-between">
                  <span>Opening Float (BOD):</span>
                  <span>₨ {Number(generatedReport.openingFloat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Cash Sales:</span>
                  <span>₨ {Number(generatedReport.cashSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Cash In / Floats:</span>
                  <span>₨ {Number(generatedReport.totalCashIn).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>(−) Cash Out / Petty / Drops:</span>
                  <span>₨ {(Number(generatedReport.totalCashOut) + Number(generatedReport.totalSafeDrops)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 border-gray-300">
                  <span>EXPECTED SYSTEM CASH:</span>
                  <span>₨ {Number(generatedReport.expectedCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span>ACTUAL CASH SUBMITTED:</span>
                  <span>₨ {Number(generatedReport.closingCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div
                  className={`flex justify-between font-bold p-1.5 mt-1 text-xs border ${
                    generatedReport.discrepancyStatus === 'BALANCED'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : generatedReport.discrepancyStatus === 'CASH_OVER'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  <span>VARIANCE: {generatedReport.discrepancyStatus}</span>
                  <span>
                    {Number(generatedReport.discrepancy) > 0 ? '+' : ''}
                    ₨ {Number(generatedReport.discrepancy).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-dashed border-gray-400 grid grid-cols-2 gap-4 text-center text-[10px]">
                <div className="border-t border-gray-400 pt-1">
                  <div>{generatedReport.cashierName}</div>
                  <div className="text-gray-500">Cashier</div>
                </div>
                <div className="border-t border-gray-400 pt-1">
                  <div>{generatedReport.closedBySupervisorName}</div>
                  <div className="text-gray-500">Accountant / Auditor</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                className="px-5 py-2.5 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Z-Report</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Close Settlement
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW: BLIND COUNT (STAGE 3) OR ACCOUNTANT RECONCILIATION (STAGE 4) */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Denominations Counter (Always Physical Notes) */}
            <div className="lg:col-span-7 space-y-4">
              <div
                className={`p-4 border flex items-center justify-between ${
                  isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" />
                    Physical Cash Drawer Count
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                    Enter the exact number of currency notes &amp; coins physically in the drawer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDenominations({
                      '1000': 0,
                      '500': 0,
                      '100': 0,
                      '50': 0,
                      '20': 0,
                      '10': 0,
                      '5': 0,
                      '2': 0,
                      '1': 0,
                    })
                  }
                  className={`text-xs underline cursor-pointer ${
                    isDark ? 'text-[#88938b] hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Clear All
                </button>
              </div>

              {/* Denominations table */}
              <div
                className={`border overflow-hidden ${
                  isDark ? 'bg-[#141816] border-[#262b29]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className={`text-[10px] uppercase font-bold border-b sticky top-0 z-10 ${
                        isDark ? 'bg-[#181d1b] text-[#88938b] border-[#262b29]' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <tr>
                        <th className="p-2.5">Note Value</th>
                        <th className="p-2.5 text-center">Quantity</th>
                        <th className="p-2.5 text-right">Subtotal (NPR)</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-[#262b29]' : 'divide-slate-200'}`}>
                      {NEPALI_DENOMINATIONS.map((d) => {
                        const qty = denominations[d.value.toString()] || 0;
                        const subtotal = d.value * qty;
                        return (
                          <tr key={d.value} className={isDark ? 'hover:bg-[#1a201c]' : 'hover:bg-slate-50'}>
                            <td className="p-2.5 font-bold font-mono text-xs">
                              <span className={d.color}>{d.label}</span>
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(d.value.toString(), qty - 1)}
                                  className={`w-6 h-6 flex items-center justify-center font-bold border cursor-pointer ${
                                    isDark
                                      ? 'bg-[#1c211e] hover:bg-[#262b29] text-white border-[#3f4942]'
                                      : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
                                  }`}
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max="999"
                                  value={qty === 0 ? '' : qty}
                                  onChange={(e) => handleQtyChange(d.value.toString(), parseInt(e.target.value, 10))}
                                  placeholder="0"
                                  className={`w-14 py-1 text-center font-mono font-bold text-xs focus:outline-none ${
                                    isDark
                                      ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                                      : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(d.value.toString(), qty + 1)}
                                  className={`w-6 h-6 flex items-center justify-center font-bold border cursor-pointer ${
                                    isDark
                                      ? 'bg-[#1c211e] hover:bg-[#262b29] text-white border-[#3f4942]'
                                      : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
                                  }`}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-xs">
                              ₨ {subtotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Count Total Banner */}
                <div
                  className={`p-3 border-t flex items-center justify-between ${
                    isDark ? 'bg-[#181d1b] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-xs uppercase font-bold ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                    Total Counted Physical Cash:
                  </span>
                  <span className={`font-mono text-base font-black ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    ₨ {countedPhysicalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Stage 3 Blind Submission OR Stage 4 Accountant Reconciliation */}
            <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
              {modalMode === 'blind' ? (
                /* STAGE 3: CASHIER BLIND SUBMISSION DETAILS */
                <div className="space-y-4">
                  <div
                    className={`p-4 border space-y-3 ${
                      isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className="font-bold uppercase tracking-wider text-xs">
                        Cashier Handover Envelope Details
                      </span>
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                      Expected system cash is hidden under blind shift policy. Bundle physical cash and invoices inside
                      the envelope.
                    </p>

                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Envelope / Seal Tag No *:
                      </label>
                      <input
                        type="text"
                        value={envelopeNumber}
                        onChange={(e) => setEnvelopeNumber(e.target.value)}
                        placeholder="e.g. ENV-26-081"
                        className={`w-full p-2 text-xs font-mono font-bold focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Vouchers &amp; Receipts Bundled (Count) *:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={vouchersBundleCount}
                        onChange={(e) => setVouchersBundleCount(e.target.value)}
                        placeholder="e.g. 14 customer invoices, 2 expense vouchers"
                        className={`w-full p-2 text-xs font-mono focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Cashier Note / Observations:
                      </label>
                      <textarea
                        rows={2}
                        value={cashierNote}
                        onChange={(e) => setCashierNote(e.target.value)}
                        placeholder="e.g. All counter invoices and morning float reconciled"
                        className={`w-full p-2 text-xs focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSubmitBlindClose}
                    className="w-full py-3 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[#82d8a9] shadow-lg cursor-pointer transition-all disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>
                      {isLoading ? 'Submitting...' : 'Seal Envelope & Submit to Accounts (अकाउन्टमा बुझाउने)'}
                    </span>
                  </button>
                </div>
              ) : (
                /* STAGE 4: ACCOUNTANT RECONCILIATION & VARIANCE AUDIT */
                <div className="space-y-4">
                  {/* System Math & Variance Comparison */}
                  <div
                    className={`p-4 border space-y-2.5 ${
                      isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#262b29]">
                      <span className="font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#82d8a9]" />
                        Accountant Variance Audit
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">System Math</span>
                    </div>

                    <div className="text-xs space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Opening Float (BOD):</span>
                        <span>₨ {openingFloat.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">(+) Cash Sales:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ₨ {cashSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">(+) Manual Cash In:</span>
                        <span>₨ {cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">(−) Cash Out &amp; Drops:</span>
                        <span className="text-rose-600 dark:text-rose-400">
                          ₨ {(cashOut + safeDrops).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-1 border-t border-slate-200 dark:border-[#262b29]">
                        <span>Expected System Cash:</span>
                        <span className="text-amber-600 dark:text-[#ffb95f]">
                          ₨ {expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Actual Cash Submitted:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ₨ {countedPhysicalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Variance Banner */}
                    <div
                      className={`p-2.5 font-bold font-mono text-xs border flex items-center justify-between ${
                        isBalanced
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : isOver
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {isBalanced ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        <span>{isBalanced ? 'EXACT MATCH (0.00)' : isOver ? 'CASH OVER / SURPLUS' : 'CASH SHORT / DEFICIT'}</span>
                      </div>
                      <span>
                        {isOver ? '+' : ''}₨ {discrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Supervisor Auth & PIN */}
                  <div
                    className={`p-4 border space-y-3 ${
                      isDark ? 'bg-[#101512] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Authorized Accountant / Auditor *:
                      </label>
                      <select
                        value={selectedSupervisorId || ''}
                        onChange={(e) => setSelectedSupervisorId(Number(e.target.value))}
                        className={`w-full p-2 text-xs focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      >
                        {supervisors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.role.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-[#88938b]' : 'text-slate-600'}`}>
                        Supervisor / Accountant PIN *:
                      </label>
                      <input
                        type="password"
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
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
                        Audit Explanation / Resolution Note {!isBalanced && '(Mandatory for variance)'}:
                      </label>
                      <textarea
                        rows={2}
                        value={accountantAuditNote}
                        onChange={(e) => setAccountantAuditNote(e.target.value)}
                        placeholder="e.g. Verified against physical invoice copies and petty cash tea vouchers."
                        className={`w-full p-2 text-xs focus:outline-none ${
                          isDark
                            ? 'bg-[#0a0f0d] border border-[#3f4942] text-white focus:border-[#82d8a9]'
                            : 'bg-white border border-slate-300 text-slate-900 focus:border-emerald-600'
                        }`}
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleFinalizeReconciliation}
                    className="w-full py-3 bg-[#006b45] hover:bg-[#036c46] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[#82d8a9] shadow-lg cursor-pointer transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isLoading ? 'Reconciling...' : 'Approve Settlement & Issue Z-Report (अडिट अनुमोदन)'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
