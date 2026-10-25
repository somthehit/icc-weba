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
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Beginning of Day (BOD) — Open Register Shift
              </h2>
              <p className="text-xs text-slate-400">
                Count opening float denominations, verify drawer handover, and authenticate with Supervisor PIN.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Terminal & Cashier Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                POS Terminal / Till
              </label>
              <select
                value={registerCode}
                onChange={(e) => setRegisterCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="TERM-01 (Main Counter)">TERM-01 (Main Counter)</option>
                <option value="TERM-02 (Register A)">TERM-02 (Register A)</option>
                <option value="TERM-03 (Service Desk)">TERM-03 (Service Desk)</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Active Cashier
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={cashierCode}
                  onChange={(e) => setCashierCode(e.target.value)}
                  title="Cashier Staff Code"
                  placeholder="Code"
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-blue-400 font-mono text-center focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                Standard Float Policy
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex-1">
                  {formatNpr(standardFloat)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Store Standard</span>
              </div>
            </div>
          </div>

          {/* Handover Check Telemetry Card */}
          {prevShiftClosingCash !== null && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                handoverDiff === 0
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {handoverDiff === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {handoverDiff === 0
                      ? 'Drawer Handover Perfectly Matched'
                      : 'Handover Cash Difference Detected'}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Previous shift (<code>{prevShiftNumber}</code>) closed with{' '}
                    <strong>{formatNpr(prevShiftClosingCash)}</strong> in drawer. Counted now:{' '}
                    <strong>{formatNpr(grandTotal)}</strong>.
                  </div>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-[10px] uppercase tracking-wider opacity-70">Handover Variance</div>
                <div
                  className={`text-sm font-bold ${
                    handoverDiff === 0 ? 'text-emerald-400' : 'text-amber-400'
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
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Opening Notes / Reason for Float Difference (if any)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Standard morning float received from safe vault. All denominations intact."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Maker-Checker: Supervisor Verification PIN
              </div>
              <p className="text-[11px] text-slate-400">
                A store manager or supervisor must confirm the physical cash float count before sales can begin.
              </p>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  maxLength={6}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="Enter Supervisor PIN (e.g. 1234 or 9999)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-blue-500/40 rounded-xl text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="text-xs font-mono text-slate-400">
              Initial Float:{' '}
              <strong className="text-white text-sm">{formatNpr(grandTotal)}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
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
