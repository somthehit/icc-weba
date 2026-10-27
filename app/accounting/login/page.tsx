'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calculator,
  ShieldCheck,
  Lock,
  KeyRound,
  Users,
  Building2,
  ChevronRight,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Delete,
  Sparkles,
  FileCheck2,
  Landmark,
  Scale,
  Clock,
  RefreshCw,
  HelpCircle,
  Laptop,
  Receipt,
  Store,
} from 'lucide-react';
import { adToBs, formatDualDate } from '@/lib/nepal/date';

interface AccountingStaff {
  id: string;
  name: string;
  staffCode: string;
  email: string | null;
  phone: string | null;
  role: string;
  roleTitle: string;
  hasPin: boolean;
  isLocked: boolean;
}

export default function AccountingLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/accounting';

  // State
  const [staffList, setStaffList] = useState<AccountingStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<AccountingStaff | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  // Form State
  const [identifier, setIdentifier] = useState('');
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI Status
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingStaff, setIsFetchingStaff] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [nepaliDateStr, setNepaliDateStr] = useState<string>('');

  // Clock & Nepal Date
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
      try {
        const bs = adToBs(now);
        setNepaliDateStr(`${bs.formattedLongBS} (${formatDualDate(now.toISOString().slice(0, 10))})`);
      } catch {
        setNepaliDateStr(now.toLocaleDateString('en-US', { dateStyle: 'full' }));
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Accounting Staff Directory
  useEffect(() => {
    loadStaffDirectory();
  }, []);

  const loadStaffDirectory = async () => {
    setIsFetchingStaff(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/accounting-login');
      const data = await res.json();
      if (data.success && Array.isArray(data.staff)) {
        setStaffList(data.staff);
        // Default select the accountant or first admin if available
        const defaultStaff =
          data.staff.find((s: AccountingStaff) => s.role === 'accountant') ||
          data.staff.find((s: AccountingStaff) => s.role === 'admin') ||
          data.staff[0];
        if (defaultStaff) {
          setSelectedStaff(defaultStaff);
          setIdentifier(defaultStaff.staffCode);
        }
      }
    } catch (err: any) {
      console.warn('Could not load accounting staff roster:', err);
    } finally {
      setIsFetchingStaff(false);
    }
  };

  // Keyboard Numpad Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (authMode !== 'pin' || isLoading) return;

      // Only listen when typing in non-input targets or general document
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        if (pin.length < 6) {
          setPin((prev) => prev + e.key);
          setErrorMessage('');
        }
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && pin.length >= 4) {
        handleLogin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authMode, pin, isLoading, selectedStaff, identifier]);

  const handleNumpadPress = (digit: string) => {
    if (digit === 'BACK') {
      setPin((prev) => prev.slice(0, -1));
    } else if (digit === 'CLEAR') {
      setPin('');
    } else {
      if (pin.length < 6) {
        setPin((prev) => prev + digit);
        setErrorMessage('');
      }
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const targetIdentifier = isManualMode ? identifier.trim() : selectedStaff?.staffCode || identifier.trim();

    if (!targetIdentifier) {
      setErrorMessage('Please select an accounting profile or enter a staff code / email.');
      return;
    }

    if (authMode === 'pin' && pin.length < 4) {
      setErrorMessage('Please enter your 4 to 6 digit accounting PIN.');
      return;
    }

    if (authMode === 'password' && !password.trim()) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/accounting-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: targetIdentifier,
          staffId: isManualMode ? undefined : selectedStaff?.id,
          authType: authMode,
          pin: authMode === 'pin' ? pin : undefined,
          password: authMode === 'password' ? password : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please verify your credentials.');
      }

      setSuccessMessage(data.message || 'Access granted. Opening Central Accounting Hub...');

      // Redirect smoothly to accounting dashboard
      setTimeout(() => {
        router.push(redirectTarget);
        router.refresh();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 relative overflow-x-hidden">
      {/* Background Glows & Architectural Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Enterprise Navigation Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Portal Badge */}
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Calculator className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight text-white">INTEL COMPUTER CENTER</span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md">
                  Accounting Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <Building2 className="h-3 w-3 text-slate-500" />
                Central Financial Books & Double-Entry Ledger System
              </p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-3">
            {/* Live Clock & Nepal Date */}
            <div className="hidden sm:flex flex-col items-end text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-mono font-bold">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span>{currentTime || '00:00:00 NPT'}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{nepaliDateStr || 'Nepal Fiscal Calendar'}</span>
            </div>

            {/* Quick Link to POS or Storefront */}
            <div className="flex items-center gap-2">
              <Link
                href="/pos"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-800/70 hover:bg-slate-800 hover:text-white border border-slate-700/60 rounded-lg transition"
              >
                <Store className="h-3.5 w-3.5 text-emerald-400" />
                <span>POS Till</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
              >
                <span>Storefront</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split Portal */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* ========================================================= */}
          {/* LEFT COLUMN: Authorized Financial Personnel Directory (7 cols) */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-800/90 bg-slate-900/70 backdrop-blur-2xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400 mb-1">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Statutory Access Control</span>
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">Financial & Administrative Officers</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Select your official profile for high-security double-entry books, VAT records, and Z-report audits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadStaffDirectory}
                  disabled={isFetchingStaff}
                  title="Refresh staff directory"
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingStaff ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Staff Cards List */}
              <div className="space-y-3">
                {isFetchingStaff ? (
                  <div className="py-16 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-400">Loading authorized accounting personnel...</p>
                  </div>
                ) : staffList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {staffList.map((s) => {
                      const isSelected = !isManualMode && selectedStaff?.id === s.id;
                      const isAccountant = s.role === 'accountant';
                      const isAdmin = s.role === 'admin';

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setIsManualMode(false);
                            setSelectedStaff(s);
                            setIdentifier(s.staffCode);
                            setPin('');
                            setPassword('');
                            setErrorMessage('');
                          }}
                          className={`relative flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all group ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                              : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950/80'
                          }`}
                        >
                          {/* Role Icon Avatar */}
                          <div
                            className={`h-11 w-11 rounded-xl shrink-0 flex items-center justify-center font-black text-sm border ${
                              isAccountant
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : isAdmin
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            }`}
                          >
                            {isAccountant ? (
                              <Calculator className="h-5 w-5" />
                            ) : isAdmin ? (
                              <Landmark className="h-5 w-5" />
                            ) : (
                              <Scale className="h-5 w-5" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-bold text-sm text-white truncate group-hover:text-emerald-300 transition">
                                {s.name}
                              </h3>
                              <span className="font-mono text-[10px] font-black text-slate-400 shrink-0">
                                {s.staffCode}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{s.roleTitle}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide ${
                                  isAccountant
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : isAdmin
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {s.role}
                              </span>
                              {s.hasPin && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                                  <KeyRound className="h-2.5 w-2.5" /> PIN Enrolled
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Selected Checkmark */}
                          {isSelected && (
                            <div className="absolute top-3 right-3 text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl p-6">
                    No dedicated staff profiles found. You may use direct Manual Sign-In below.
                  </div>
                )}

                {/* Manual Credentials Switch Option */}
                <button
                  type="button"
                  onClick={() => {
                    setIsManualMode(true);
                    setSelectedStaff(null);
                    setIdentifier('');
                    setPin('');
                    setPassword('');
                    setErrorMessage('');
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border border-dashed text-left transition-all ${
                    isManualMode
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Manual Sign-In (Direct Email or Staff Code)</h4>
                      <p className="text-[11px] text-slate-400">
                        Sign in via custom work email address or executive credentials.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-400 ${isManualMode ? 'text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Bottom Compliance Callout */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-emerald-400" />
                <span>Nepal IRD Computerized Billing Annex-10 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-slate-300">SHA-256 Tamper-Evident Ledger</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Authentication Console (5 cols) */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-slate-800/90 bg-slate-900/80 backdrop-blur-2xl p-6 lg:p-8 shadow-2xl">
            <form onSubmit={handleLogin} className="flex-1 flex flex-col justify-between">
              <div>
                {/* Active Selection Display */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        {isManualMode ? 'Direct Entry' : 'Authenticating As'}
                      </h2>
                      <p className="text-sm font-black text-white truncate max-w-[200px]">
                        {isManualMode ? 'Manual Officer Sign-In' : selectedStaff?.name || 'Select an Officer'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-800 text-emerald-300 border border-slate-700">
                    {isManualMode ? 'DIRECT' : selectedStaff?.role || 'FINANCE'}
                  </span>
                </div>

                {/* Manual Code Input (when in manual mode) */}
                {isManualMode && (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                      Staff Code or Work Email
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="e.g. ACC01, ADM01 or accountant@icc.com.np"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none transition shadow-inner"
                    />
                  </div>
                )}

                {/* Auth Mode Toggle (PIN vs Password) */}
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800/80 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('pin');
                      setErrorMessage('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
                      authMode === 'pin'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Quick PIN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('password');
                      setErrorMessage('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
                      authMode === 'password'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Password</span>
                  </button>
                </div>

                {/* Feedback Alerts */}
                {errorMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* ========================================= */}
                {/* MODE 1: QUICK PIN AUTHENTICATION (Numpad) */}
                {/* ========================================= */}
                {authMode === 'pin' && (
                  <div>
                    {/* Visual Dots */}
                    <div className="flex items-center justify-center gap-3 py-3 mb-4 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-inner">
                      {[0, 1, 2, 3, 4, 5].map((idx) => (
                        <div
                          key={idx}
                          className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                            idx < pin.length
                              ? 'bg-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                              : 'bg-slate-800 border border-slate-700/60'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACK'].map((val) => {
                        const isSpecial = val === 'CLEAR' || val === 'BACK';
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleNumpadPress(val)}
                            className={`h-12 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 ${
                              isSpecial
                                ? 'bg-slate-800 text-xs text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                                : 'bg-slate-950 text-lg text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700 shadow-sm active:bg-emerald-500 active:text-slate-950'
                            }`}
                          >
                            {val === 'BACK' ? <Delete className="h-4 w-4" /> : val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ========================================= */}
                {/* MODE 2: PASSWORD AUTHENTICATION */}
                {/* ========================================= */}
                {authMode === 'password' && (
                  <div className="space-y-4 py-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                        Workstation Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setErrorMessage('');
                          }}
                          placeholder="••••••••••••"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3.5 pr-11 text-sm font-bold text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none transition shadow-inner"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 space-y-1 font-medium">
                      <p className="flex items-center gap-1.5 text-slate-300 font-bold">
                        <Sparkles className="h-3 w-3 text-emerald-400" /> Demo Quick Access:
                      </p>
                      <p>• Accountant: <span className="font-mono text-emerald-300">ACC01</span> (PIN: <span className="font-mono text-emerald-300">1111</span>)</p>
                      <p>• Administrator: <span className="font-mono text-purple-300">ADM01</span> (PIN: <span className="font-mono text-purple-300">1111</span> or <span className="font-mono text-purple-300">1234</span>)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit CTA Button */}
              <div className="pt-6 border-t border-slate-800/80 mt-6">
                <button
                  type="submit"
                  disabled={isLoading || (authMode === 'pin' && pin.length < 4) || (authMode === 'password' && !password.trim())}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Unlock Accounting Hub</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-500 mt-3 font-medium">
                  Protected session with automated 12-hour audit expiration.
                </p>
              </div>
            </form>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500">
        Intel Computer Center ERP • Fiscal Management System v2.6 • Kathmandu, Nepal
      </footer>
    </div>
  );
}
