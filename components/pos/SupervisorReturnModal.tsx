"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  AlertCircle,
  X,
  CheckCircle2,
  Package,
  Printer,
  Delete,
  Boxes,
  Receipt,
} from "lucide-react";

interface ReturnItemSelection {
  id: number;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selected: boolean;
  returnQty: number;
}

interface SupervisorReturnModalProps {
  isOpen: boolean;
  order: any | null;
  terminalCode?: string;
  shiftId?: number | string | null;
  cashierName?: string;
  dutySupervisorName?: string;
  theme?: "dark" | "light";
  onSuccess: (returnSlip: any) => void;
  onClose: () => void;
}

const RETURN_REASONS = [
  "Defective / Hardware Fault (वारेन्टी फिर्ता)",
  "Wrong Product Purchased (गलत सामान)",
  "Customer Dissatisfaction / Exchange (साटासाट)",
  "Billing Error / Duplicate Payment (बिलिङ त्रुटि)",
  "Damaged in Transit / Seal Broken (क्षतिग्रस्त)",
  "Other Reason (अन्य)",
];

export default function SupervisorReturnModal({
  isOpen,
  order,
  terminalCode = "REG-01",
  shiftId = null,
  cashierName = "Cashier",
  dutySupervisorName = "Duty Supervisor",
  theme = "dark",
  onSuccess,
  onClose,
}: SupervisorReturnModalProps) {
  const [items, setItems] = useState<ReturnItemSelection[]>([]);
  const [selectedReason, setSelectedReason] = useState<string>(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>("");
  const [restockItems, setRestockItems] = useState<boolean>(true);
  const [refundMethod, setRefundMethod] = useState<"cash" | "original">("cash");

  const [supervisorCode, setSupervisorCode] = useState<string>("ADMIN");
  const [supervisorPin, setSupervisorPin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && order) {
      setSupervisorPin("");
      setErrorMessage("");
      setSelectedReason(RETURN_REASONS[0]);
      setCustomReason("");
      
      const mappedItems: ReturnItemSelection[] = (order.items || []).map((it: any) => ({
        id: it.id,
        productId: it.productId,
        name: it.name || it.productNameSnapshot || "Product",
        sku: it.sku || it.skuSnapshot || "",
        quantity: it.quantity || 1,
        unitPrice: Number(it.unitPrice) || Number(it.price) || 0,
        lineTotal: Number(it.lineTotal) || (Number(it.unitPrice || it.price) * (it.quantity || 1)),
        selected: true,
        returnQty: it.quantity || 1,
      }));
      setItems(mappedItems);

      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  // Calculate refund sum for selected items
  const totalRefundAmount = items.reduce((sum, item) => {
    if (item.selected) {
      return sum + item.unitPrice * item.returnQty;
    }
    return sum;
  }, 0);

  const handleToggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it))
    );
  };

  const handleReturnQtyChange = (idx: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i === idx) {
          const safeQty = Math.max(1, Math.min(it.quantity, qty));
          return { ...it, returnQty: safeQty };
        }
        return it;
      })
    );
  };

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

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const selectedItems = items.filter((it) => it.selected);
    if (selectedItems.length === 0) {
      setErrorMessage("Please select at least one item to return.");
      return;
    }

    const cleanPin = supervisorPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage("Duty Supervisor PIN is required to authorize return/refund.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/pos/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          refundAmount: totalRefundAmount,
          returnedItems: selectedItems.map((it) => ({
            id: it.id,
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            quantity: it.returnQty,
            unitPrice: it.unitPrice,
            lineTotal: it.unitPrice * it.returnQty,
          })),
          reason: customReason.trim() ? customReason.trim() : selectedReason,
          restockItems,
          refundMethod,
          supervisorCode: supervisorCode.trim() || "ADMIN",
          supervisorPin: cleanPin,
          cashierName,
          registerCode: terminalCode,
          shiftId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process supervisor authorized return.");
      }

      onSuccess(data.returnSlip);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Return authorization failed.");
      }
      setSupervisorPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border shadow-2xl ${
          theme === "dark" ? "bg-[#0f1412] border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4 shrink-0 ${
            theme === "dark" ? "bg-[#141b18] border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Dual-Custody Return Authorization
              </span>
              <h3 className="text-base font-black tracking-tight">
                Authorize Return for Invoice #{order.orderNumber}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`rounded-xl p-2 transition ${
              theme === "dark" ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmitReturn} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Invoice Summary */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
            theme === 'dark' ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className="text-slate-400 font-mono">Date: {new Date(order.createdAt).toLocaleDateString()}</span>
              <p className="font-bold text-white mt-0.5">Original Tender: <span className="uppercase text-emerald-400 font-mono">{order.paymentMethod || 'Cash'}</span></p>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Refund Payable</span>
              <span className="text-lg font-black font-mono text-amber-400">
                NPR {totalRefundAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Items Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
              Select Items to Return / Refund
            </label>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                    it.selected
                      ? theme === "dark"
                        ? "bg-amber-950/20 border-amber-500/40"
                        : "bg-amber-50 border-amber-300"
                      : theme === "dark"
                      ? "bg-slate-950/40 border-slate-800 opacity-60"
                      : "bg-slate-50 border-slate-200 opacity-60"
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={() => handleToggleItem(idx)}
                      className="h-4 w-4 rounded accent-amber-500"
                    />
                    <div className="truncate">
                      <p className="font-bold truncate">{it.name}</p>
                      <span className="text-[11px] font-mono text-slate-400">
                        SKU: {it.sku || "N/A"} • NPR {it.unitPrice.toLocaleString("en-IN")} each
                      </span>
                    </div>
                  </label>

                  {it.selected && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-400">Return Qty:</span>
                      <select
                        value={it.returnQty}
                        onChange={(e) => handleReturnQtyChange(idx, Number(e.target.value))}
                        className={`rounded-lg border px-2 py-1 text-xs font-bold font-mono ${
                          theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      >
                        {Array.from({ length: it.quantity }, (_, i) => i + 1).map((q) => (
                          <option key={q} value={q}>
                            {q} / {it.quantity}
                          </option>
                        ))}
                      </select>
                      <span className="font-mono font-bold text-amber-400 w-20 text-right">
                        ₨ {(it.unitPrice * it.returnQty).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
              Return / Refund Reason
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {RETURN_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSelectedReason(r);
                    setCustomReason("");
                  }}
                  className={`px-3 py-2 rounded-xl text-left text-xs font-semibold transition border ${
                    selectedReason === r && !customReason
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs"
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

          {/* Restock & Refund Method Options */}
          <div className="grid grid-cols-2 gap-3">
            <label className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
              theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-400" />
                <span className="font-bold">Restock to Inventory</span>
              </div>
              <input
                type="checkbox"
                checked={restockItems}
                onChange={(e) => setRestockItems(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
            </label>

            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="font-bold text-slate-300">Refund Method:</span>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as any)}
                className={`rounded-lg border px-2 py-1 font-bold font-mono text-xs ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-300 text-amber-700'
                }`}
              >
                <option value="cash">Cash Out (Till)</option>
                <option value="original">Original Tender</option>
              </select>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Supervisor Authority Check */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Supervisor Authority PIN
                </span>
              </div>
              <input
                type="text"
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value)}
                placeholder="ADMIN / SUP"
                className="w-28 text-center px-2 py-1 text-xs font-bold font-mono rounded-lg border border-amber-500/40 bg-slate-950 text-amber-400 uppercase"
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
                className="w-full text-center tracking-[0.5em] text-2xl font-mono font-black py-2.5 rounded-2xl border border-amber-500 bg-slate-950 text-amber-400 placeholder-slate-700 outline-none transition focus:ring-2 focus:ring-amber-400/20"
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

          {/* Action Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              disabled={loading || totalRefundAmount <= 0 || supervisorPin.length < 4}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] py-3 text-sm font-black text-slate-950 transition disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {loading ? "Authorizing Return..." : `Authorize Return (NPR ${totalRefundAmount.toLocaleString("en-IN")})`}
              <ShieldCheck className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
