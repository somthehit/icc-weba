"use client";

import React, { useState } from "react";
import { Coins, Banknote, ShieldCheck, Plus, Minus, AlertCircle, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { StaffProfile } from "./TerminalDualAuthGate";

export const NEPALI_DENOMINATIONS = [
  { value: 1000, label: "NPR 1,000", color: "text-amber-400", bg: "bg-amber-500/10" },
  { value: 500, label: "NPR 500", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { value: 100, label: "NPR 100", color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: 50, label: "NPR 50", color: "text-purple-400", bg: "bg-purple-500/10" },
  { value: 20, label: "NPR 20", color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: 10, label: "NPR 10", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { value: 5, label: "NPR 5", color: "text-teal-400", bg: "bg-teal-500/10" },
  { value: 2, label: "NPR 2 (Coins)", color: "text-slate-300", bg: "bg-slate-500/10" },
  { value: 1, label: "NPR 1 (Coins)", color: "text-slate-300", bg: "bg-slate-500/10" },
];

interface BodFloatInputModalProps {
  isOpen: boolean;
  terminalCode: string;
  supervisor: StaffProfile | null;
  cashier: StaffProfile | null;
  onShiftStarted: (shiftData: any) => void;
  onCancel?: () => void;
}

export default function BodFloatInputModal({
  isOpen,
  terminalCode = "REG-01",
  supervisor,
  cashier,
  onShiftStarted,
  onCancel,
}: BodFloatInputModalProps) {
  const [denominations, setDenominations] = useState<Record<string, number>>({
    "1000": 3,
    "500": 3,
    "100": 5,
    "50": 0,
    "20": 0,
    "10": 0,
    "5": 0,
    "2": 0,
    "1": 0,
  });

  const [supervisorPin, setSupervisorPin] = useState("");
  const [openingNote, setOpeningNote] = useState("Morning BOD float physically verified from accounts");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleQtyChange = (valStr: string, count: number) => {
    const safeCount = Math.max(0, isNaN(count) ? 0 : count);
    setDenominations((prev) => ({
      ...prev,
      [valStr]: safeCount,
    }));
  };

  const applyPreset = (type: "standard5k" | "standard10k" | "clear") => {
    if (type === "standard5k") {
      setDenominations({
        "1000": 2,
        "500": 4,
        "100": 8,
        "50": 4,
        "20": 0,
        "10": 0,
        "5": 0,
        "2": 0,
        "1": 0,
      });
    } else if (type === "standard10k") {
      setDenominations({
        "1000": 5,
        "500": 8,
        "100": 8,
        "50": 4,
        "20": 0,
        "10": 0,
        "5": 0,
        "2": 0,
        "1": 0,
      });
    } else {
      setDenominations({
        "1000": 0,
        "500": 0,
        "100": 0,
        "50": 0,
        "20": 0,
        "10": 0,
        "5": 0,
        "2": 0,
        "1": 0,
      });
    }
  };

  // Total physical float calculation
  const openingTotal = NEPALI_DENOMINATIONS.reduce((sum, denom) => {
    const qty = denominations[denom.value.toString()] || 0;
    return sum + denom.value * qty;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!supervisorPin) {
      setErrorMessage("Duty Supervisor PIN confirmation is required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/pos/terminal/streamlined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bod_open",
          terminalCode,
          cashierId: cashier?.id,
          cashierName: cashier?.name || "Cashier",
          supervisorId: supervisor?.id,
          supervisorPin: supervisorPin.trim(),
          supervisorName: supervisor?.name || "Duty Supervisor",
          openingDenominations: denominations,
          openingFloat: openingTotal,
          note: openingNote,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to open shift. Supervisor authorization rejected.");
      }

      onShiftStarted(data.shift);
    } catch (err: any) {
      setErrorMessage(err.message || "BOD Float verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  State 3: BOD Float Input
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Central Cash Office Handover
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">
                Beginning of Day (BOD) Opening Cash Float
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Assigned Cashier
            </span>
            <span className="text-xs font-black text-emerald-400">
              {cashier?.name} ({cashier?.staffCode || "Cashier"})
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {errorMessage && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Touchscreen Denomination Grid (7 cols) */}
            <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
                    <Coins className="h-4 w-4" /> Physical Note Breakdown (NPR)
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => applyPreset("standard5k")}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
                    >
                      Preset ₨ 5,000
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("standard10k")}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition"
                    >
                      Preset ₨ 10,000
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("clear")}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-white transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
                  {NEPALI_DENOMINATIONS.map((d) => {
                    const count = denominations[d.value.toString()] || 0;
                    const subtotal = d.value * count;
                    return (
                      <div
                        key={d.value}
                        className="grid grid-cols-12 items-center gap-2 p-2 hover:bg-slate-800/40 rounded-xl transition"
                      >
                        <div className="col-span-4 flex items-center gap-2 font-mono font-bold text-xs text-white">
                          <span className={`w-2 h-2 rounded-full ${d.bg}`}></span>
                          {d.label}
                        </div>

                        <div className="col-span-4 flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleQtyChange(d.value.toString(), count - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95 transition"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={count || ""}
                            placeholder="0"
                            onChange={(e) =>
                              handleQtyChange(d.value.toString(), parseInt(e.target.value, 10))
                            }
                            className="h-7 w-12 rounded-lg border border-slate-700 bg-slate-900 text-center font-mono text-xs font-bold text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleQtyChange(d.value.toString(), count + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95 transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="col-span-4 text-right font-mono text-xs font-black text-slate-200">
                          ₨ {subtotal.toLocaleString("en-IN")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Banner */}
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 shadow-sm">
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Total Calculated BOD Float
                  </span>
                  <p className="text-xs text-slate-400">
                    Cashier accepts physical custody
                  </p>
                </div>
                <div className="font-mono text-2xl font-black text-emerald-400">
                  NPR {openingTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Right: Supervisor Confirmation Gate (5 cols) */}
            <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-800 bg-slate-950/90 p-5 lg:col-span-5">
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <ShieldCheck className="h-4 w-4" /> Duty Supervisor Sign-Off
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Supervisor must visually count and confirm the physical cash float matches before opening billing.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Authorizing Supervisor
                  </span>
                  <p className="text-xs font-black text-white">
                    {supervisor?.name} ({supervisor?.role?.toUpperCase() || "DUTY SUPERVISOR"})
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Supervisor Authorization PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-base tracking-widest font-mono text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">
                    Fast PIN: 9999 or 1234
                  </span>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Handover Verification Note
                  </label>
                  <input
                    type="text"
                    value={openingNote}
                    onChange={(e) => setOpeningNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {loading ? "Authorizing..." : "Confirm & Start Billing (State 4)"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Lock Terminal & Exit
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
