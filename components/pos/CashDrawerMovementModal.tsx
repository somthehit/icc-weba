'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';

interface CashDrawerMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: number;
  shiftNumber: string;
  onMovementRecorded: () => void;
}

export function CashDrawerMovementModal({
  isOpen,
  onClose,
  shiftId,
  shiftNumber,
  onMovementRecorded,
}: CashDrawerMovementModalProps) {
  const [movementType, setMovementType] = useState<'SAFE_DROP' | 'PAID_IN' | 'PAID_OUT' | 'PETTY_CASH'>('SAFE_DROP');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid cash amount greater than NPR 0.');
      return;
    }

    if (!reason.trim()) {
      setError('A written reason or voucher description is strictly required.');
      return;
    }

    if (!supervisorPin.trim()) {
      setError('Supervisor authorization PIN is required for cash drawer movements.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/accounting/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CASH_MOVEMENT',
          shiftId,
          movementType,
          movementAmount: numAmount,
          movementReason: reason.trim(),
          supervisorPin: supervisorPin.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record cash movement');
      }

      onMovementRecorded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record cash movement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900">
        {/* Header with protected dark-surface */}
        <div className="dark-surface px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold shadow-sm">
              <Banknote className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-black !text-white tracking-tight">
                Cash Drawer Movement
              </h2>
              <p className="text-xs !text-slate-400 font-mono mt-0.5">
                Shift: <code className="text-blue-300 font-bold bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-500/40">{shiftNumber}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 !text-slate-300 hover:!text-white transition-all border border-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Movement Type Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">Operation Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'SAFE_DROP', label: 'Safe Drop', desc: 'Transfer to Vault', icon: ArrowUpRight, activeClass: 'border-purple-500 bg-purple-50/80 text-purple-900 ring-2 ring-purple-500/20', iconColor: 'text-purple-600' },
                { type: 'PAID_IN', label: 'Paid-In', desc: 'Add to Till', icon: ArrowDownLeft, activeClass: 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20', iconColor: 'text-emerald-600' },
                { type: 'PAID_OUT', label: 'Paid-Out', desc: 'Till Expense', icon: ArrowUpRight, activeClass: 'border-rose-500 bg-rose-50/80 text-rose-900 ring-2 ring-rose-500/20', iconColor: 'text-rose-600' },
                { type: 'PETTY_CASH', label: 'Petty Cash', desc: 'Store Supplies', icon: Banknote, activeClass: 'border-amber-500 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20', iconColor: 'text-amber-600' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setMovementType(item.type as any)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    movementType === item.type
                      ? `${item.activeClass} shadow-xs font-black`
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${item.iconColor} mb-1.5`} />
                  <div className="text-xs font-black leading-tight text-slate-900">{item.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight font-medium">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">Cash Amount (NPR)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-sm">
                NPR
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full pl-14 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-base text-slate-900 font-mono font-black placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Reason / Voucher details */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600">Reason & Expense Voucher Details</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Excess cash drop to main safe (till limit exceeded) or Store water supplies voucher"
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs font-medium"
            />
          </div>

          {/* Supervisor PIN */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Supervisor Authorization PIN
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                maxLength={6}
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                placeholder="Enter Supervisor PIN (e.g. 1234 or 9999)"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-300 rounded-xl text-xs text-slate-900 font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50 transition active:scale-[0.99] cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Record Movement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
