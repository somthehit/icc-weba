"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  X,
  Trash2,
  Delete,
  Lock,
  UserCheck,
  Info,
} from "lucide-react";

export interface LineVoidTarget {
  productId: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  isEntireCart?: boolean;
}

interface LineVoidModalProps {
  isOpen: boolean;
  targetItem: LineVoidTarget | null;
  terminalCode?: string;
  dutySupervisorName?: string;
  theme?: "dark" | "light";
  onApprove: (productId: number, reason: string, supervisorName: string, isEntireCart?: boolean) => void;
  onCancel: () => void;
}

const VOID_REASONS = [
  "Customer Changed Mind",
  "Scanned by Mistake",
  "Wrong Item Scanned",
  "Price Dispute / Inquiry",
  "Damaged / Defective",
  "Cashier Duplicate Entry",
];

const KNOWN_SUPERVISORS = [
  { code: "ADM01", label: "ADM01 (Admin - Bimal)", pinHint: "9999" },
  { code: "SUP01", label: "SUP01 (Manager - Sujan)", pinHint: "1234" },
  { code: "SUP02", label: "SUP02 (Supervisor - Kiran)", pinHint: "5129" },
];

export default function LineVoidModal({
  isOpen,
  targetItem,
  terminalCode = "REG-01",
  dutySupervisorName = "Duty Supervisor",
  theme = "light",
  onApprove,
  onCancel,
}: LineVoidModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("Customer Changed Mind");
  const [customReason, setCustomReason] = useState<string>("");
  const [supervisorCode, setSupervisorCode] = useState<string>("ADM01");
  const [supervisorPin, setSupervisorPin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSupervisorPin("");
      setErrorMessage("");
      setSelectedReason("Customer Changed Mind");
      setCustomReason("");
      setSupervisorCode("ADM01");
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !targetItem) return null;

  const handleKeypadPress = (val: string) => {
    setErrorMessage("");
    if (val === "CLEAR") {
      setSupervisorPin("");
      pinInputRef.current?.focus();
      return;
    }
    if (val === "BACKSPACE") {
      setSupervisorPin((prev) => prev.slice(0, -1));
      pinInputRef.current?.focus();
      return;
    }
    if (supervisorPin.length < 6) {
      setSupervisorPin((prev) => prev + val);
      pinInputRef.current?.focus();
    }
  };

  const handleAuthorizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanPin = supervisorPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage("Please enter a valid 4–6 digit Supervisor PIN.");
      pinInputRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      // 1. Verify supervisor authority with API
      const res = await fetch("/api/auth/supervisor-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffCode: supervisorCode.trim() || "ADM01",
          pin: cleanPin,
          terminalCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid Supervisor PIN or insufficient privileges.");
      }

      // Check role authority
      const allowedRoles = ["admin", "manager", "supervisor", "store_manager"];
      const userRole = data.staff?.role;
      if (userRole && !allowedRoles.includes(userRole)) {
        throw new Error(`User role (${userRole}) is not authorized for line voids.`);
      }

      const effectiveReason = customReason.trim() ? customReason.trim() : selectedReason;
      const approvedBy = data.staff?.name || dutySupervisorName || "Duty Supervisor";

      onApprove(targetItem.productId, effectiveReason, approvedBy, targetItem.isEntireCart);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Supervisor authorization failed.");
      }
      setSupervisorPin("");
      pinInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const isEntire = Boolean(targetItem.isEntireCart);
  const activePinHint = KNOWN_SUPERVISORS.find((s) => s.code === supervisorCode)?.pinHint;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
          theme === "dark"
            ? "bg-[#0f172a] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* ================= PINNED HEADER ================= */}
        <div
          className={`flex-shrink-0 flex items-center justify-between border-b px-5 py-4 ${
            theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-rose-500/30 bg-rose-500/10 text-rose-600 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                  Security Override
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {terminalCode}
                </span>
              </div>
              <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
                {isEntire ? "Void Entire Transaction (Clear Cart)" : "Supervisor Line Void Authorization"}
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cancel and close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ================= SCROLLABLE CONTENT BODY ================= */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {/* Target Item Card */}
          <div
            className={`rounded-2xl border-2 p-3.5 flex items-center justify-between shadow-2xs ${
              theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 mr-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 border border-rose-300 text-rose-700 shrink-0 shadow-2xs">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                  {targetItem.name}
                </p>
                <p className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isEntire
                    ? `${targetItem.quantity} Item(s) in Cart`
                    : `SKU: ${targetItem.sku} • Qty: ${targetItem.quantity} × NPR ${targetItem.price.toLocaleString("en-IN")}`}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                Void Total
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-rose-700 dark:text-rose-400">
                NPR {targetItem.lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Reason for Void Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reason for Void
              </label>
              <span className="text-[10px] font-mono text-slate-500 font-semibold">Required for Audit Log</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VOID_REASONS.map((r) => {
                const isSelected = selectedReason === r && !customReason;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedReason(r);
                      setCustomReason("");
                    }}
                    className={`px-3 py-2.5 rounded-xl text-left text-xs transition border-2 cursor-pointer ${
                      isSelected
                        ? "bg-rose-50 border-rose-500 text-rose-950 font-black shadow-2xs ring-2 ring-rose-500/20"
                        : theme === "dark"
                        ? "bg-slate-950/70 border-slate-800 text-slate-300 font-bold hover:border-slate-700"
                        : "bg-white border-slate-200 text-slate-700 font-bold hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="line-clamp-1">{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-2xl border-2 border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 font-bold shadow-2xs animate-shake">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                <p className="text-[11px] font-medium text-rose-700 mt-0.5">
                  Try default supervisor PIN: <strong>9999</strong> (ADM01) or <strong>1234</strong> (SUP01).
                </p>
              </div>
            </div>
          )}

          {/* Supervisor Identity & Staff Code selector */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                Supervisor Staff Code
              </label>

              {/* Quick Supervisor Preset Pills */}
              <div className="flex items-center gap-1.5">
                {KNOWN_SUPERVISORS.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => {
                      setSupervisorCode(s.code);
                      setErrorMessage("");
                      pinInputRef.current?.focus();
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-black border transition cursor-pointer ${
                      supervisorCode === s.code
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Hidden Input for physical keyboard typing with custom visual PIN slots */}
            <div className="relative">
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={supervisorPin}
                onChange={(e) => {
                  setErrorMessage("");
                  setSupervisorPin(e.target.value.replace(/\D/g, ""));
                }}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                aria-label="Supervisor PIN"
                autoFocus
              />

              {/* Visual PIN Slot Indicators */}
              <div
                className={`py-3 px-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                  supervisorPin.length >= 4
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                }`}
                onClick={() => pinInputRef.current?.focus()}
              >
                <div className="flex items-center gap-2 text-slate-500">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300">
                    PIN:
                  </span>
                </div>

                {/* 6 Digit slots */}
                <div className="flex items-center gap-3">
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const isFilled = idx < supervisorPin.length;
                    const isActive = idx === supervisorPin.length;
                    return (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                          isFilled
                            ? "border-blue-600 bg-blue-600 scale-110 shadow-xs"
                            : isActive
                            ? "border-blue-500 bg-blue-100/60 dark:bg-blue-900/40 animate-pulse"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="text-[11px] font-mono font-bold text-slate-500">
                  {supervisorPin.length}/6 Digits
                </div>
              </div>
            </div>

            {/* Helper Hint */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                Active Staff: <strong className="text-slate-700 dark:text-slate-300">{supervisorCode}</strong>
              </span>
              {activePinHint && (
                <span>
                  Preset PIN: <strong className="text-blue-700 dark:text-blue-400">{activePinHint}</strong>
                </span>
              )}
            </div>

            {/* Quick Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto pt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACKSPACE"].map((key) => {
                if (key === "CLEAR") {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadPress("CLEAR")}
                      className="py-3 rounded-2xl border-2 border-rose-200 bg-rose-50 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition cursor-pointer shadow-2xs"
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
                      className="py-3 flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition cursor-pointer shadow-2xs"
                      title="Backspace"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-lg font-black hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer shadow-2xs"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= PINNED MODAL FOOTER ================= */}
        <div
          className={`flex-shrink-0 px-5 py-4 border-t flex items-center gap-3 ${
            theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={onCancel}
            className="w-1/3 py-3 px-4 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAuthorizeSubmit}
            disabled={loading || supervisorPin.length < 4}
            className="flex-1 py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-black text-sm shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying Authority...
              </span>
            ) : (
              <>
                <span>{isEntire ? "Authorize Void All (Clear Cart)" : "Authorize Line Void"}</span>
                <ShieldCheck className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
