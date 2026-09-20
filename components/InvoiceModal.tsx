'use client';

import React, { useState, useRef } from 'react';
import { Order, PaymentMethod } from '@/types';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  QrCode, 
  ShieldCheck, 
  CreditCard, 
  Banknote, 
  Smartphone,
  Landmark,
  Share2,
  Check
} from 'lucide-react';
import { STORE_INFO, INITIAL_SITE_SETTINGS } from '@/lib/data/initial-data';

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  initialPaidStatus?: boolean;
}

/**
 * Converts a number to English words for Nepali currency representation.
 */
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  if (isNaN(num)) return '';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  const rounded = Math.round(num);
  return 'Nepali Rupees ' + inWords(rounded) + ' Only';
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  order,
  isOpen,
  onClose,
  initialPaidStatus
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Allow toggling paid status for COD orders to manage & preview both paid/unpaid state
  const isInitiallyPaid = initialPaidStatus !== undefined 
    ? initialPaidStatus 
    : order?.paymentStatus === 'paid' || order?.paymentStatus === 'verified' || order?.status === 'delivered';

  const [isPaid, setIsPaid] = useState(isInitiallyPaid);

  if (!isOpen || !order) return null;

  const invoiceNo = `INV-${order.id.replace(/[^A-Za-z0-9]/g, '')}`;
  const invoiceDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = invoiceDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const formattedTime = invoiceDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const subtotal = order.subtotal || order.totalAmount;
  const discount = order.discountAmount || 0;
  const shippingFee = order.shippingFee || 0;
  const grandTotal = order.totalAmount;

  // 13% VAT breakdown (tax-inclusive pricing standard in Nepal)
  const taxableAmount = Math.round((grandTotal / 1.13) * 100) / 100;
  const vatAmount = Math.round((grandTotal - taxableAmount) * 100) / 100;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/track-order?ref=${order.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Payment method descriptive labels & icons
  const getPaymentDetails = (method: PaymentMethod, paid: boolean) => {
    switch (method) {
      case 'esewa':
        return {
          title: 'eSewa Mobile Wallet',
          badge: 'eSewa Digital',
          icon: Smartphone,
          account: 'eSewa ID: 9848424859 (Intel Computer Center)',
          note: paid 
            ? 'Verified & Settled via eSewa Digital Payment Gateway.' 
            : 'Payment verification pending. eSewa ID: 9848424859.',
          color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
        };
      case 'khalti':
        return {
          title: 'Khalti / Fonepay QR',
          badge: 'Fonepay / Khalti QR',
          icon: QrCode,
          account: 'Merchant: Intel Computer Center (9848424859)',
          note: paid 
            ? 'Verified & Settled via Fonepay / Khalti Merchant Network.' 
            : 'Instant QR Scan payment pending merchant confirmation.',
          color: 'text-purple-700 bg-purple-50 border-purple-300',
        };
      case 'bank_transfer':
        return {
          title: 'Direct Bank Wire / Banking',
          badge: 'Bank Transfer',
          icon: Landmark,
          account: 'A/C: Intel Computer Center | Bank: Global IME Bank, Dhangadhi Branch',
          note: paid 
            ? 'Bank wire transfer confirmed & credited to store account.' 
            : 'Pending bank wire clearance / deposit slip verification.',
          color: 'text-blue-700 bg-blue-50 border-blue-300',
        };
      case 'cod':
      default:
        return {
          title: 'Cash on Delivery (COD)',
          badge: 'COD Express',
          icon: Banknote,
          account: 'Courier Cash Collection / Rider Handover',
          note: paid 
            ? 'Cash payment collected upon package handover by delivery rider.' 
            : `Amount of NPR ${grandTotal.toLocaleString()} to be collected in cash or via mobile QR by rider on delivery.`,
          color: paid 
            ? 'text-emerald-700 bg-emerald-50 border-emerald-300' 
            : 'text-amber-700 bg-amber-50 border-amber-300',
        };
    }
  };

  const paymentInfo = getPaymentDetails(order.paymentMethod, isPaid);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      {/* Container Dialog */}
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top Floating Action Bar (Hidden during window.print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Official Nepal Tax Invoice
                <span className="text-[10px] bg-blue-500/30 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono">
                  {invoiceNo}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Print or download VAT-compliant tax receipt for personal or corporate claims.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* COD Payment Status Toggle (Useful for managing/previewing COD payment states) */}
            {order.paymentMethod === 'cod' && (
              <button
                type="button"
                onClick={() => setIsPaid(!isPaid)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                  isPaid
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900'
                    : 'bg-amber-950 text-amber-300 border-amber-600/50 hover:bg-amber-900'
                }`}
                title="Toggle COD payment collection status"
              >
                {isPaid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>COD: Paid & Collected</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>COD: Due on Delivery</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1.5 rounded-xl transition-colors ml-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100/70 print:p-0 print:bg-white print:overflow-visible">
          <div 
            ref={invoiceRef}
            id="printable-invoice"
            className="bg-white max-w-3xl mx-auto p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-6 print:max-w-none text-slate-800 text-xs font-sans space-y-6 relative"
          >
            {/* Background Watermark Stamp for Paid / COD */}
            <div className="absolute right-10 top-24 pointer-events-none select-none opacity-85 print:opacity-90">
              {isPaid ? (
                <div className="border-4 border-emerald-600 text-emerald-600 rounded-2xl px-5 py-2.5 font-black text-center uppercase tracking-widest rotate-[-10deg] shadow-sm bg-emerald-50/70 backdrop-blur-xs">
                  <div className="text-xl leading-none">PAID & VERIFIED</div>
                  <div className="text-[9px] tracking-normal font-mono mt-1 text-emerald-700">
                    INTEL COMPUTER CENTER • DHANGADHI
                  </div>
                  <div className="text-[8px] tracking-normal font-mono text-emerald-600">
                    {formattedDate} • 100% GENUINE
                  </div>
                </div>
              ) : (
                <div className="border-4 border-amber-600 text-amber-600 rounded-2xl px-5 py-2.5 font-black text-center uppercase tracking-widest rotate-[-10deg] shadow-sm bg-amber-50/70 backdrop-blur-xs">
                  <div className="text-xl leading-none">CASH ON DELIVERY</div>
                  <div className="text-[9px] tracking-normal font-mono mt-1 text-amber-700">
                    PAYABLE TO COURIER RIDER
                  </div>
                  <div className="text-[8px] tracking-normal font-mono text-amber-600">
                    NPR {grandTotal.toLocaleString()} DUE AT DOORSTEP
                  </div>
                </div>
              )}
            </div>

            {/* 1. Header: Store Logo & Details */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#0056b3] text-white flex items-center justify-center font-black text-lg shadow-sm">
                      IC
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-[#0056b3] tracking-tight">
                        {STORE_INFO.name}
                      </h1>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Authorized IT Solutions & Hardware Outlet — Sudurpashchim
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{INITIAL_SITE_SETTINGS.address}, Kailali, Nepal</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Tel: <strong>{INITIAL_SITE_SETTINGS.phone}</strong> | Mobile/WhatsApp: <strong>{INITIAL_SITE_SETTINGS.whatsappNumber}</strong></span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Email: {INITIAL_SITE_SETTINGS.email} | Web: {STORE_INFO.domain}</span>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="inline-block bg-[#0056b3] text-white font-extrabold text-xs px-3 py-1 rounded-md uppercase tracking-wider">
                    TAX INVOICE / कर बीजक
                  </div>
                  <div className="text-[11px] font-mono text-slate-700 pt-1">
                    <div><strong>PAN/VAT No:</strong> <span className="font-bold text-blue-900">{STORE_INFO.vatPanNumber}</span></div>
                    <div><strong>Invoice No:</strong> {invoiceNo}</div>
                    <div><strong>Date:</strong> {formattedDate} {formattedTime}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Bill To & Shipping Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Billed & Delivered To (ग्राहकको विवरण):
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {order.shippingAddress?.fullName || order.customerName}
                </p>
                <p className="text-slate-600 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{order.shippingAddress?.phone || order.customerPhone}</span>
                </p>
                {(order.customerEmail || order.shippingAddress?.email) && (
                  <p className="text-slate-600 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{order.customerEmail || order.shippingAddress?.email}</span>
                  </p>
                )}
                <p className="text-slate-600 flex items-start gap-1 pt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    {order.shippingAddress?.addressLine || 'Ratopool'}, Ward {order.shippingAddress?.ward || '5'}, {order.shippingAddress?.municipality || 'Dhangadhi'}, {order.shippingAddress?.district || 'Kailali'}, {order.shippingAddress?.province || 'Sudurpashchim Province'}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Order & Transaction Reference:
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Ref:</span>
                  <span className="font-mono font-bold text-slate-900">{order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-bold text-blue-800 uppercase">{paymentInfo.title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    isPaid 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {isPaid ? 'PAID / VERIFIED' : 'DUE ON DELIVERY (COD)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dispatch Hub:</span>
                  <span className="font-medium text-slate-700">Dhangadhi Central Hub</span>
                </div>
              </div>
            </div>

            {/* 3. Payment Method Specific Informational Callout */}
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${paymentInfo.color}`}>
              <paymentInfo.icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-xs flex items-center gap-2">
                  <span>{paymentInfo.title}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded font-mono font-semibold bg-white/60">
                    {paymentInfo.badge}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {paymentInfo.note}
                </p>
                <div className="text-[10px] font-mono opacity-80 pt-0.5">
                  {paymentInfo.account}
                </div>
              </div>
            </div>

            {/* 4. Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[11px]">
                    <th className="p-2.5 w-10 text-center">S.N.</th>
                    <th className="p-2.5">Item Description & Specifications</th>
                    <th className="p-2.5 text-center w-16">Qty</th>
                    <th className="p-2.5 text-right w-24">Rate (NPR)</th>
                    <th className="p-2.5 text-right w-28">Total (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px]">
                  {order.items.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        {it.sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</div>}
                        <div className="text-[10px] text-blue-600 font-medium">✓ Official Manufacturer Warranty Included</div>
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-800">{it.quantity}</td>
                      <td className="p-2.5 text-right font-mono">{it.price.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {(it.price * it.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 5. Financial Calculation & Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Left Side: Amount in Words & Terms */}
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Amount in Words (अक्षरेपी):
                  </span>
                  <p className="font-bold text-slate-800 text-xs italic">
                    {numberToWords(grandTotal)}
                  </p>
                </div>

                <div className="text-[10px] text-slate-500 space-y-1 leading-normal">
                  <p className="font-bold text-slate-700">Terms & Warranty Conditions:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[9.5px]">
                    <li>All brand products carry authorized distributor manufacturer warranty.</li>
                    <li>For warranty claims and chip-level servicing, present this original invoice copy at our store in Ratopool, Dhangadhi (Tel: 091-525287).</li>
                    <li>Items once sold can be returned/exchanged within 7 days in original sealed condition as per store policy.</li>
                  </ul>
                </div>
              </div>

              {/* Right Side: Totals and Tax Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-semibold">NPR {subtotal.toLocaleString()}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700 font-semibold">
                    <span>Promotional Discount:</span>
                    <span className="font-mono">- NPR {discount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Shipping & Delivery Fee:</span>
                  <span className="font-mono font-semibold">
                    {shippingFee === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `NPR ${shippingFee.toLocaleString()}`}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500 text-[11px]">
                  <span>Taxable Base Amount (Exclusive):</span>
                  <span className="font-mono">NPR {taxableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500 text-[11px]">
                  <span>13% VAT (Inclusive as per Nepal Law):</span>
                  <span className="font-mono">NPR {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-center py-2.5 px-3 bg-blue-50/80 rounded-xl border border-blue-200 text-slate-900 mt-2">
                  <div className="font-extrabold text-sm">
                    Grand Total (जम्मा रकम):
                  </div>
                  <div className="font-black text-base text-[#0056b3] font-mono">
                    NPR {grandTotal.toLocaleString()}
                  </div>
                </div>

                {/* Amount Due Indicator for COD */}
                {!isPaid && order.paymentMethod === 'cod' && (
                  <div className="flex justify-between items-center py-1.5 px-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
                    <span className="font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Net Amount to Pay on Handover:
                    </span>
                    <span className="font-mono font-black text-amber-700">
                      NPR {grandTotal.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Invoice Footer & Signatures */}
            <div className="border-t border-slate-200 pt-6 mt-6 flex flex-col sm:flex-row justify-between items-end gap-6 text-[10px] text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-slate-100 p-1 border rounded-lg flex items-center justify-center">
                  {/* Decorative QR code representing invoice hash */}
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div className="space-y-0.5 font-mono">
                  <div className="font-bold text-slate-800 text-[11px]">Digital Invoice Hash</div>
                  <div>ID: {order.id}</div>
                  <div>Verify: www.intelcomputer.com.np</div>
                </div>
              </div>

              <div className="text-center sm:text-right space-y-1 w-full sm:w-auto">
                <div className="h-10 border-b border-dashed border-slate-400 w-48 ml-auto" />
                <div className="font-bold text-slate-800">Authorized Signatory</div>
                <div className="text-[9px] text-slate-400">Intel Computer Center — Ratopool, Dhangadhi</div>
              </div>
            </div>

            <div className="text-center pt-2 text-[9px] text-slate-400 border-t border-slate-100">
              This is a computer-generated official commercial tax invoice issued by Intel Computer Center.
            </div>
          </div>
        </div>

        {/* Bottom Modal Actions (Hidden in Print) */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center print:hidden shrink-0">
          <div className="text-xs text-slate-500">
            Need changes to this invoice? Contact <span className="font-bold text-blue-700">091-525287</span> or <span className="font-bold text-blue-700">iccdhangadhi@gmail.com</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl border border-slate-300 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-5 rounded-xl shadow flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Tax Invoice</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
