'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  UserCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Users,
  Store,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Delete,
  ArrowRight,
  Laptop,
  Clock,
  Sparkles,
  Settings,
  RefreshCw,
} from 'lucide-react';

interface PosStaff {
  id: string;
  name: string;
  staffCode: string;
  email: string | null;
  phone: string | null;
  role: 'cashier' | 'supervisor' | 'manager' | 'admin';
  isSupervisor: boolean;
  hasPin: boolean;
  isLocked: boolean;
  roleLabel: string;
}

interface PosTerminal {
  id: string;
  code: string;
  name: string;
  branchId: string;
}

export default function PosLoginPage() {
  const router = useRouter();

  // State
  const [staffList, setStaffList] = useState<PosStaff[]>([]);
  const [terminalsList, setTerminalsList] = useState<PosTerminal[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('REG-01');
  const [selectedStaff, setSelectedStaff] = useState<PosStaff | null>(null);

  // Form State
  const [manualCode, setManualCode] = useState('');
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [canFallbackPassword, setCanFallbackPassword] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Staff & Terminals
  useEffect(() => {
    loadStaffAndTerminals();
  }, []);

  const loadStaffAndTerminals = async () => {
    setIsFetching(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/pos/auth');
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff || []);
        if (data.terminals && data.terminals.length > 0) {
          setTerminalsList(data.terminals);
          setSelectedTerminal(data.terminals[0].code);
        }

        // Auto-select first cashier if available
        if (data.staff && data.staff.length > 0) {
          const defaultUser =
            data.staff.find((s: PosStaff) => s.role === 'cashier') || data.staff[0];
          setSelectedStaff(defaultUser);
        }
      } else {
        setErrorMessage(data.error || 'Failed to load POS staff.');
      }
    } catch (err: any) {
      setErrorMessage('Unable to connect to POS server.');
    } finally {
      setIsFetching(false);
    }
  };

  // Numpad key press handler
  const handleNumpad = (key: string) => {
    setErrorMessage('');
    if (key === 'CLR') {
      if (authMode === 'pin') setPin('');
      else setPassword('');
      return;
    }

    if (key === 'BACK') {
      if (authMode === 'pin') setPin((prev) => prev.slice(0, -1));
      else setPassword((prev) => prev.slice(0, -1));
      return;
    }

    if (authMode === 'pin') {
      if (pin.length < 6) {
        const nextPin = pin + key;
        setPin(nextPin);
        // Auto-submit on 4 or 6 digits if desired, or let user hit Enter
        if (nextPin.length === 4 && selectedStaff?.role === 'cashier') {
          // Do not auto-submit immediately so user can review or type 5-6 digits, but Enter button is prominent
        }
      }
    } else {
      setPassword((prev) => prev + key);
    }
  };

  // Handle Login submission
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const targetCode = selectedStaff ? selectedStaff.staffCode : manualCode.trim();
    if (!targetCode) {
      setErrorMessage('Please select a staff member or enter your Staff Code.');
      return;
    }

    if (authMode === 'pin' && (!pin || pin.length < 4)) {
      setErrorMessage('Please enter your 4 to 6 digit quick PIN.');
      return;
    }

    if (authMode === 'password' && !password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        action: 'login',
        staffCode: targetCode,
        terminalCode: selectedTerminal,
      };

      if (authMode === 'pin') {
        payload.pin = pin;
      } else {
        payload.password = password;
      }

      const res = await fetch('/api/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.user) {
        // Successful login!
        // Save terminal & user context in localStorage for fast offline/client resume
        localStorage.setItem('icc_pos_cashier', JSON.stringify(data.user));
        localStorage.setItem('icc_pos_terminal', selectedTerminal);

        // Redirect to POS terminal
        router.push('/pos');
      } else {
        setErrorMessage(data.error || 'Authentication failed. Please check credentials.');
        if (data.canFallbackToPassword) {
          setCanFallbackPassword(true);
        }
      }
    } catch (err: any) {
      setErrorMessage('Failed to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 font-black text-slate-950 shadow-lg shadow-emerald-500/20">
            ICC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">
                INTEL COMPUTER CENTER
              </h1>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                POS TERMINAL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Putalisadak, Kathmandu · Main Store Register
            </p>
          </div>
        </div>

        {/* Center / Right info */}
        <div className="flex items-center gap-6">
          {/* Terminal Picker */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs">
            <Laptop className="h-4 w-4 text-emerald-400" />
            <span className="font-medium text-slate-400">Register:</span>
            <select
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
              className="bg-transparent font-bold text-white outline-none"
            >
              {terminalsList.length > 0 ? (
                terminalsList.map((t) => (
                  <option key={t.code} value={t.code} className="bg-slate-900 text-white">
                    {t.name} ({t.code})
                  </option>
                ))
              ) : (
                <option value="REG-01" className="bg-slate-900 text-white">
                  Counter 1 - Main Till (REG-01)
                </option>
              )}
            </select>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-300">
            <Clock className="h-4 w-4 text-cyan-400" />
            {currentTime || '00:00:00'}
          </div>

          {/* Admin link */}
          <a
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" /> Admin Console
          </a>
        </div>
      </header>

      {/* Main Split Interface */}
      <main className="flex flex-1 flex-col items-center justify-center p-4 lg:p-8">
        <div className="grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl lg:grid-cols-12">
          
          {/* Left Column: Staff Cards & Fast Selector (7 cols) */}
          <div className="border-b border-slate-800 p-6 lg:col-span-7 lg:border-b-0 lg:border-r lg:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Select Cashier or Supervisor
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Staff Identification
                </h2>
              </div>
              <button
                onClick={loadStaffAndTerminals}
                title="Refresh staff list"
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Tap your name card below to instantly enter your PIN on the terminal keypad, or switch to manual Staff Code entry.
            </p>

            {/* Staff Grid */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {staffList.map((s) => {
                const isSelected = selectedStaff?.id === s.id;
                const isSupervisor = s.role === 'admin' || s.role === 'manager' || s.role === 'supervisor';

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStaff(s);
                      setErrorMessage('');
                      setPin('');
                      setPassword('');
                    }}
                    className={`relative flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950/90'
                    }`}
                  >
                    {/* Avatar Icon */}
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold ${
                        isSupervisor
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isSupervisor ? (
                        <ShieldCheck className="h-6 w-6" />
                      ) : (
                        <UserCheck className="h-6 w-6" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {s.staffCode}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            s.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300'
                              : s.role === 'manager'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {s.role}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate font-bold text-white">
                        {s.name}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                        {s.hasPin ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <KeyRound className="h-3 w-3" /> PIN Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400">
                            <Lock className="h-3 w-3" /> Password Only
                          </span>
                        )}
                        {s.isLocked && (
                          <span className="rounded bg-red-500/20 px-1 py-0.2 text-[9px] font-bold text-red-400">
                            LOCKED
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                    )}
                  </button>
                );
              })}

              {/* Manual Staff Code Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStaff(null);
                  setErrorMessage('');
                  setPin('');
                  setPassword('');
                }}
                className={`flex items-start gap-3.5 rounded-2xl border border-dashed p-4 text-left transition-all ${
                  selectedStaff === null
                    ? 'border-emerald-500/80 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Other / Direct Entry
                  </span>
                  <h3 className="mt-1 font-bold text-white">
                    Manual Staff ID
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Type code & password directly
                  </p>
                </div>
              </button>
            </div>

            {/* Quick Helper Tips */}
            <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-white">POS Security & Permissions:</p>
                  <p className="mt-0.5 text-slate-400">
                    • Cashiers can conduct sales, scan barcodes, and handle cash/card receipts.
                  </p>
                  <p className="text-slate-400">
                    • Opening floats, price overrides, voiding receipts, and EOD reconciliation require a Supervisor or Admin PIN.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Keypad & Authentication Input (5 cols) */}
          <div className="flex flex-col justify-between bg-slate-950/70 p-6 lg:col-span-5 lg:p-8">
            <div>
              {/* Target Staff Summary */}
              {selectedStaff ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Signing in as:
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-black text-white">
                        {selectedStaff.name}
                      </h4>
                      <p className="font-mono text-xs text-emerald-400">
                        {selectedStaff.staffCode} · {selectedStaff.roleLabel}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        selectedStaff.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300'
                          : selectedStaff.role === 'manager'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {selectedStaff.role}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Staff Code / Email Address
                  </label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. CSH01 or admin@icecomputers.com.np"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Mode Toggle: Fast PIN vs Master Password */}
              <div className="mt-4 flex rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('pin');
                    setErrorMessage('');
                  }}
                  className={`flex-1 rounded-lg py-2 transition ${
                    authMode === 'pin'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="mr-1.5 inline h-3.5 w-3.5" />
                  Quick PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('password');
                    setErrorMessage('');
                  }}
                  className={`flex-1 rounded-lg py-2 transition ${
                    authMode === 'password'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="mr-1.5 inline h-3.5 w-3.5" />
                  Password
                </button>
              </div>

              {/* Input Display */}
              <div className="mt-4">
                {authMode === 'pin' ? (
                  <div>
                    <label className="text-xs font-bold text-slate-400">
                      Enter 4-6 Digit Security PIN:
                    </label>
                    <div className="mt-1.5 flex h-14 items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 font-mono text-2xl tracking-[0.4em] text-emerald-400">
                      {pin ? (
                        <span>{'•'.repeat(pin.length)}</span>
                      ) : (
                        <span className="text-sm tracking-normal text-slate-600">
                          ••••
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-400">
                      Account Password:
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">{errorMessage}</p>
                    {canFallbackPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('password');
                          setErrorMessage('');
                        }}
                        className="mt-1 font-bold text-cyan-400 underline"
                      >
                        Use Master Password instead
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Virtual Touch Numpad */}
              {authMode === 'pin' && (
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'BACK'].map((val) => {
                    const isSpecial = val === 'CLR' || val === 'BACK';
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleNumpad(val)}
                        className={`flex h-12 items-center justify-center rounded-xl text-lg font-bold transition active:scale-95 ${
                          isSpecial
                            ? 'border border-slate-800 bg-slate-900 text-xs font-black text-slate-400 hover:bg-slate-800 hover:text-white'
                            : 'border border-slate-800 bg-slate-900 text-white shadow hover:border-slate-700 hover:bg-slate-800/80 active:bg-emerald-500 active:text-slate-950'
                        }`}
                      >
                        {val === 'BACK' ? <Delete className="h-5 w-5" /> : val}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="mt-6">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleLogin()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>SIGN IN TO REGISTER</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 text-center text-xs text-slate-500">
        <p>
          ICC Retail POS v2.6 · Encrypted Argon2id Bi-directional Lockout Protection · Multi-register Sync
        </p>
      </footer>
    </div>
  );
}
