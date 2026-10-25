"use client";

import React, { useState } from "react";
import {
  Banknote,
  Coins,
  ShieldCheck,
  Printer,
  Plus,
  Minus,
  AlertCircle,
  FileText,
  Lock,
  ArrowRight,
  X,
  Package,
} from "lucide-react";
import { NEPALI_DENOMINATIONS } from "./BodFloatInputModal";

interface BlindEodCloseModalProps {
  isOpen: boolean;
  terminalCode: string;
  shiftId: number | string | null;
  cashierName: string;
  onClosed: () => void;
  onCloseModal: () => void;
}

export default function BlindEodCloseModal({
  isOpen,
  terminalCode,
  shiftId,
  cashierName,
  onClosed,
  onCloseModal,
}: BlindEodCloseModalProps) {
  // Cashier blind count state - initialized strictly to 0
  const [denominations, setDenominations] = useState<Record<string, number>>({
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

  const [envelopeSealNo, setEnvelopeSealNo] = useState(`ENV-${Date.now().toString().slice(-4)}`);
  const [voucherBundleCount, setVoucherBundleCount] = useState(0);
  const [cashierNotes, setCashierNotes] = useState("");

  // Supervisor Authorization state
  const [supervisorCode, setSupervisorCode] = useState("ADMIN");
  const [supervisorPin, setSupervisorPin] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedSlip, setSubmittedSlip] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleQtyChange = (valStr: string, count: number) => {
    const safeCount = Math.max(0, isNaN(count) ? 0 : count);
    setDenominations((prev) => ({
      ...prev,
      [valStr]: safeCount,
    }));
  };

  // Cashier sees ONLY total counted notes, NEVER the expected cash or any discrepancy
  const totalCountedCash = NEPALI_DENOMINATIONS.reduce((sum, denom) => {
    const qty = denominations[denom.value.toString()] || 0;
    return sum + denom.value * qty;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!supervisorPin) {
      setErrorMessage("Duty Supervisor PIN confirmation is required to initiate register closing.");
      return;
    }

    setLoading(true);

    try {
      // 1. Verify supervisor credentials
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
        throw new Error(supData.message || "Supervisor PIN invalid or authorization rejected.");
      }

      // 2. Submit blind cash count to streamlined API
      const res = await fetch("/api/pos/terminal/streamlined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "blind_eod_close",
          terminalCode,
          shiftId,
          supervisorId: supData.staff.id,
          supervisorPin: supervisorPin.trim(),
          supervisorName: supData.staff.name,
          cashierName,
          closingDenominations: denominations,
          closingTotal: totalCountedCash,
          voucherBundleCount,
          envelopeSealNo,
          cashierNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit blind cash count.");
      }

      // Success: display printable 2-copy handover slips
      setSubmittedSlip(data.handoverSlip);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process EOD close.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFinish = () => {
    onClosed();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400">
                  State 6: Blind EOD Close
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Physical Cash Drawer Count &amp; Handover
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">
                End of Day Register Close &amp; Envelope Submission
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Register Till
              </span>
              <span className="text-xs font-black text-rose-400">
                {terminalCode} • {cashierName}
              </span>
            </div>
            {!submittedSlip && (
              <button
                type="button"
                onClick={onCloseModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Content */}
        {!submittedSlip ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
            {errorMessage && (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left: Blind Cash Denomination Input (7 cols) */}
              <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-400">
                      <Coins className="h-4 w-4" /> Physical Drawer Notes (Blind Count)
                    </span>
                    <span className="rounded bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300 uppercase">
                      Pure Blind Mode: Expected Cash Hidden
                    </span>
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
                              className="h-7 w-12 rounded-lg border border-slate-700 bg-slate-900 text-center font-mono text-xs font-bold text-white outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
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

                {/* Total Counted Banner (NO variance, NO expected cash) */}
                <div className="flex items-center justify-between rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 shadow-sm">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-rose-400">
                      Total Counted Physical Cash in Drawer
                    </span>
                    <p className="text-xs text-slate-400">
                      Amount to be sealed inside accounts envelope
                    </p>
                  </div>
                  <div className="font-mono text-2xl font-black text-rose-400">
                    NPR {totalCountedCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Right: Envelope Packaging & Supervisor Sign-off (5 cols) */}
              <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-800 bg-slate-950/90 p-5 lg:col-span-5">
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                      <Package className="h-4 w-4" /> Physical Deposit Bundle Details
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      All physical customer invoice duplicates and expense vouchers must accompany this envelope.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Envelope Seal Tag #
                      </label>
                      <input
                        type="text"
                        required
                        value={envelopeSealNo}
                        onChange={(e) => setEnvelopeSealNo(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-rose-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Physical Invoices / Vouchers Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={voucherBundleCount}
                        onChange={(e) => setVoucherBundleCount(parseInt(e.target.value, 10) || 0)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-rose-400"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 space-y-3">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                      <ShieldCheck className="h-4 w-4" /> Supervisor Handover PIN
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={supervisorCode}
                        onChange={(e) => setSupervisorCode(e.target.value)}
                        placeholder="Supervisor Code"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="PIN (9999/1234)"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono tracking-widest text-white placeholder-slate-500 outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Cashier Handover Notes
                    </label>
                    <textarea
                      rows={2}
                      value={cashierNotes}
                      onChange={(e) => setCashierNotes(e.target.value)}
                      placeholder="e.g. All counted physical notes and vouchers enclosed in sealed pouch"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-400"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-sm font-black text-white transition hover:bg-rose-500 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-rose-600/20"
                  >
                    {loading ? "Submitting..." : "Generate 2 Handover Slips & Lock"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          /* Printable Dual-Copy Handover Slips Screen */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                  ✓ Shift Submitted to Central Accounts
                </h3>
                <p className="text-xs text-slate-300">
                  Two copies of the official Cash Handover Slip have been generated below.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-400 transition"
                >
                  <Printer className="h-4 w-4" /> Print Both Slips
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-700 transition"
                >
                  <Lock className="h-4 w-4" /> Finish &amp; Return to Locked State
                </button>
              </div>
            </div>

            {/* Two Side-by-Side Printable Slips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
              {submittedSlip.copies.map((copy: any, idx: number) => (
                <div
                  key={idx}
                  className="border border-slate-700 bg-white text-slate-900 rounded-2xl p-5 shadow-md flex flex-col justify-between font-mono text-xs"
                >
                  <div>
                    {/* Header */}
                    <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                      <h4 className="font-black text-sm uppercase">Intel Computer Center</h4>
                      <p className="text-[10px] text-slate-600">Dhangadhi Flagship Station</p>
                      <div className="mt-1 inline-block bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {copy.recipient}
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] mb-3 border-b border-dashed border-slate-300 pb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Slip ID:</span>
                        <span className="font-bold">{submittedSlip.slipId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Terminal:</span>
                        <span className="font-bold">{submittedSlip.terminalCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Envelope Seal Tag:</span>
                        <span className="font-bold">{submittedSlip.envelopeSealNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Invoices/Vouchers:</span>
                        <span className="font-bold">{submittedSlip.voucherBundleCount} docs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Date/Time:</span>
                        <span>{new Date(submittedSlip.submittedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Denominations summary */}
                    <div className="mb-3">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Physical Cash Breakdown:
                      </span>
                      <div className="space-y-0.5 text-[10px]">
                        {Object.entries(submittedSlip.closingDenominations || {}).map(
                          ([val, qty]: any) => {
                            if (!qty) return null;
                            const sub = parseInt(val, 10) * qty;
                            return (
                              <div key={val} className="flex justify-between">
                                <span>₨ {val} × {qty}</span>
                                <span className="font-semibold">₨ {sub.toLocaleString("en-IN")}</span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded-lg border border-slate-200 mb-4">
                      <span className="font-black text-xs uppercase">Total Counted Cash:</span>
                      <span className="font-black text-sm">
                        NPR {submittedSlip.totalCashCounted?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Dual Signatures */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-300 text-center">
                    <div>
                      <div className="h-10 border-b border-slate-400 mb-1"></div>
                      <span className="text-[10px] font-bold block">{submittedSlip.cashierName}</span>
                      <span className="text-[9px] text-slate-500">Cashier (बुझाउने)</span>
                    </div>
                    <div>
                      <div className="h-10 border-b border-slate-400 mb-1"></div>
                      <span className="text-[10px] font-bold block">{submittedSlip.supervisorName}</span>
                      <span className="text-[9px] text-slate-500">Duty Supervisor (प्रमाणित गर्ने)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
