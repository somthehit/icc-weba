// components/admin/inventory/LabelPrintModal.tsx
// Modal for generating and printing single/batch barcode labels and shelf-bin stickers

'use client';

import React, { useState } from 'react';
import { Printer, X, Barcode, Check, Layers, Copy } from 'lucide-react';
import { generatePrintableLabelHtml, generateBarcodeSvg } from '@/lib/barcode/engine';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: {
    name: string;
    sku: string;
    barcode?: string;
    price?: number;
    category?: string;
  } | null;
  binCode?: string;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  isOpen,
  onClose,
  product,
  binCode,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [serialNumber, setSerialNumber] = useState('');
  const [customBin, setCustomBin] = useState(binCode || 'WH1-Z-A-R01-S1-B01');

  if (!isOpen) return null;

  const sku = product?.sku || 'SKU-SAMPLE';
  const name = product?.name || 'Sample Hardware Item';
  const barcode = product?.barcode || sku;
  const price = product?.price || 1500;

  const handlePrint = () => {
    const html = generatePrintableLabelHtml({
      productName: name,
      sku,
      barcode,
      price,
      serialNumber: serialNumber.trim() || undefined,
      binLocation: customBin.trim() || undefined,
      quantity,
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Print Barcode / Bin Label</h3>
              <p className="text-[11px] text-slate-400 font-mono">Standard 50mm x 30mm Label Sheet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Card */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-inner flex flex-col items-center text-center">
            <div className="text-[9px] font-black tracking-wider text-slate-600 uppercase">
              INTEL COMPUTER CENTER
            </div>
            <div className="text-xs font-bold text-slate-900 line-clamp-1 mt-0.5">{name}</div>
            <div className="flex items-center justify-between w-full text-[10px] font-mono font-semibold px-2 mt-1 text-slate-700">
              <span>SKU: {sku}</span>
              <span>BIN: {customBin}</span>
            </div>
            <div
              className="my-1.5 w-full flex justify-center"
              dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(barcode, 36, 180) }}
            />
            {serialNumber && (
              <div className="text-[10px] font-mono font-bold text-emerald-700">
                S/N: {serialNumber}
              </div>
            )}
            <div className="flex items-center justify-between w-full border-t border-slate-300 pt-1 mt-1 text-[11px] font-extrabold text-slate-900">
              <span className="text-[9px] text-slate-500 font-normal">NPR (Incl. VAT)</span>
              <span>Rs. {Number(price).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Form Options */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Print Copies (Qty)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Shelf Bin Tag</label>
                <input
                  type="text"
                  value={customBin}
                  onChange={(e) => setCustomBin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Serial Number</label>
              <input
                type="text"
                placeholder="e.g. SN-DELL-894101 (leave empty for general SKU batch)"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {quantity} Label(s)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
