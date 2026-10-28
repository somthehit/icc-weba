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
        <div className="dark-surface px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold shadow-sm shrink-0">
              <Banknote className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-black !text-white tracking-tight">
                Cash Drawer Movement
              </h2>
              <p className="text-xs !text-slate-300 font-mono mt-0.5">
                Shift: <code className="text-blue-300 font-bold bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-500/40">{shiftNumber}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="dark-surface-btn dark-surface-btn-danger p-2 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow"
            title="Close modal"
          >
            <X className="w-4 h-4" />
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
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">Operation Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { type: 'SAFE_DROP', label: 'Safe Drop', desc: 'Transfer to Vault', icon: ArrowUpRight, activeClass: 'border-purple-600 bg-purple-50/90 text-purple-900 ring-2 ring-purple-500/30 shadow-sm', iconColor: 'text-purple-600', badgeColor: 'bg-purple-100 text-purple-800' },
                { type: 'PAID_IN', label: 'Paid-In', desc: 'Add to Till', icon: ArrowDownLeft, activeClass: 'border-emerald-600 bg-emerald-50/90 text-emerald-900 ring-2 ring-emerald-500/30 shadow-sm', iconColor: 'text-emerald-600', badgeColor: 'bg-emerald-100 text-emerald-800' },
                { type: 'PAID_OUT', label: 'Paid-Out', desc: 'Till Expense', icon: ArrowUpRight, activeClass: 'border-rose-600 bg-rose-50/90 text-rose-900 ring-2 ring-rose-500/30 shadow-sm', iconColor: 'text-rose-600', badgeColor: 'bg-rose-100 text-rose-800' },
                { type: 'PETTY_CASH', label: 'Petty Cash', desc: 'Store Supplies', icon: Banknote, activeClass: 'border-amber-600 bg-amber-50/90 text-amber-900 ring-2 ring-amber-500/30 shadow-sm', iconColor: 'text-amber-600', badgeColor: 'bg-amber-100 text-amber-800' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setMovementType(item.type as any)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    movementType === item.type
                      ? `${item.activeClass} font-black`
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                    {movementType === item.type && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <div className="text-xs font-black leading-tight text-slate-900">{item.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight font-medium">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount input with Quick Amount Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">Cash Amount (NPR)</label>
              {amount && Number(amount) > 0 && (
                <span className="text-xs font-mono font-bold text-blue-600">
                  Total: NPR {Number(amount).toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-500 text-sm">
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

            {/* Quick Amount Preset Chips */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10px] font-mono text-slate-400 uppercase mr-1">Quick Add:</span>
              {[500, 1000, 2000, 5000, 10000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const current = Number(amount) || 0;
                    setAmount(String(current + preset));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 font-mono font-bold text-[11px] border border-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  +{preset.toLocaleString('en-IN')}
                </button>
              ))}
              {amount && Number(amount) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-mono font-bold text-[11px] border border-rose-200 transition-all cursor-pointer ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Reason / Voucher details */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">Reason & Expense Voucher Details</label>
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
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
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
