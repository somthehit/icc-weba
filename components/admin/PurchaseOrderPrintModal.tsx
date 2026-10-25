'use client';

import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  Share2,
  Mail,
  Send,
  CheckCircle2,
  Building2,
  Calendar,
  Truck,
  Check,
  QrCode,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';
import { formatDualDate } from '@/lib/nepal/date';

interface PurchaseOrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: any;
  onSendCommunication?: (poId: number, channel: 'email' | 'whatsapp', recipient: string) => Promise<void>;
}

export const PurchaseOrderPrintModal: React.FC<PurchaseOrderPrintModalProps> = ({
  isOpen,
  onClose,
  purchaseOrder,
  onSendCommunication,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [recipient, setRecipient] = useState(purchaseOrder?.supplierPhone || '');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState('');

  if (!isOpen || !purchaseOrder) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSend = async () => {
    if (!recipient) {
      alert('Please enter a phone number or email.');
      return;
    }

    setIsSending(true);
    setSendSuccessMessage('');
    try {
      if (onSendCommunication) {
        await onSendCommunication(purchaseOrder.id, channel, recipient);
      } else {
        const res = await fetch('/api/admin/inventory/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            poId: purchaseOrder.id,
            channel,
            recipient,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSendSuccessMessage(`PO successfully sent via ${channel.toUpperCase()}! Tracking token: ${data.communication?.trackingToken}`);
        } else {
          alert(`Failed to send: ${data.error}`);
        }
      }
    } catch {
      alert('Error sending communication.');
    } finally {
      setIsSending(false);
    }
  };

  // Safe line computations
  const lines = purchaseOrder.items || [];
  const subtotal = Number(purchaseOrder.subtotal || 0);
  const vatAmount = Number(purchaseOrder.vatAmount || 0);
  const totalAmount = Number(purchaseOrder.totalAmount || 0);
  const otherCharges = Number(purchaseOrder.otherCharges || 0);
  const discountAmount = Number(purchaseOrder.discountAmount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-hidden">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[95vh] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Top Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white">{purchaseOrder.poNumber}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                purchaseOrder.status === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {purchaseOrder.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Communication Bar (WhatsApp / Email Sender) */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Send to Supplier:</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <input
              type="text"
              placeholder={channel === 'whatsapp' ? 'e.g. 9801234567' : 'e.g. orders@supplier.com'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-48"
            />
            <button
              onClick={handleSend}
              disabled={isSending}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
            >
              <Send className="w-3 h-3" />
              <span>{isSending ? 'Sending...' : 'Send'}</span>
            </button>
          </div>

          {sendSuccessMessage && (
            <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
              <Check className="w-3 h-3" /> {sendSuccessMessage}
            </span>
          )}
        </div>

        {/* Printable Paper View (A4 White Canvas) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-3xl bg-white text-slate-900 rounded-xl p-8 sm:p-12 shadow-2xl space-y-6 print:shadow-none print:p-0 print:m-0 print:max-w-none text-xs leading-relaxed"
          >
            {/* Header: Company Info & PO Details */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">ICC COMPUTER & ELECTRONICS</h1>
                <p className="text-slate-600 text-xs mt-1">
                  Main Road, Hasanpur, Dhangadhi, Kailali, Nepal
                </p>
                <p className="text-slate-600 text-xs">
                  Phone: +977-91-521234 | Email: procurement@iccelectronics.com.np
                </p>
                <p className="text-slate-800 font-bold text-xs mt-1">
                  Company PAN / VAT No: <span className="font-mono">601298453</span>
                </p>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block px-3 py-1 bg-slate-100 rounded-md text-slate-800 font-bold font-mono text-sm border border-slate-200">
                  {purchaseOrder.poNumber}
                </span>
                <p className="text-slate-500 text-[11px] font-mono">Fiscal Year: {purchaseOrder.fiscalYear || '2082/83'}</p>
                <div className="mt-2 text-[11px] text-slate-600">
                  <div><strong>Order Date:</strong> {formatDualDate(purchaseOrder.orderDate)}</div>
                  <div><strong>Expected Delivery:</strong> {formatDualDate(purchaseOrder.expectedDeliveryDate || purchaseOrder.orderDate)}</div>
                </div>
              </div>
            </div>

            {/* Supplier & Delivery Info Grid */}
            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-500 mb-1">
                  Supplier / Vendor:
                </h3>
                <div className="font-bold text-sm text-slate-900">{purchaseOrder.supplierName}</div>
                <div className="text-slate-600 mt-0.5">
                  PAN / VAT: <strong className="font-mono text-slate-800">{purchaseOrder.supplierPan || 'N/A'}</strong>
                </div>
                <div className="text-slate-600">Phone: {purchaseOrder.supplierPhone || 'N/A'}</div>
                {purchaseOrder.supplierQuoteNo && (
                  <div className="text-slate-600 font-mono text-[11px] mt-1">
                    Quotation Ref: <strong>{purchaseOrder.supplierQuoteNo}</strong>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-500 mb-1">
                  Deliver-To & Commercial Terms:
                </h3>
                <div className="font-bold text-slate-900">{purchaseOrder.deliverToLocation || 'Main Store - Dhangadhi'}</div>
                <div className="text-slate-600 mt-0.5">
                  Payment Terms: <strong className="text-slate-800">{purchaseOrder.paymentTerms || 'Credit 30 Days'}</strong>
                </div>
                <div className="text-slate-600">Currency: {purchaseOrder.currency || 'NPR'}</div>
                {purchaseOrder.billingReference && (
                  <div className="text-slate-600 font-mono text-[11px] mt-1">
                    Billing Ref: {purchaseOrder.billingReference}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-8 text-center">S.N.</th>
                    <th className="py-2.5 px-3">Description & Specifications</th>
                    <th className="py-2.5 px-2 w-28">SKU / Code</th>
                    <th className="py-2.5 px-2 w-16 text-center">UoM</th>
                    <th className="py-2.5 px-2 w-16 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-24 text-right">Rate (Rs.)</th>
                    <th className="py-2.5 px-2 w-20 text-right">Disc.</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lines.map((it: any, idx: number) => (
                    <tr key={it.id || idx}>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {it.description || it.productName}
                        {it.requiresSerial && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[9px] border border-blue-200">
                            Serial Tracked
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-slate-600 text-[11px]">{it.sku}</td>
                      <td className="py-2.5 px-2 text-center text-slate-600">{it.unitOfMeasure || 'Pcs'}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 font-mono">{it.quantityOrdered}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                        {Number(it.unitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                        {Number(it.discountPercent || 0) > 0 ? `${it.discountPercent}%` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {Number(it.lineTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & In Words */}
            <div className="flex justify-between items-start pt-2">
              <div className="space-y-3 max-w-sm">
                {purchaseOrder.notes && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                    <div className="font-bold text-slate-700 mb-0.5">Terms & Instructions to Supplier:</div>
                    <div className="text-slate-600">{purchaseOrder.notes}</div>
                  </div>
                )}
                
                <div className="text-[11px] text-slate-500 space-y-1">
                  <div>1. Delivery must be accompanied by tax invoice & delivery challan.</div>
                  <div>2. Serialized equipment must have barcode serials listed on bill.</div>
                  <div>3. Payment will be disbursed strictly per agreed credit terms.</div>
                </div>
              </div>

              <div className="w-64 space-y-1.5 font-mono text-xs text-right">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>Rs. {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>- Rs. {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span>Taxable Amount:</span>
                  <span>Rs. {(subtotal - discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Nepal VAT (13%):</span>
                  <span>Rs. {vatAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {otherCharges > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Freight & Handling:</span>
                    <span>Rs. {otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t-2 border-slate-900">
                  <span>Grand Total:</span>
                  <span>Rs. {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Verification QR & Approval Stamp */}
            <div className="pt-8 border-t border-slate-200 flex justify-between items-end">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-slate-300 rounded-lg bg-white">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div className="text-[10px] text-slate-500">
                  <div className="font-bold text-slate-700">Digital Verification Token</div>
                  <div className="font-mono">{purchaseOrder.poNumber}</div>
                  <div>Scan to verify authenticity with IRD/ERP gateway</div>
                </div>
              </div>

              <div className="text-center space-y-1">
                {purchaseOrder.approvedByName ? (
                  <div className="p-3 border border-emerald-500/40 rounded-xl bg-emerald-50/50 text-emerald-800 text-[11px] mb-2 font-mono">
                    <ShieldCheck className="w-4 h-4 mx-auto text-emerald-600 mb-0.5" />
                    <strong>APPROVED & AUTHORIZED</strong>
                    <div>By: {purchaseOrder.approvedByName}</div>
                    <div className="text-[9px] text-emerald-600">
                      {purchaseOrder.approvedAt ? new Date(purchaseOrder.approvedAt).toLocaleString() : ''}
                    </div>
                  </div>
                ) : (
                  <div className="h-16 border-b border-slate-400 w-48 mx-auto" />
                )}
                <div className="text-xs font-bold text-slate-800">Authorized Signatory</div>
                <div className="text-[10px] text-slate-500">ICC Computer & Electronics</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
