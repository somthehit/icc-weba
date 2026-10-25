"use client";

import React, { useState } from "react";
import { ShieldAlert, KeyRound, AlertCircle, ArrowRight, X, Lock } from "lucide-react";
import { StaffProfile } from "./TerminalDualAuthGate";

interface SupervisorSignOffModalProps {
  isOpen: boolean;
  terminalCode: string;
  shiftId: number | string | null;
  cashierName: string;
  onSuccess: (reason: string) => void;
  onClose: () => void;
}

export default function SupervisorSignOffModal({
  isOpen,
  terminalCode,
  shiftId,
  cashierName,
  onSuccess,
  onClose,
}: SupervisorSignOffModalProps) {
  const [reason, setReason] = useState<"Temporary Pause" | "Terminal Switch" | "Shift End">("Temporary Pause");
  const [supervisorCode, setSupervisorCode] = useState("ADMIN");
  const [supervisorPin, setSupervisorPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!supervisorPin) {
      setErrorMessage("Supervisor PIN is required to authorize detachment.");
      return;
    }

    setLoading(true);

    try {
      // First verify supervisor identity
      const supAuthRes = await fetch("/api/auth/supervisor-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffCode: supervisorCode,
          pin: supervisorPin.trim(),
          terminalCode,
        }),
      });

      const supData = await supAuthRes.json();
      if (!supAuthRes.ok || !supData.success) {
        throw new Error(supData.message || "Invalid Supervisor PIN or insufficient privileges.");
      }

      // Then perform streamlined supervisor signoff
      const res = await fetch("/api/pos/terminal/streamlined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "supervisor_signoff",
          terminalCode,
          shiftId,
          supervisorId: supData.staff.id,
          supervisorPin: supervisorPin.trim(),
          supervisorName: supData.staff.name,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process supervisor signoff.");
      }

      onSuccess(reason);
    } catch (err: any) {
      setErrorMessage(err.message || "Supervisor sign-off authorization failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                State 5: Supervisor Sign-Off Gate
              </span>
              <h3 className="text-base font-black text-white">Authorize Till Detachment</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200/90 leading-relaxed">
            <span className="font-bold">Security Constraint:</span> Cashier <span className="text-white font-bold">{cashierName}</span> cannot leave the register without a Duty Supervisor&apos;s physical authorization.
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
              Reason for Detachment
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["Temporary Pause", "Terminal Switch", "Shift End"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`py-2 px-2 rounded-xl border font-bold text-center transition ${
                    reason === r
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
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
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
              Supervisor Confirmation PIN
            </label>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 pl-11 text-base tracking-widest font-mono text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-amber-400" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {loading ? "Authorizing..." : "Approve & Lock Terminal (State 1)"}
              <Lock className="h-4 w-4" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
