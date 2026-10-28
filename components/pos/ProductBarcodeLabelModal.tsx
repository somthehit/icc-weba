'use client';

import React, { useState } from 'react';
import {
  Printer,
  X,
  Copy,
  Check,
  Tag,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ProductItem } from './CounterPosTerminal';
import {
  format16DigitBarcode,
  generate16DigitBarcodeSvg,
  generate16DigitPrintableLabelHtml,
  is16DigitBarcode,
  generate16DigitBarcode,
} from '@/lib/barcode/barcode16';
import { formatNepaliNumber } from '@/lib/nepal/money';

interface ProductBarcodeLabelModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductBarcodeLabelModal({
  product,
  isOpen,
  onClose,
}: ProductBarcodeLabelModalProps) {
  const [labelQty, setLabelQty] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !product) return null;

  // Ensure barcode is always 16 digits
  const rawBarcode =
    product.barcode && /^\d{16}$/.test(product.barcode.trim())
      ? product.barcode.trim()
      : generate16DigitBarcode(product.id || product.sku);

  const formattedBarcode = format16DigitBarcode(rawBarcode);
  const barcodeSvgHtml = generate16DigitBarcodeSvg(rawBarcode, 46, 230);
  const formattedPrice = `Rs. ${formatNepaliNumber(String(product.price))}`;

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(rawBarcode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    setIsPrinting(true);
    const printHtml = generate16DigitPrintableLabelHtml({
      productName: product.name,
      sku: product.sku,
      barcode: rawBarcode,
      price: product.price,
      brand: product.brandName,
      category: product.categoryName,
      quantity: labelQty,
    });

    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
    } else {
      // Fallback if popup blocked
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
      }
    }
    setTimeout(() => setIsPrinting(false), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 my-8 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                16-Digit Retail Barcode
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                SKU: {product.sku}
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1 line-clamp-2 leading-snug">
              {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Thermal Sticker Preview Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Thermal Sticker Label Preview (50mm × 30mm)</span>
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Scannable Code 128-C
            </span>
          </div>

          <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex justify-center">
            {/* The actual label card */}
            <div className="w-[300px] bg-white border border-slate-300 rounded-lg p-3 shadow-md space-y-1.5 text-center select-none">
              <div className="flex justify-between items-center text-[9px] font-black tracking-wider uppercase text-slate-800 border-b border-slate-200 pb-1">
                <span>INTEL COMPUTER CENTER</span>
                <span className="text-[8px] text-slate-500 font-semibold">JAULAKHEL</span>
              </div>

              <div className="text-[11px] font-black text-slate-900 line-clamp-2 leading-tight text-left pt-0.5">
                {product.name}
              </div>

              <div className="flex justify-between items-center text-[9px] font-mono font-bold text-slate-600">
                <span>SKU: {product.sku}</span>
                {product.brandName && <span>{product.brandName}</span>}
              </div>

              {/* High Contrast Barcode SVG */}
              <div
                className="py-1 flex justify-center"
                dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }}
              />

              <div className="flex justify-between items-baseline border-t border-slate-800 pt-1 text-slate-900">
                <span className="text-[8px] font-bold text-slate-600">MRP (INCL. 13% VAT)</span>
                <span className="text-xs font-black font-mono">{formattedPrice}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 16-Digit Barcode Details & Quick Copy */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assigned 16-Digit Number
            </span>
            <button
              onClick={handleCopyBarcode}
              type="button"
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs transition"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600 stroke-[3]" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy Barcode
                </>
              )}
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-base font-black text-slate-900 tracking-wider">
              {formattedBarcode}
            </p>
            <span className="text-[10px] font-mono text-slate-500">
              Raw: {rawBarcode}
            </span>
          </div>
        </div>

        {/* Print Settings: Quantity */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 block">Print Copies</label>
            <p className="text-[11px] text-slate-500">
              Available Stock: {product.stockQuantity} pcs
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 5, 10].map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => setLabelQty(qty)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  labelQty === qty
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {qty}
              </button>
            ))}
            {product.stockQuantity > 0 && product.stockQuantity !== 1 && product.stockQuantity !== 2 && product.stockQuantity !== 5 && product.stockQuantity !== 10 && (
              <button
                type="button"
                onClick={() => setLabelQty(product.stockQuantity)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                  labelQty === product.stockQuantity
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Match current stock quantity"
              >
                All ({product.stockQuantity})
              </button>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-[2] py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>
              {isPrinting ? 'Opening Print Dialog...' : `Print ${labelQty} Barcode ${labelQty === 1 ? 'Label' : 'Labels'}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
