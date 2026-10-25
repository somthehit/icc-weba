"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  X,
  Trash2,
  CheckCircle2,
  Package,
  RotateCcw,
  Delete,
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

export default function LineVoidModal({
  isOpen,
  targetItem,
  terminalCode = "REG-01",
  dutySupervisorName = "Duty Supervisor",
  theme = "dark",
  onApprove,
  onCancel,
}: LineVoidModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("Customer Changed Mind");
  const [customReason, setCustomReason] = useState<string>("");
  const [supervisorCode, setSupervisorCode] = useState<string>("ADMIN");
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
      return;
    }
    if (val === "BACKSPACE") {
      setSupervisorPin((prev) => prev.slice(0, -1));
      return;
    }
    if (supervisorPin.length < 6) {
      setSupervisorPin((prev) => prev + val);
    }
  };

  const handleAuthorizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanPin = supervisorPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage("Please enter a valid 4–6 digit Supervisor PIN.");
      return;
    }

    setLoading(true);

    try {
      // 1. Verify supervisor authority with API
      const res = await fetch("/api/auth/supervisor-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffCode: supervisorCode.trim() || "ADMIN",
          pin: cleanPin,
          terminalCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid Supervisor PIN or insufficient privileges.");
      }

      // Check role authority
      const allowedRoles = ["admin", "manager", "supervisor"];
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
    } finally {
      setLoading(false);
    }
  };

  const isEntire = Boolean(targetItem.isEntireCart);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl ${
          theme === "dark" ? "bg-[#0f1412] border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4 ${
            theme === "dark" ? "bg-[#141b18] border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                Security Override Required
              </span>
              <h3 className="text-base font-black tracking-tight">
                {isEntire ? "Void Entire Transaction (Clear Cart)" : "Supervisor Line Void Authorization"}
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className={`rounded-xl p-2 transition ${
              theme === "dark" ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleAuthorizeSubmit} className="p-6 space-y-4">
          {/* Target Item Card */}
          <div
            className={`rounded-2xl border p-3.5 flex items-center justify-between ${
              theme === "dark" ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black line-clamp-1">{targetItem.name}</p>
                <p className="text-[11px] font-mono text-slate-400">
                  {isEntire
                    ? `${targetItem.quantity} Item(s) in Cart`
                    : `SKU: ${targetItem.sku} • Qty: ${targetItem.quantity} × NPR ${targetItem.price.toLocaleString("en-IN")}`}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Void Total</span>
              <span className="text-sm font-black font-mono text-rose-400">
                NPR {targetItem.lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Void Reason Chips */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Reason for Void
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {VOID_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSelectedReason(r);
                    setCustomReason("");
                  }}
                  className={`px-3 py-2 rounded-xl text-left text-xs font-semibold transition border ${
                    selectedReason === r && !customReason
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-xs"
                      : theme === "dark"
                      ? "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Supervisor Identity & PIN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Supervisor Staff Code & PIN
              </label>
              <input
                type="text"
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value)}
                placeholder="ADMIN / SUP"
                className={`w-28 text-center px-2 py-1 text-xs font-bold font-mono rounded-lg border uppercase ${
                  theme === "dark" ? "bg-slate-950 border-slate-700 text-amber-400" : "bg-white border-slate-300 text-amber-700"
                }`}
              />
            </div>

            <div className="relative max-w-xs mx-auto">
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono font-black py-2.5 rounded-2xl border border-amber-500/50 bg-slate-950 text-amber-400 placeholder-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-amber-400/60" />
            </div>

            {/* Quick Touch Keypad */}
            <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto pt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACKSPACE"].map((key) => {
                if (key === "CLEAR") {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadPress("CLEAR")}
                      className="py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition active:scale-95"
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
                      className="py-2.5 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition active:scale-95"
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
                    className="py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-sm font-black text-white hover:bg-slate-800 transition active:scale-95 shadow-xs"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className={`w-1/3 rounded-xl border py-3 text-xs font-bold transition ${
                theme === "dark"
                  ? "border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || supervisorPin.length < 4}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] py-3 text-sm font-black text-white transition disabled:opacity-50 shadow-lg shadow-rose-600/20"
            >
              {loading ? "Verifying Authority..." : isEntire ? "Authorize Void All" : "Authorize Line Void"}
              <ShieldCheck className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
