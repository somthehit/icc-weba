"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Sparkles,
  Building,
  Terminal,
  RotateCcw,
  Unlock,
  CheckCircle2,
  Delete,
} from "lucide-react";

export type AuthStep = "QUICK_PIN_UNLOCK" | "SUPERVISOR_AUTH" | "CASHIER_AUTH" | "AUTH_SUCCESS";

export interface StaffProfile {
  id: string;
  name: string;
  staffCode: string;
  role: "admin" | "supervisor" | "manager" | "cashier";
}

interface DualAuthProps {
  terminalName?: string;
  terminalCode?: string;
  activeShift?: any | null;
  activeCashier?: StaffProfile | null;
  dutySupervisor?: StaffProfile | null;
  onAuthCompleted: (supervisor: StaffProfile, cashier: StaffProfile, existingShift?: any) => void;
}

export default function TerminalDualAuthGate({
  terminalName = "Counter 1 - Main Checkout",
  terminalCode = "REG-01",
  activeShift = null,
  activeCashier = null,
  dutySupervisor = null,
  onAuthCompleted,
}: DualAuthProps) {
  // If active shift is already present, default to quick cashier PIN unlock!
  const hasActiveShift = Boolean(activeShift && (activeShift.status === "OPEN" || activeShift.status === "PAUSED"));
  const [currentStep, setCurrentStep] = useState<AuthStep>(
    hasActiveShift ? "QUICK_PIN_UNLOCK" : "SUPERVISOR_AUTH"
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Quick Unlock PIN
  const [quickPin, setQuickPin] = useState("");
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Supervisor State
  const [supervisorCode, setSupervisorCode] = useState("ADMIN");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [supervisorPin, setSupervisorPin] = useState("");
  const [usePinMode, setUsePinMode] = useState(true);
  const [authorizedSupervisor, setAuthorizedSupervisor] = useState<StaffProfile | null>(dutySupervisor);

  // Step 2: Cashier State
  const [cashierCode, setCashierCode] = useState(activeCashier?.staffCode || "");
  const [cashierPin, setCashierPin] = useState("");

  useEffect(() => {
    if (hasActiveShift && !authorizedSupervisor && dutySupervisor) {
      setAuthorizedSupervisor(dutySupervisor);
    }
  }, [hasActiveShift, dutySupervisor]);

  useEffect(() => {
    if (currentStep === "QUICK_PIN_UNLOCK" && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [currentStep]);

  // Handle Quick PIN Keypad click
  const handleKeypadPress = (val: string) => {
    setErrorMessage("");
    if (val === "CLEAR") {
      setQuickPin("");
      return;
    }
    if (val === "BACKSPACE") {
      setQuickPin((prev) => prev.slice(0, -1));
      return;
    }
    if (quickPin.length < 6) {
      setQuickPin((prev) => prev + val);
    }
  };

  // Quick Cashier PIN Unlock
  const handleQuickUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickPin || quickPin.length < 4) {
      setErrorMessage("Please enter a valid 4–6 digit Cashier PIN.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      const codeToUse = activeCashier?.staffCode || cashierCode || "CASHIER";
      const nameToUse = activeCashier?.name || activeShift?.cashierName || "";
      const idToUse = activeCashier?.id || activeShift?.cashierId || null;

      const res = await fetch("/api/auth/cashier-pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashierCode: codeToUse,
          cashierName: nameToUse,
          cashierId: idToUse,
          pin: quickPin,
          terminalCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Fallback test via streamlined route unlock
        const unlockRes = await fetch("/api/pos/terminal/streamlined", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cashier_unlock",
            terminalCode,
            cashierId: idToUse,
            cashierCode: codeToUse,
            cashierName: nameToUse,
            cashierPin: quickPin,
          }),
        });
        const unlockData = await unlockRes.json();
        if (!unlockRes.ok || !unlockData.success) {
          throw new Error(data.message || unlockData.error || "Incorrect Cashier PIN. Terminal remains locked.");
        }
      }

      const supervisorProfile: StaffProfile = authorizedSupervisor || dutySupervisor || {
        id: "sup-duty",
        name: activeShift?.openedBySupervisorName || "Duty Supervisor",
        staffCode: "SUPERVISOR",
        role: "supervisor",
      };

      const cashierProfile: StaffProfile = (data.staff as StaffProfile) || activeCashier || {
        id: String(activeShift?.cashierId || "cashier"),
        name: activeShift?.cashierName || "Cashier",
        staffCode: codeToUse,
        role: "cashier",
      };

      onAuthCompleted(supervisorProfile, cashierProfile, activeShift || data.activeShift);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Unlock failed. Please verify your PIN.");
      }
      setQuickPin("");
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Verify Supervisor Credentials
  const handleSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/supervisor-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffCode: supervisorCode,
          password: usePinMode ? undefined : supervisorPassword,
          pin: usePinMode ? supervisorPin : undefined,
          terminalCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid supervisor credentials or insufficient permissions.");
      }

      setAuthorizedSupervisor(data.staff);
      setCurrentStep("CASHIER_AUTH");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Supervisor authorization failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Cashier PIN
  const handleCashierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/cashier-pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashierCode,
          pin: cashierPin,
          supervisorId: authorizedSupervisor?.id,
          terminalCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid cashier code or PIN.");
      }

      setCurrentStep("AUTH_SUCCESS");
      if (authorizedSupervisor) {
        onAuthCompleted(authorizedSupervisor, data.staff, data.activeShift);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Cashier authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 p-7 shadow-2xl backdrop-blur-md">
        
        {/* Terminal Header */}
        <div className="mb-5 border-b border-slate-800 pb-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
            <Lock className="h-7 w-7" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Terminal Locked
            </span>
            {hasActiveShift && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Active Shift #{activeShift.shiftNumber}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {currentStep === "QUICK_PIN_UNLOCK" ? "Unlock Counter POS" : "POS Dual Access Gate"}
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            {terminalName} ({terminalCode})
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* VIEW A: FAST CASHIER PIN UNLOCK (When Shift is Already Open)        */}
        {/* ----------------------------------------------------------------- */}
        {currentStep === "QUICK_PIN_UNLOCK" && (
          <form onSubmit={handleQuickUnlockSubmit} className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Cashier on Duty
                  </span>
                  <p className="text-sm font-black text-white">
                    {activeCashier?.name || activeShift?.cashierName || "Cashier"}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                {activeCashier?.staffCode || "CASHIER"}
              </span>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300 text-center">
                Enter Cashier PIN to Resume Billing
              </label>
              
              <div className="relative max-w-xs mx-auto mb-3">
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={quickPin}
                  onChange={(e) => setQuickPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.6em] text-2xl font-mono font-black py-3 rounded-2xl border border-emerald-500/40 bg-slate-950 text-emerald-400 placeholder-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              {/* Touch Numpad */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACKSPACE"].map((key) => {
                  if (key === "CLEAR") {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeypadPress("CLEAR")}
                        className="py-3 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition active:scale-95"
                      >
                        Clear
                      </button>
                    );
                  }
                  if (key === "BACKSPACE") {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeypadPress("BACKSPACE")}
                        className="py-3 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition active:scale-95"
                      >
                        <Delete className="h-4 w-4" />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadPress(key)}
                      className="py-3.5 rounded-xl border border-slate-800 bg-slate-950/90 text-base font-black text-white hover:bg-slate-800 hover:border-slate-700 transition active:scale-95 shadow-xs"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || quickPin.length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-emerald-500/20 mt-2"
            >
              {loading ? "Unlocking Terminal..." : "Unlock Register"}
              <Unlock className="h-4 w-4" />
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setCurrentStep("SUPERVISOR_AUTH")}
                className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition underline underline-offset-2"
              >
                Switch Cashier / Supervisor Handover Gate
              </button>
            </div>
          </form>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* VIEW B: DUAL-CUSTODY STEPPER (Initial Sign In or Supervisor Gate)  */}
        {/* ----------------------------------------------------------------- */}
        {(currentStep === "SUPERVISOR_AUTH" || currentStep === "CASHIER_AUTH") && (
          <>
            {/* Stepper Indicator */}
            <div className="mb-5 grid grid-cols-2 gap-2 text-xs font-semibold">
              <div
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all ${
                  currentStep === "SUPERVISOR_AUTH"
                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-xs"
                    : "border border-slate-800 bg-slate-950/60 text-slate-500"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>1. Supervisor Gate</span>
              </div>

              <div
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all ${
                  currentStep === "CASHIER_AUTH"
                    ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-xs"
                    : "border border-slate-800 bg-slate-950/60 text-slate-500"
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>2. Cashier Login</span>
              </div>
            </div>

            {/* STEP 1: Supervisor Form */}
            {currentStep === "SUPERVISOR_AUTH" && (
              <form onSubmit={handleSupervisorSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
                  <span className="font-bold">Dual-Custody Handover:</span> A Duty Supervisor must authorize this register before a cashier opens or operates a shift.
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Supervisor / Admin Username or Staff Code
                  </label>
                  <input
                    type="text"
                    required
                    value={supervisorCode}
                    onChange={(e) => setSupervisorCode(e.target.value)}
                    placeholder="e.g. ADMIN / SUP01"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {usePinMode ? "Supervisor 4–6 Digit PIN" : "Supervisor Master Password"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setUsePinMode(!usePinMode)}
                      className="text-[11px] font-semibold text-amber-400 hover:underline"
                    >
                      {usePinMode ? "Use Password" : "Use Fast PIN (9999/1234)"}
                    </button>
                  </div>

                  {usePinMode ? (
                    <div className="relative">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 pl-11 text-base tracking-widest font-mono text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      />
                      <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-amber-400" />
                    </div>
                  ) : (
                    <input
                      type="password"
                      required
                      value={supervisorPassword}
                      onChange={(e) => setSupervisorPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  {hasActiveShift && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep("QUICK_PIN_UNLOCK")}
                      className="w-1/3 rounded-xl border border-slate-800 bg-slate-950 py-3 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-amber-500/20"
                  >
                    {loading ? "Verifying..." : "Authorize Supervisor"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Cashier Form */}
            {currentStep === "CASHIER_AUTH" && (
              <form onSubmit={handleCashierSubmit} className="space-y-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                      Duty Supervisor Authorized
                    </span>
                    <p className="text-xs font-black text-white">
                      {authorizedSupervisor?.name} ({authorizedSupervisor?.role?.toUpperCase()})
                    </p>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cashier Staff Code / Email
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={cashierCode}
                    onChange={(e) => setCashierCode(e.target.value)}
                    placeholder="e.g. C001 / sales"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cashier 4–6 Digit PIN
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={cashierPin}
                      onChange={(e) => setCashierPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 pl-11 text-base tracking-widest font-mono text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    />
                    <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-400" />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorizedSupervisor(null);
                      setCurrentStep("SUPERVISOR_AUTH");
                    }}
                    className="w-1/3 rounded-xl border border-slate-800 bg-slate-950 py-3 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {loading ? "Logging in..." : "Open Cashier Shift"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
}

