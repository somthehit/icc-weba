'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Users,
  LogOut,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

export interface PosStaffUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  isSupervisor: boolean;
  roleLabel: string;
}

interface CashierAuthModalProps {
  isOpen: boolean;
  isLockedOnly?: boolean; // If true, only locks the screen for current cashier, requiring PIN to unlock
  currentCashier: PosStaffUser | null;
  theme?: 'dark' | 'light';
  onLoginSuccess: (user: PosStaffUser) => void;
  onUnlockSuccess: () => void;
  onLogout?: () => void;
  onClose?: () => void;
}

export const CashierAuthModal: React.FC<CashierAuthModalProps> = ({
  isOpen,
  isLockedOnly = false,
  currentCashier,
  theme = 'dark',
  onLoginSuccess,
  onUnlockSuccess,
  onLogout,
  onClose,
}) => {
  const [staffList, setStaffList] = useState<PosStaffUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<PosStaffUser | null>(currentCashier);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [usePasswordMode, setUsePasswordMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch staff list
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setPin('');
      setPassword('');
      fetchStaff();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentCashier) {
      setSelectedStaff(currentCashier);
    }
  }, [currentCashier]);

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/pos/auth');
      const data = await res.json();
      if (data.success && data.staff) {
        setStaffList(data.staff);
        if (!selectedStaff && data.staff.length > 0) {
          // If we had a current cashier, match them, else pick the first sales/admin staff
          const match = currentCashier
            ? data.staff.find((s: PosStaffUser) => s.id === currentCashier.id)
            : data.staff.find((s: PosStaffUser) => s.role === 'sales' || s.role === 'admin') || data.staff[0];
          setSelectedStaff(match || data.staff[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load POS staff:', err);
    }
  };

  if (!isOpen) return null;

  const handleNumpadPress = (digit: string) => {
    setErrorMsg('');
    if (digit === 'CLR') {
      setPin('');
    } else if (digit === 'DEL') {
      setPin((prev) => prev.slice(0, -1));
    } else if (digit === 'OK') {
      handleSubmit();
    } else {
      if (pin.length < 6) {
        const newPin = pin + digit;
        setPin(newPin);
        // Auto submit if reached 4 digits in quick PIN entry mode
        if (newPin.length === 4 && !usePasswordMode) {
          setTimeout(() => triggerLogin(newPin), 80);
        }
      }
    }
  };

  const triggerLogin = async (pinToVerify: string) => {
    if (!selectedStaff) {
      setErrorMsg('Please select a staff member first.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          userId: selectedStaff.id,
          pin: pinToVerify,
          password: usePasswordMode ? password : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        if (isLockedOnly) {
          onUnlockSuccess();
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setErrorMsg(data.error || 'Authentication failed. Please verify your PIN.');
        setPin('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error during authentication.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    triggerLogin(pin);
  };

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`w-full max-w-2xl border-2 shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#181d1b] border-[#82d8a9] text-[#dfe4e0]'
            : 'bg-white border-[#006b45] text-slate-900 shadow-emerald-950/20'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isDark ? 'bg-[#0a0f0d] border-[#262b29]' : 'bg-[#f8fafc] border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 flex items-center justify-center font-bold text-lg border ${
                isDark ? 'bg-[#1c211e] text-[#82d8a9] border-[#82d8a9]/40' : 'bg-emerald-100 text-[#006b45] border-[#006b45]/30'
              }`}
            >
              {isLockedOnly ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isLockedOnly ? 'Terminal Locked — Quick Cashier Unlock' : 'ICE POS — Cashier Staff Login'}
              </h2>
              <p className={`text-xs ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                {isLockedOnly
                  ? 'Enter 4-digit PIN to resume active checkout session'
                  : 'Select your staff profile and enter your 4-digit POS PIN to begin'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                isDark ? 'bg-[#1c211e] text-[#ffb95f] border-[#ffb95f]/30' : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}
            >
              TERM-02 (Register A)
            </span>
            <a
              href="/pos/login"
              className={`px-2 py-1 text-[11px] font-bold flex items-center gap-1 border ${
                isDark
                  ? 'border-[#262b29] bg-[#181d1b] text-slate-300 hover:text-white hover:bg-[#262b29]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              title="Open Dedicated Full Screen POS Login Page"
            >
              <ExternalLink className="w-3 h-3 text-emerald-400" />
              Full Login
            </a>
            {isLockedOnly && onLogout && (
              <button
                onClick={onLogout}
                className="px-2.5 py-1 text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 border border-rose-500/40 hover:bg-rose-500/10"
                title="Switch cashier account"
              >
                <LogOut className="w-3.5 h-3.5" />
                Switch Cashier
              </button>
            )}
          </div>
        </div>

        {/* Content Body: Two Columns (Staff Selector & Numpad) */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
          {/* Left: Staff Selector (hidden or condensed if lockedOnly) */}
          <div
            className={`md:col-span-5 p-4 border-r flex flex-col justify-between ${
              isDark ? 'border-[#262b29] bg-[#141816]' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  {isLockedOnly ? 'Locked For Cashier' : 'Select Cashier Account'}
                </span>
                <Users className="w-3.5 h-3.5 text-[#82d8a9]" />
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {(isLockedOnly && currentCashier ? [currentCashier] : staffList).map((staff) => {
                  const isSelected = selectedStaff?.id === staff.id;
                  return (
                    <button
                      key={staff.id}
                      disabled={isLockedOnly}
                      onClick={() => {
                        setSelectedStaff(staff);
                        setPin('');
                        setErrorMsg('');
                      }}
                      className={`w-full p-2.5 text-left border flex items-center gap-3 transition-all ${
                        isSelected
                          ? isDark
                            ? 'bg-[#006b45]/30 border-[#82d8a9] text-white shadow-sm'
                            : 'bg-emerald-50 border-[#006b45] text-slate-900 shadow-sm'
                          : isDark
                          ? 'bg-[#1c211e] hover:bg-[#262b29] border-[#262b29] text-[#bec9c0]'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase border shrink-0 ${
                          staff.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : staff.role === 'sales'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        }`}
                      >
                        {staff.name.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs truncate">{staff.name}</span>
                          {staff.isSupervisor && (
                            <span className="text-[9px] px-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                              SUPERVISOR
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] block truncate ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                          {staff.roleLabel}
                        </span>
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4 text-[#82d8a9] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Demo Credentials Reminder */}
            <div
              className={`p-2.5 border mt-4 text-[11px] space-y-1 ${
                isDark ? 'bg-[#0a0f0d] border-[#262b29] text-[#88938b]' : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-[#82d8a9] text-[10px] uppercase">
                <ShieldCheck className="w-3.5 h-3.5" /> Quick Demo PINs
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span>Admin (Owner):</span>
                <span className="text-amber-400 font-bold">PIN: 9999 / 1234</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span>Sales Manager:</span>
                <span className="text-emerald-400 font-bold">PIN: 1234</span>
              </div>
            </div>
          </div>

          {/* Right: PIN Entry & Touch Numpad */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between">
            <div>
              {/* Selected staff header badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs ${isDark ? 'text-[#88938b]' : 'text-slate-500'}`}>
                  Authenticating as: <strong className="text-white">{selectedStaff?.name || 'Staff User'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setUsePasswordMode(!usePasswordMode)}
                  className="text-[11px] text-[#82d8a9] hover:underline flex items-center gap-1 font-semibold"
                >
                  {usePasswordMode ? 'Use Quick 4-Digit PIN' : 'Use Account Password'}
                </button>
              </div>

              {/* Error Notification */}
              {errorMsg && (
                <div className="p-2.5 mb-3 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Input Display */}
              {usePasswordMode ? (
                <div className="relative mb-4">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className={`w-full p-3 text-sm border font-mono focus:outline-none focus:border-[#82d8a9] ${
                      isDark ? 'bg-[#0a0f0d] border-[#3f4942] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#88938b] hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <div
                    className={`flex items-center justify-center gap-3 py-3 px-4 border tracking-widest text-2xl font-mono ${
                      isDark ? 'bg-[#0a0f0d] border-[#3f4942]' : 'bg-slate-100 border-slate-300'
                    }`}
                  >
                    {[0, 1, 2, 3].map((idx) => {
                      const hasChar = pin.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            hasChar
                              ? 'bg-[#82d8a9] border-[#82d8a9] scale-110 shadow-sm shadow-[#82d8a9]/50'
                              : isDark
                              ? 'border-[#3f4942] bg-transparent'
                              : 'border-slate-300 bg-transparent'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="text-center mt-1">
                    <span className={`text-[10px] ${isDark ? 'text-[#88938b]' : 'text-slate-400'}`}>
                      {pin.length === 0 ? 'Enter your 4-digit PIN' : `${pin.length} digits entered`}
                    </span>
                  </div>
                </div>
              )}

              {/* Touch Numpad */}
              {!usePasswordMode && (
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleNumpadPress(btn)}
                      className={`py-3.5 text-base font-bold font-mono border transition-all active:scale-95 ${
                        btn === 'CLR'
                          ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/40'
                          : btn === 'DEL'
                          ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-800/40'
                          : isDark
                          ? 'bg-[#1c211e] hover:bg-[#262b29] text-white border-[#262b29]'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-inherit">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || (!usePasswordMode && pin.length < 4) || (usePasswordMode && !password)}
                className={`w-full py-3 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  isLoading || (!usePasswordMode && pin.length < 4) || (usePasswordMode && !password)
                    ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400 border-transparent'
                    : isDark
                    ? 'bg-[#006b45] hover:bg-[#036c46] text-white border-[#82d8a9] shadow-lg shadow-[#006b45]/30'
                    : 'bg-[#006b45] hover:bg-[#036c46] text-white border-[#006b45] shadow-lg shadow-emerald-700/20'
                }`}
              >
                {isLoading ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isLockedOnly ? 'Unlock Terminal Screen' : 'Log In to Terminal'}</span>
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
