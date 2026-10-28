'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Clock,
  User,
  Monitor,
} from 'lucide-react';
import {
  DenominationGrid,
  DenominationMap,
  DEFAULT_DENOMINATIONS,
  calculateDenominationGrandTotal,
} from './DenominationKeypad';
import { formatNpr } from '@/lib/nepal/money';

interface ShiftOpeningWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftOpened: (newShift: any) => void;
  defaultRegisterCode?: string;
  defaultCashierName?: string;
  defaultCashierId?: number;
}

export function ShiftOpeningWizardModal({
  isOpen,
  onClose,
  onShiftOpened,
  defaultRegisterCode = 'TERM-01 (Main Counter)',
  defaultCashierName = 'Aayush Adhikari',
  defaultCashierId = 1,
}: ShiftOpeningWizardModalProps) {
  const [registerCode, setRegisterCode] = useState(defaultRegisterCode);
  const [cashierName, setCashierName] = useState(defaultCashierName);
  const [cashierCode, setCashierCode] = useState('EMP-104');
  const [denominations, setDenominations] = useState<DenominationMap>({
    ...DEFAULT_DENOMINATIONS,
    '1000': 3,
    '500': 3,
    '100': 4,
    '50': 2,
  }); // Default 5,000 standard float
  const [standardFloat, setStandardFloat] = useState(5000);
  const [notes, setNotes] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Previous shift handover telemetry
  const [prevShiftClosingCash, setPrevShiftClosingCash] = useState<number | null>(null);
  const [prevShiftNumber, setPrevShiftNumber] = useState<string | null>(null);

  const grandTotal = calculateDenominationGrandTotal(denominations);
  const handoverDiff = prevShiftClosingCash !== null ? grandTotal - prevShiftClosingCash : null;
  const floatDiff = grandTotal - standardFloat;

  // Fetch register's previous shift closing cash for handover comparison
  useEffect(() => {
    if (!isOpen) return;
    async function loadLastShift() {
      try {
        const res = await fetch(`/api/pos/shift?register=${encodeURIComponent(registerCode)}`);
        const json = await res.json();
        if (json.lastClosedShift) {
          setPrevShiftClosingCash(Number(json.lastClosedShift.closingCash || 0));
          setPrevShiftNumber(json.lastClosedShift.shiftNumber);
        } else {
          setPrevShiftClosingCash(null);
          setPrevShiftNumber(null);
        }
      } catch (err) {
        console.warn('Failed to load previous shift handover data:', err);
      }
    }
    loadLastShift();
  }, [isOpen, registerCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (grandTotal <= 0) {
      setError('Opening cash float must be greater than NPR 0.');
      return;
    }

    if (!supervisorPin.trim()) {
      setError('Supervisor PIN is strictly required for two-person (Maker-Checker) shift opening verification.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/accounting/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'OPEN_SHIFT',
          registerCode,
          cashierId: defaultCashierId,
          cashierName,
          cashierCode,
          denominations,
          standardFloat,
          supervisorPin: supervisorPin.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to open shift');
      }

      onShiftOpened(json.shift);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to open shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900">
        {/* Header with clean white surface */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between text-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Beginning of Day (BOD) — Open Register Shift
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Count opening float denominations, verify drawer handover, and authenticate with Supervisor PIN.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-3 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Terminal & Cashier Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-blue-600" />
                POS Terminal / Till
              </label>
              <select
                value={registerCode}
                onChange={(e) => setRegisterCode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="TERM-01 (Main Counter)">TERM-01 (Main Counter)</option>
                <option value="TERM-02 (Register A)">TERM-02 (Register A)</option>
                <option value="TERM-03 (Service Desk)">TERM-03 (Service Desk)</option>
              </select>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                Active Cashier
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  value={cashierCode}
                  onChange={(e) => setCashierCode(e.target.value)}
                  title="Cashier Staff Code"
                  placeholder="Code"
                  className="w-24 bg-blue-50 border border-blue-300 rounded-xl px-2 py-1.5 text-xs text-blue-800 font-mono font-bold text-center focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                Standard Float Policy
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-slate-900 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex-1">
                  {formatNpr(standardFloat)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-medium">Store Policy</span>
              </div>
            </div>
          </div>

          {/* Handover Check Telemetry Card */}
          {prevShiftClosingCash !== null && (
            <div
              className={`p-4 rounded-2xl border shadow-2xs flex items-center justify-between gap-4 ${
                handoverDiff === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {handoverDiff === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                )}
                <div>
                  <div className="font-black text-xs">
                    {handoverDiff === 0
                      ? 'Drawer Handover Perfectly Matched'
                      : 'Handover Cash Difference Detected'}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5 font-medium">
                    Previous shift (<code>{prevShiftNumber}</code>) closed with{' '}
                    <strong>{formatNpr(prevShiftClosingCash)}</strong> in drawer. Counted now:{' '}
                    <strong>{formatNpr(grandTotal)}</strong>.
                  </div>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Handover Variance</div>
                <div
                  className={`text-sm font-black ${
                    handoverDiff === 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {handoverDiff !== null && handoverDiff > 0 ? `+${handoverDiff}` : handoverDiff} NPR
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Denomination Entry Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-700 font-mono uppercase tracking-wider flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Count Physical Cash in Register Drawer
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Press Enter or Down arrow to jump between rows
              </span>
            </div>

            <DenominationGrid
              values={denominations}
              onChange={setDenominations}
              targetFloat={standardFloat}
            />
          </div>

          {/* Step 3: Opening Justification & Supervisor Authorization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Opening Notes / Reason for Float Difference (if any)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Standard morning float received from safe vault. All denominations intact."
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs font-medium"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Maker-Checker: Supervisor Verification PIN
              </div>
              <p className="text-[11px] text-slate-600 font-medium">
                A store manager or supervisor must confirm the physical cash float count before sales can begin.
              </p>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  maxLength={6}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="Enter Supervisor PIN (e.g. 1234 or 9999)"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-400/20 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs font-mono text-slate-600 font-medium">
              Initial Float:{' '}
              <strong className="text-slate-900 text-sm font-black">{formatNpr(grandTotal)}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-emerald-800 border-2 border-emerald-400 font-black text-xs shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                )}
                Confirm Float & Open Shift
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
