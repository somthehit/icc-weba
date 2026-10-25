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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Cash Drawer Movement
              </h2>
              <p className="text-xs text-slate-400">
                Shift: <code className="text-blue-400">{shiftNumber}</code>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Movement Type Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Operation Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'SAFE_DROP', label: 'Safe Drop', desc: 'Transfer to Vault', icon: ArrowUpRight, color: 'text-purple-400' },
                { type: 'PAID_IN', label: 'Paid-In', desc: 'Add to Till', icon: ArrowDownLeft, color: 'text-emerald-400' },
                { type: 'PAID_OUT', label: 'Paid-Out', desc: 'Till Expense', icon: ArrowUpRight, color: 'text-rose-400' },
                { type: 'PETTY_CASH', label: 'Petty Cash', desc: 'Store Supplies', icon: Banknote, color: 'text-amber-400' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setMovementType(item.type as any)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    movementType === item.type
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${item.color} mb-1`} />
                  <div className="text-xs font-bold leading-tight">{item.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Cash Amount (NPR)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500 text-sm">
                NPR
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full pl-14 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-base text-white font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Reason / Voucher details */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Reason & Expense Voucher Details</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Excess cash drop to main safe (till limit exceeded) or Store water supplies voucher"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Supervisor PIN */}
          <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Supervisor Authorization PIN
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                maxLength={6}
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                placeholder="Enter Supervisor PIN (e.g. 1234 or 9999)"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-blue-500/40 rounded-xl text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50"
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
