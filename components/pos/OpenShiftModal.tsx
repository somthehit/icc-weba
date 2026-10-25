'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  ShieldCheck,
  ShieldAlert,
  Coins,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Minus,
  Sparkles,
  Lock,
  Delete,
  Check,
  Circle,
} from 'lucide-react';
import { PosStaffUser } from './CashierAuthModal';

export const NEPALI_DENOMINATIONS = [
  { value: 1000, label: 'NPR 1,000', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
  { value: 500, label: 'NPR 500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { value: 100, label: 'NPR 100', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  { value: 50, label: 'NPR 50', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  { value: 20, label: 'NPR 20', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  { value: 10, label: 'NPR 10', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
  { value: 5, label: 'NPR 5', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' },
  { value: 2, label: 'NPR 2 (Coins)', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-500/10' },
  { value: 1, label: 'NPR 1 (Coins)', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-500/10' },
];

interface OpenShiftModalProps {
  isOpen: boolean;
  registerCode: string;
  cashier: PosStaffUser | null;
  theme?: 'dark' | 'light';
  onClose?: () => void;
  onShiftOpened: (shift: any) => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  isOpen,
  registerCode,
  cashier,
  theme = 'dark',
  onClose,
  onShiftOpened,
}) => {
  // Cash Denominations count state (Individual rows for 2 and 1 coins)
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '1000': 2,
    '500': 4,
    '100': 8,
    '50': 4,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
  });

  // Supervisor auth state
  const [supervisors, setSupervisors] = useState<PosStaffUser[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [openingNote, setOpeningNote] = useState('Morning opening cash float verified');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSupervisorPin('');
      fetchSupervisors();
    }
  }, [isOpen]);

  const fetchSupervisors = async () => {
    try {
      const res = await fetch('/api/pos/auth');
      const data = await res.json();
      if (data.success && data.staff) {
        const sups = data.staff.filter((s: PosStaffUser) => s.isSupervisor);
        setSupervisors(sups);
        if (sups.length > 0) {
          // Default to Admin or Store Manager
          const defaultSup = sups.find((s: PosStaffUser) => s.role === 'admin') || sups[0];
          setSelectedSupervisorId(defaultSup.id);
        }
      }
    } catch (err) {
      console.error('Failed to load supervisors:', err);
    }
  };

  // Calculate live total from denominations
  const totalOpeningFloat = NEPALI_DENOMINATIONS.reduce((sum, denom) => {
    const qty = denominations[denom.value.toString()] || 0;
    return sum + denom.value * qty;
  }, 0);

  const handleQtyChange = (valStr: string, qty: number) => {
    const clamped = Math.max(0, Math.min(999, isNaN(qty) ? 0 : qty));
    setDenominations((prev) => ({
      ...prev,
      [valStr]: clamped,
    }));
  };

  // Keyboard navigation on Enter
  const handleDenomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextElem = document.getElementById(`denom-input-${index + 1}`);
      if (nextElem) {
        (nextElem as HTMLInputElement).focus();
        (nextElem as HTMLInputElement).select();
      } else {
        const pinElem = document.getElementById('supervisor-pin-input');
        if (pinElem) {
          (pinElem as HTMLInputElement).focus();
        }
      }
    }
  };

  // Preset float templates
  const applyPreset = (preset: 'standard5k' | 'standard10k' | 'clear') => {
    if (preset === 'clear') {
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
    } else if (preset === 'standard5k') {
      setDenominations({
        '1000': 2, // 2000
        '500': 4,  // 2000
        '100': 8,  // 800
        '50': 4,   // 200 -> total 5000
        '20': 0,
        '10': 0,
        '5': 0,
        '2': 0,
        '1': 0,
      });
    } else if (preset === 'standard10k') {
      setDenominations({
        '1000': 5,  // 5000
        '500': 6,   // 3000
        '100': 15,  // 1500
        '50': 10,   // 500 -> total 10000
        '20': 0,
        '10': 0,
        '5': 0,
        '2': 0,
        '1': 0,
      });
    }
  };

  // On-screen touch numpad handlers
  const handleNumpadPress = (num: string) => {
    if (supervisorPin.length < 6) {
      setSupervisorPin((prev) => prev + num);
      setErrorMsg('');
    }
  };

  const handleNumpadBackspace = () => {
    setSupervisorPin((prev) => prev.slice(0, -1));
  };

  const handleNumpadClear = () => {
    setSupervisorPin('');
  };

  const handleOpenShift = async () => {
    if (totalOpeningFloat <= 0) {
      setErrorMsg('Please specify a valid cash float breakdown greater than NPR 0.');
      return;
    }

    if (!selectedSupervisorId) {
      setErrorMsg('Please select a Supervisor or Manager to authorize drawer opening.');
      return;
    }

    if (!supervisorPin) {
      setErrorMsg('Admin/Supervisor PIN is required to approve the cash float.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          registerCode,
          cashierId: cashier?.id,
          cashierName: cashier?.name || 'Staff Cashier',
          openingFloat: totalOpeningFloat,
          openingDenominations: denominations,
          supervisorId: selectedSupervisorId,
          supervisorPin: supervisorPin.trim(),
          note: openingNote,
        }),
      });

      const data = await res.json();
      if (data.success && data.shift) {
        onShiftOpened(data.shift);
      } else {
        setErrorMsg(data.error || 'Failed to open shift. Authorization rejected.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error while opening shift.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[94vh] transition-colors ${
          isDark
            ? 'bg-[#121614] border-[#223328] text-slate-100'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            isDark ? 'bg-[#0c100e] border-[#1d2b22]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg border shadow-xs ${
                isDark
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/40'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Step 1: BOD (Beginning of Day)
                </span>
                <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Accountant Handover → Cashier Float
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Open Cash Drawer &amp; Register Shift
              </h2>
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Accountant ले क्यासियरलाई Float क्यास दिन्छ (e.g. NPR 5,000) → क्यासियरले डिनोमिनेसन गनेर सिफ्ट सुरु गर्छ।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Cashier on Duty
              </span>
              <span className={`text-xs font-black ${isDark ? 'text-emerald-400' : 'text-slate-800'}`}>
                {cashier?.name || 'Cashier'}
              </span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isDark
                    ? 'text-slate-400 hover:text-white border-[#223328] hover:bg-[#1a241e]'
                    : 'text-slate-500 hover:text-slate-900 border-slate-200 hover:bg-slate-100'
                }`}
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Denomination Breakdown Form (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-800'
                }`}>
                  <Coins className="w-4 h-4 text-emerald-500" /> Physical Float Denominations (NPR)
                </span>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => applyPreset('standard5k')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      isDark
                        ? 'border-emerald-600/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Preset ₨ 5,000
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('standard10k')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      isDark
                        ? 'border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60'
                        : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Preset ₨ 10,000
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('clear')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      isDark
                        ? 'border-[#2c3d32] text-slate-400 hover:text-white hover:bg-[#1a241e]'
                        : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Denomination Table */}
              <div className={`rounded-xl border overflow-hidden shadow-xs ${
                isDark ? 'border-[#223328] bg-[#0c100e]' : 'border-slate-200 bg-white'
              }`}>
                <div className={`grid grid-cols-12 text-[11px] font-bold uppercase p-2.5 border-b tracking-wider ${
                  isDark ? 'border-[#1d2b22] text-slate-400 bg-[#0e1411]' : 'border-slate-200 text-slate-500 bg-slate-50'
                }`}>
                  <div className="col-span-4">Denomination</div>
                  <div className="col-span-4 text-center">Count / Quantity</div>
                  <div className="col-span-4 text-right">Subtotal (NPR)</div>
                </div>

                <div className={`divide-y ${isDark ? 'divide-[#1a241e]' : 'divide-slate-100'}`}>
                  {NEPALI_DENOMINATIONS.map((d, index) => {
                    const count = denominations[d.value.toString()] || 0;
                    const subtotal = d.value * count;
                    return (
                      <div
                        key={d.value}
                        className={`grid grid-cols-12 items-center p-2 text-xs transition-colors ${
                          isDark ? 'hover:bg-[#121915]' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="col-span-4 flex items-center gap-2">
                          <span className={`font-mono font-bold text-sm ${d.color}`}>{d.label}</span>
                        </div>
                        <div className="col-span-4 flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleQtyChange(d.value.toString(), count - 1)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center border font-bold transition-all active:scale-95 ${
                              isDark
                                ? 'bg-[#18221c] hover:bg-[#223028] text-slate-200 border-[#2e4034]'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            id={`denom-input-${index}`}
                            type="number"
                            min="0"
                            max="999"
                            value={count === 0 ? '' : count}
                            onChange={(e) =>
                              handleQtyChange(d.value.toString(), parseInt(e.target.value) || 0)
                            }
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleDenomKeyDown(e, index)}
                            placeholder="0"
                            className={`w-16 py-1.5 text-center font-mono font-black text-sm rounded-md border transition-all ${
                              isDark
                                ? 'bg-[#080c0a] border-[#2e4034] text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                                : 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600'
                            }`}
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleQtyChange(d.value.toString(), count + 1)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center border font-bold transition-all active:scale-95 ${
                              isDark
                                ? 'bg-[#18221c] hover:bg-[#223028] text-slate-200 border-[#2e4034]'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className={`col-span-4 text-right font-mono font-black text-sm ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}>
                          ₨ {subtotal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Total Floating Counter Banner */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm ${
              isDark
                ? 'bg-[#080d0a] border-emerald-500/60'
                : 'bg-emerald-50 border-emerald-300'
            }`}>
              <span className={`text-xs uppercase font-extrabold tracking-wider ${
                isDark ? 'text-slate-300' : 'text-emerald-900'
              }`}>
                Total Calculated Opening Float:
              </span>
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                isDark ? 'text-emerald-400' : 'text-emerald-700'
              }`}>
                NPR {totalOpeningFloat.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Right Column: Admin / Supervisor PIN Verification (5 Cols) */}
          <div className={`lg:col-span-5 p-4 sm:p-5 rounded-xl border flex flex-col justify-between space-y-4 shadow-xs ${
            isDark
              ? 'bg-[#151c18] border-[#24352a]'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              {/* Header with High-Contrast Text */}
              <div className={`flex items-start gap-2.5 mb-3.5 pb-3 border-b ${
                isDark ? 'border-[#223328]' : 'border-slate-200'
              }`}>
                <div className={`p-1.5 rounded-lg border ${
                  isDark ? 'bg-amber-950/40 border-amber-500/40 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-700'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-xs font-black uppercase tracking-wider ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}>
                    Supervisor / Admin Authorization
                  </h3>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Manager or Admin PIN required to approve cash drawer
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 mb-3.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2 shadow-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Supervisor Account Select with Distinct Active State */}
              <div className="space-y-1.5 mb-4">
                <label className={`text-[11px] font-extrabold uppercase tracking-wide block ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Authorizing Supervisor / Admin:
                </label>
                <div className="space-y-2">
                  {supervisors.map((sup) => {
                    const isSelected = selectedSupervisorId === sup.id;
                    return (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => {
                          setSelectedSupervisorId(sup.id);
                          setErrorMsg('');
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isSelected
                            ? isDark
                              ? 'bg-emerald-950/50 border-emerald-400 ring-2 ring-emerald-500/40 text-white shadow-sm'
                              : 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-950 shadow-sm'
                            : isDark
                              ? 'bg-[#18221c] hover:bg-[#202c24] border-[#2a3c30] text-slate-300'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          )}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : isDark
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {sup.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <div className="font-extrabold">{sup.name}</div>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {sup.email}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border uppercase ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : isDark
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {sup.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Supervisor PIN Input (4-6 Digits) */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-extrabold uppercase tracking-wide block ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Supervisor Security PIN (4-6 digits):
                  </label>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {supervisorPin.length}/6 digits
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="supervisor-pin-input"
                    type="password"
                    maxLength={6}
                    value={supervisorPin}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setSupervisorPin(clean);
                      setErrorMsg('');
                    }}
                    placeholder="••••"
                    autoComplete="off"
                    className={`w-full p-2.5 rounded-xl border text-center text-2xl tracking-[0.5em] font-mono font-black transition-all ${
                      isDark
                        ? 'bg-[#0a0e0c] border-[#2c3d32] text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                    }`}
                  />
                  <Lock className={`w-4 h-4 absolute left-3.5 top-3.5 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                </div>

                {/* Development environment PIN reminder (Strictly hidden in production) */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-500/90 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>Dev Only: Admin: <b>9999</b> • Manager: <b>1234</b></span>
                  </div>
                )}
              </div>

              {/* On-Screen Touch Numpad for POS Touchscreens */}
              <div className="mb-4">
                <div className={`p-2 rounded-xl border ${
                  isDark ? 'bg-[#0d1310] border-[#1f2b23]' : 'bg-slate-100/70 border-slate-200'
                }`}>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleNumpadPress(digit)}
                        className={`h-9 rounded-lg font-mono font-bold text-sm border transition-all active:scale-95 ${
                          isDark
                            ? 'bg-[#18221c] hover:bg-[#233128] text-white border-[#2b3c30] active:bg-emerald-600'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 active:bg-emerald-600 active:text-white shadow-2xs'
                        }`}
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={handleNumpadClear}
                      className={`h-9 rounded-lg font-bold text-xs border uppercase tracking-wider transition-all active:scale-95 ${
                        isDark
                          ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/40'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
                      }`}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleNumpadPress('0')}
                      className={`h-9 rounded-lg font-mono font-bold text-sm border transition-all active:scale-95 ${
                        isDark
                          ? 'bg-[#18221c] hover:bg-[#233128] text-white border-[#2b3c30] active:bg-emerald-600'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 active:bg-emerald-600 active:text-white shadow-2xs'
                      }`}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={handleNumpadBackspace}
                      className={`h-9 rounded-lg flex items-center justify-center border transition-all active:scale-95 ${
                        isDark
                          ? 'bg-[#18221c] hover:bg-[#233128] text-slate-300 border-[#2b3c30]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                      }`}
                      title="Backspace"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Note / Memo */}
              <div className="space-y-1 mb-2">
                <label className={`text-[11px] font-extrabold uppercase tracking-wide block ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Shift Opening Note:
                </label>
                <input
                  type="text"
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  placeholder="e.g. Morning opening float counted and verified"
                  className={`w-full p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    isDark
                      ? 'bg-[#0a0e0c] border-[#2c3d32] text-white focus:outline-none focus:border-emerald-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600'
                  }`}
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className={`pt-3 border-t ${isDark ? 'border-[#223328]' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={handleOpenShift}
                disabled={isLoading || totalOpeningFloat <= 0 || !supervisorPin || supervisorPin.length < 4}
                className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all shadow-md ${
                  isLoading || totalOpeningFloat <= 0 || !supervisorPin || supervisorPin.length < 4
                    ? 'opacity-40 cursor-not-allowed bg-slate-400 text-white border-transparent'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-emerald-600/30'
                }`}
              >
                {isLoading ? (
                  <span>Verifying &amp; Opening Register...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize &amp; Open Shift Register</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
