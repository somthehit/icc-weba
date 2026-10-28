'use client';

import React, { useState } from 'react';
import {
  Settings,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Printer,
  Volume2,
  Moon,
  Sun,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import { StaffProfile } from './TerminalDualAuthGate';

interface CashierSettingsViewProps {
  activeCashier: StaffProfile | null;
  terminalCode: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
}

export default function CashierSettingsView({
  activeCashier,
  terminalCode,
  theme,
  onToggleTheme,
  onOpenShortcuts,
}: CashierSettingsViewProps) {
  // 1. PIN Change Form State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinError, setPinError] = useState('');

  // 2. Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 3. Local Hardware Preferences
  const [doubleSlip, setDoubleSlip] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);

  // Submit PIN Change
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinSuccess('');
    setPinError('');

    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('New PIN must be between 4 and 6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('New PIN and confirmation PIN do not match.');
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch('/api/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_pin',
          staffId: activeCashier?.id,
          staffCode: activeCashier?.staffCode || 'CASHIER',
          currentPin: currentPin.trim() || undefined,
          newPin: newPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update PIN.');
      }

      setPinSuccess(data.message || 'Quick PIN updated successfully!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err: any) {
      setPinError(err.message || 'Error updating PIN');
    } finally {
      setPinLoading(false);
    }
  };

  // Submit Password Change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          staffId: activeCashier?.id,
          staffCode: activeCashier?.staffCode || 'CASHIER',
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setPasswordSuccess(data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Error changing password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/70 overflow-y-auto p-6 space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Cashier Security Portal
            </span>
            <span className="text-xs font-bold text-slate-500">
              Terminal: {terminalCode}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Account &amp; POS Settings
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Update your 4-digit quick unlock PIN, change login password, and configure counter preferences.
          </p>
        </div>

        {/* Profile Badge */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
            {activeCashier?.name?.charAt(0) || 'C'}
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">
              {activeCashier?.name || 'Cashier User'}
            </h4>
            <span className="text-[10px] font-mono font-black text-emerald-700 block">
              Staff ID: {activeCashier?.staffCode || 'CASHIER'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Credentials Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Change Fast PIN */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="h-9 w-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Change 4-Digit Quick PIN
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Used for fast till unlock and supervisor sign-offs</p>
            </div>
          </div>

          {pinSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{pinSuccess}</span>
            </div>
          )}

          {pinError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                Current PIN (Optional if not set)
              </label>
              <input
                type="password"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-black tracking-widest text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                New Fast PIN (4 to 6 Digits) *
              </label>
              <input
                type="password"
                required
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4-6 digit new PIN"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-black tracking-widest text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                Confirm New PIN *
              </label>
              <input
                type="password"
                required
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter new PIN"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-black tracking-widest text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={pinLoading}
              className="w-full py-3 rounded-2xl bg-[#00c569] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
            >
              {pinLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              <span>Update Quick PIN</span>
            </button>
          </form>
        </div>

        {/* Form 2: Change Cashier Password */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="h-9 w-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Change Login Password
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Update terminal login and system password</p>
            </div>
          </div>

          {passwordSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                Current Password *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                New Password (Min 6 Characters) *
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-1.5"
            >
              {passwordLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <span>Change Password</span>
            </button>
          </form>
        </div>
      </div>

      {/* 3. POS Terminal Hardware & Display Preferences */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
          Counter Hardware &amp; UI Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Double Slip Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Double Thermal Slip</h4>
                <p className="text-[10px] text-slate-500 font-medium">Customer Copy + Office Audit Copy</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDoubleSlip(!doubleSlip)}
              className={`w-11 h-6 rounded-full transition p-1 flex items-center ${
                doubleSlip ? 'bg-[#00c569] justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {/* Sound FX */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                <Volume2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Barcode Sound Effects</h4>
                <p className="text-[10px] text-slate-500 font-medium">Audio beep on successful item add</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSoundFeedback(!soundFeedback)}
              className={`w-11 h-6 rounded-full transition p-1 flex items-center ${
                soundFeedback ? 'bg-[#00c569] justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  {theme === 'dark' ? 'Dark Terminal Theme' : 'Light Counter Theme'}
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">Current active display mode</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 text-xs font-black text-slate-800 hover:bg-slate-300 transition"
            >
              Toggle
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 transition"
          >
            <Keyboard className="h-4 w-4 text-slate-600" />
            <span>View All Keyboard Shortcuts (F1 - F12)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
