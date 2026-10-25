'use client';

import React from 'react';
import { Plus, Minus, Banknote, Coins } from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';

export interface DenominationMap {
  '1000': number;
  '500': number;
  '100': number;
  '50': number;
  '20': number;
  '10': number;
  '5': number;
  '2': number;
  '1': number;
  coins: number;
}

export const DEFAULT_DENOMINATIONS: DenominationMap = {
  '1000': 0,
  '500': 0,
  '100': 0,
  '50': 0,
  '20': 0,
  '10': 0,
  '5': 0,
  '2': 0,
  '1': 0,
  coins: 0,
};

export const DENOMINATION_VALUES: { key: keyof DenominationMap; value: number; label: string; isCoin?: boolean }[] = [
  { key: '1000', value: 1000, label: 'NPR 1,000 Note' },
  { key: '500', value: 500, label: 'NPR 500 Note' },
  { key: '100', value: 100, label: 'NPR 100 Note' },
  { key: '50', value: 50, label: 'NPR 50 Note' },
  { key: '20', value: 20, label: 'NPR 20 Note' },
  { key: '10', value: 10, label: 'NPR 10 Note' },
  { key: '5', value: 5, label: 'NPR 5 Note' },
  { key: '2', value: 2, label: 'NPR 2 Note' },
  { key: '1', value: 1, label: 'NPR 1 Note' },
  { key: 'coins', value: 1, label: 'Assorted Coins (NPR 1/2)', isCoin: true },
];

export function calculateDenominationGrandTotal(denoms: Partial<DenominationMap>): number {
  let total = 0;
  for (const item of DENOMINATION_VALUES) {
    const qty = Number(denoms[item.key] || 0);
    total += qty * item.value;
  }
  return total;
}

interface DenominationGridProps {
  values: DenominationMap;
  onChange: (newValues: DenominationMap) => void;
  readOnly?: boolean;
  expectedTotal?: number | null;
  targetFloat?: number;
}

export function DenominationGrid({
  values,
  onChange,
  readOnly = false,
  expectedTotal = null,
  targetFloat,
}: DenominationGridProps) {
  const grandTotal = calculateDenominationGrandTotal(values);
  const diffFromTarget = targetFloat !== undefined ? grandTotal - targetFloat : null;
  const diffFromExpected = expectedTotal !== null ? grandTotal - expectedTotal : null;

  const handleQtyChange = (key: keyof DenominationMap, qty: number) => {
    if (readOnly) return;
    const sanitized = Math.max(0, Math.floor(qty || 0));
    onChange({
      ...values,
      [key]: sanitized,
    });
  };

  const handleIncrement = (key: keyof DenominationMap, step: number = 1) => {
    if (readOnly) return;
    const current = Number(values[key] || 0);
    handleQtyChange(key, current + step);
  };

  const handleDecrement = (key: keyof DenominationMap, step: number = 1) => {
    if (readOnly) return;
    const current = Number(values[key] || 0);
    handleQtyChange(key, Math.max(0, current - step));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.getElementById(`denom-input-${currentIndex + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
      }
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      const prevInput = document.getElementById(`denom-input-${currentIndex - 1}`);
      if (prevInput) {
        (prevInput as HTMLInputElement).focus();
        (prevInput as HTMLInputElement).select();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Running Total & Status Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5 text-emerald-400" />
            Live Physical Cash Count
          </div>
          <div className="text-2xl font-black font-mono text-white tracking-tight mt-0.5">
            {formatNpr(grandTotal)}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {targetFloat !== undefined && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 flex items-center gap-2">
              <span className="text-slate-400">Target Float:</span>
              <strong className="text-white">{formatNpr(targetFloat)}</strong>
              {diffFromTarget !== null && Math.abs(diffFromTarget) > 0.01 && (
                <span
                  className={`font-bold ${
                    diffFromTarget > 0 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  ({diffFromTarget > 0 ? `+${diffFromTarget}` : diffFromTarget})
                </span>
              )}
            </div>
          )}

          {expectedTotal !== null && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 flex items-center gap-2">
              <span className="text-slate-400">Expected:</span>
              <strong className="text-white">{formatNpr(expectedTotal)}</strong>
              {diffFromExpected !== null && (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    Math.abs(diffFromExpected) < 0.01
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : diffFromExpected < 0
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {Math.abs(diffFromExpected) < 0.01
                    ? 'Exact Match'
                    : diffFromExpected < 0
                    ? `Shortage: -NPR ${Math.abs(diffFromExpected).toFixed(2)}`
                    : `Overage: +NPR ${diffFromExpected.toFixed(2)}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid of Denominations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {DENOMINATION_VALUES.map((item, idx) => {
          const qty = Number(values[item.key] || 0);
          const rowSubtotal = qty * item.value;

          return (
            <div
              key={item.key}
              className={`p-3 rounded-2xl border transition-all ${
                qty > 0
                  ? 'bg-slate-900/90 border-blue-500/40 shadow-md shadow-blue-500/5'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      item.isCoin
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                        : item.value >= 500
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {item.isCoin ? <Coins className="w-4 h-4" /> : item.value}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">
                      {item.isCoin ? 'Coins' : `NPR ${item.value}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Subtotal: <strong className="text-emerald-400">{formatNpr(rowSubtotal, { showFraction: false })}</strong>
                    </span>
                  </div>
                </div>

                {/* Counter Stepper / Direct Input */}
                <div className="flex items-center gap-1">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDecrement(item.key)}
                      disabled={qty <= 0}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all border border-slate-700 active:scale-95"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <input
                    id={`denom-input-${idx}`}
                    type="number"
                    min="0"
                    step="1"
                    readOnly={readOnly}
                    value={qty === 0 && !readOnly ? '' : qty}
                    placeholder="0"
                    onChange={(e) => handleQtyChange(item.key, parseInt(e.target.value, 10) || 0)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    className="w-16 h-8 text-center bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleIncrement(item.key)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all border border-slate-700 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
