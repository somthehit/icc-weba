'use client';

import React from 'react';
import { formatNepaliNumber } from '@/lib/nepal/money';
import { Printer, CheckCircle2, FileText, Banknote, ShieldAlert } from 'lucide-react';

export interface PrintablePaperEodProps {
  eodReference: string;
  businessDate: string;
  branch: string;
  registerCode: string;
  shiftNumber: string;
  cashierName: string;
  cashierCode?: string;
  openedAt?: string;
  submittedAt?: string;
  openingFloat: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  qrSales: number;
  bankTransferSales: number;
  creditSales: number;
  taxableAmount: number;
  vatAmount: number;
  discountAmount: number;
  refundsAmount: number;
  voidsCount: number;
  voidsAmount: number;
  totalTransactions: number;
  cashAdditions: number;
  cashPayouts: number;
  safeDrops: number;
  expectedClosingCash: number;
  envelopeSealNo?: string;
  physicalVouchersCount?: number;
  cashierNotes?: string;
  cashierDeclaration?: string;
  supervisorName?: string;
}

export default function PrintablePaperEodForm({
  eodReference,
  businessDate,
  branch,
  registerCode,
  shiftNumber,
  cashierName,
  cashierCode = 'EMP-101',
  openedAt,
  submittedAt,
  openingFloat,
  totalSales,
  cashSales,
  cardSales,
  qrSales,
  bankTransferSales,
  creditSales,
  taxableAmount,
  vatAmount,
  discountAmount,
  refundsAmount,
  voidsCount,
  voidsAmount,
  totalTransactions,
  cashAdditions,
  cashPayouts,
  safeDrops,
  expectedClosingCash,
  envelopeSealNo = 'ENV-PENDING',
  physicalVouchersCount = 0,
  cashierNotes,
  cashierDeclaration,
  supervisorName,
}: PrintablePaperEodProps) {
  const handlePrint = () => {
    window.print();
  };

  const formattedOpened = openedAt ? new Date(openedAt).toLocaleString() : 'N/A';
  const formattedSubmitted = submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString();

  return (
    <div className="bg-white text-slate-900 font-sans p-6 max-w-4xl mx-auto border border-slate-300 shadow-sm print:m-0 print:p-4 print:border-none print:shadow-none print:max-w-none">
      {/* Print Trigger Button (Hidden when printing) */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 no-print">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Official EOD Document
          </span>
          <h2 className="text-lg font-black text-slate-900 mt-1">Paper EOD Sales &amp; Cashier Handover Form</h2>
          <p className="text-xs text-slate-500">Print 2 copies: 1 for Accounts Envelope, 1 for Cashier Till Binder.</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer transition active:scale-95"
        >
          <Printer className="h-4 w-4" />
          <span>Print Official Paper Form (A4)</span>
        </button>
      </div>

      {/* DOCUMENT HEADER */}
      <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
        <h1 className="text-xl font-black tracking-tight uppercase text-slate-950">INTEL COMPUTER CENTER (ICC)</h1>
        <p className="text-xs font-semibold text-slate-600">Retail Electronics, IT Infrastructure &amp; Consumer Solutions</p>
        <p className="text-xs font-mono font-bold text-slate-800">Branch: {branch} • VAT Reg: 302456789</p>
        <div className="mt-2 inline-block px-4 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs font-black tracking-wider uppercase">
          RETAIL COUNTER END-OF-DAY (EOD) SALES &amp; TILL HANDOVER SUMMARY
        </div>
      </div>

      {/* REFERENCE & METADATA GRID */}
      <div className="grid grid-cols-2 gap-3 text-xs mb-4 p-3 bg-slate-50 border border-slate-300 rounded-lg">
        <div>
          <p><span className="font-bold text-slate-700">EOD Reference #:</span> <strong className="font-mono text-slate-950">{eodReference}</strong></p>
          <p><span className="font-bold text-slate-700">Business Date:</span> <strong className="font-mono">{businessDate}</strong></p>
          <p><span className="font-bold text-slate-700">Register Code:</span> <strong className="font-mono">{registerCode}</strong></p>
          <p><span className="font-bold text-slate-700">Shift Number:</span> <strong className="font-mono">{shiftNumber}</strong></p>
        </div>
        <div>
          <p><span className="font-bold text-slate-700">Cashier Name:</span> <strong>{cashierName} ({cashierCode})</strong></p>
          <p><span className="font-bold text-slate-700">Shift Opened At:</span> <span className="font-mono">{formattedOpened}</span></p>
          <p><span className="font-bold text-slate-700">Submitted At:</span> <span className="font-mono">{formattedSubmitted}</span></p>
          <p><span className="font-bold text-slate-700">Supervisor:</span> <strong>{supervisorName || 'Duty Supervisor'}</strong></p>
        </div>
      </div>

      {/* SECTION 1: POS SALES TOTALS BY PAYMENT METHOD */}
      <div className="mb-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 bg-slate-200 px-3 py-1.5 border-l-4 border-emerald-600">
          1. POS Sales &amp; Tender Breakdown (Computer Recorded)
        </h3>
        <table className="w-full text-xs border border-slate-300 border-collapse mt-1">
          <thead>
            <tr className="bg-slate-100 text-left border-b border-slate-300 font-bold">
              <th className="p-2 border-r border-slate-300">Payment Tender Method</th>
              <th className="p-2 border-r border-slate-300 text-right">Transactions</th>
              <th className="p-2 border-r border-slate-300 text-right">System Recorded Amount (NPR)</th>
              <th className="p-2 text-right">Accounting Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="p-2 font-bold border-r border-slate-300">Cash Collections (Till Bills)</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono">—</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono font-bold">Rs. {cashSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td className="p-2 text-right font-mono text-slate-600">1000 - Petty Cash Till</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-300">Card (EDC Terminal / SCT / Visa)</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono">—</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono font-bold">Rs. {cardSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td className="p-2 text-right font-mono text-slate-600">1010 - Bank Card Clearing</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-300">Dynamic QR (Fonepay / eSewa / Khalti)</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono">—</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono font-bold">Rs. {qrSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td className="p-2 text-right font-mono text-slate-600">1020 - Mobile Wallet Transit</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-300">Direct Bank Transfer / ConnectIPS</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono">—</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono font-bold">Rs. {bankTransferSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td className="p-2 text-right font-mono text-slate-600">1030 - Primary Operating Bank</td>
            </tr>
            <tr>
              <td className="p-2 font-bold border-r border-slate-300">Credit / Account Receivables</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono">—</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono font-bold">Rs. {creditSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td className="p-2 text-right font-mono text-slate-600">1100 - Accounts Receivable</td>
            </tr>
            <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
              <td className="p-2 border-r border-slate-300">TOTAL GROSS POS REVENUE</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono">{totalTransactions} bills</td>
              <td className="p-2 text-right border-r border-slate-300 font-mono text-sm text-emerald-900">
                Rs. {totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-2 text-right font-mono text-slate-600">4000 - Retail Sales Rev</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 2: STATUTORY 13% VAT & ADJUSTMENTS */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-300 p-2.5 rounded text-xs">
          <p className="font-bold border-b border-slate-200 pb-1 mb-1 text-slate-800">Statutory Tax &amp; Deductions</p>
          <div className="flex justify-between py-0.5"><span>Net Taxable Sales:</span><strong className="font-mono">Rs. {taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between py-0.5"><span>13% Nepal Statutory VAT:</span><strong className="font-mono text-rose-800">Rs. {vatAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between py-0.5"><span>Total Discounts Given:</span><strong className="font-mono">Rs. {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
        </div>
        <div className="border border-slate-300 p-2.5 rounded text-xs">
          <p className="font-bold border-b border-slate-200 pb-1 mb-1 text-slate-800">Audited Voids &amp; Refunds</p>
          <div className="flex justify-between py-0.5"><span>Refunds &amp; Returns Amount:</span><strong className="font-mono text-rose-700">Rs. {refundsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between py-0.5"><span>Authorized Void Count:</span><strong className="font-mono">{voidsCount} items</strong></div>
          <div className="flex justify-between py-0.5"><span>Voided Items Value:</span><strong className="font-mono">Rs. {voidsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
        </div>
      </div>

      {/* SECTION 3: EXPECTED CASH RECONCILIATION */}
      <div className="mb-4 bg-emerald-50/60 border border-emerald-300 p-3 rounded-lg text-xs">
        <h4 className="font-black text-emerald-950 uppercase tracking-wide border-b border-emerald-200 pb-1 mb-2">
          2. Expected Cash Drawer Balance (Retail Accounting Rule)
        </h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex justify-between"><span>(+) Opening Float (BOD):</span><strong className="font-mono">Rs. {openingFloat.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between"><span>(+) Cash Sales Received:</span><strong className="font-mono">Rs. {cashSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between"><span>(+) Cash Additions (Paid In):</span><strong className="font-mono">Rs. {cashAdditions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between"><span>(-) Petty Cash Payouts:</span><strong className="font-mono text-rose-800">Rs. {cashPayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between"><span>(-) Safe Drops to Cash Office:</span><strong className="font-mono text-rose-800">Rs. {safeDrops.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          <div className="flex justify-between"><span>(-) Cash Refunds:</span><strong className="font-mono text-rose-800">Rs. {refundsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
        </div>
        <div className="mt-2 pt-2 border-t border-emerald-300 flex justify-between items-center text-sm font-black text-emerald-900">
          <span>EXPECTED CLOSING CASH TO BE SURRENDERED IN ENVELOPE:</span>
          <span className="font-mono text-base">Rs. {expectedClosingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* SECTION 4: CASHIER DECLARATION & HANDOVER PACKAGE */}
      <div className="mb-4 border border-slate-300 p-3 rounded-lg text-xs">
        <div className="flex justify-between items-center border-b border-slate-200 pb-1 mb-2">
          <span className="font-bold text-slate-800 uppercase">3. Cashier Envelope &amp; Handover Declaration</span>
          <span className="font-mono font-bold text-slate-900">Envelope Seal Tag: <strong className="text-emerald-800">{envelopeSealNo}</strong> • Vouchers Count: <strong className="text-emerald-800">{physicalVouchersCount}</strong></span>
        </div>
        <p className="italic text-slate-700 leading-relaxed">
          &ldquo;{cashierDeclaration || `I hereby declare that the POS sales and tender totals presented above represent a true and complete record of retail transactions during my shift. All physical cash notes, card EDC slips, and expense vouchers are securely enclosed in Envelope ${envelopeSealNo} for verification by the Accounts Department.`}&rdquo;
        </p>
        {cashierNotes && (
          <p className="mt-1 text-slate-600 font-medium"><span className="font-bold">Cashier Handover Notes:</span> {cashierNotes}</p>
        )}
        <div className="mt-6 pt-3 border-t border-slate-300 grid grid-cols-2 gap-8">
          <div>
            <div className="border-b border-slate-400 h-8"></div>
            <p className="mt-1 font-bold text-slate-800">Cashier Signature: {cashierName}</p>
            <p className="text-[10px] text-slate-500 font-mono">Date &amp; Time: {formattedSubmitted}</p>
          </div>
          <div>
            <div className="border-b border-slate-400 h-8"></div>
            <p className="mt-1 font-bold text-slate-800">Duty Supervisor Witness: {supervisorName || 'Duty Supervisor'}</p>
            <p className="text-[10px] text-slate-500 font-mono">Status: Register Closed &amp; Locked</p>
          </div>
        </div>
      </div>

      {/* SECTION 5: ACCOUNTANT VERIFICATION & PHYSICAL DENOMINATION COUNT (TO BE COMPLETED BY ACCOUNTANT) */}
      <div className="border-2 border-slate-900 p-3 rounded-lg bg-amber-50/40 text-xs">
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1.5 mb-2.5">
          <span className="font-black text-slate-950 uppercase tracking-wide text-xs">
            4. ACCOUNTANT PHYSICAL CASH DENOMINATIONS &amp; VERIFICATION (भौतिक गणना र रुजु फाँट)
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
            Accountant-Completed Section Only
          </span>
        </div>

        {/* Receipt confirmation fields */}
        <div className="grid grid-cols-3 gap-3 mb-3 p-2 bg-white border border-slate-300 rounded">
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Received In Cash Office By:</span>
            <span className="block font-bold text-slate-800 border-b border-slate-300 h-5 mt-0.5"></span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Received Date &amp; Time:</span>
            <span className="block font-bold text-slate-800 border-b border-slate-300 h-5 mt-0.5"></span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Envelope Seal Intact:</span>
            <span className="block font-bold text-slate-800 mt-1">[  ] YES, INTACT    [  ] COMPROMISED</span>
          </div>
        </div>

        {/* Physical Denominations Table for Accountant */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <table className="w-full text-xs border border-slate-300 bg-white">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-1.5 border-r border-slate-300 text-left">Denomination</th>
                <th className="p-1.5 border-r border-slate-300 text-center">Physical Count</th>
                <th className="p-1.5 text-right">Counted Amount (NPR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 1,000</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 500</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 100</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 50</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 20</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
            </tbody>
          </table>

          <table className="w-full text-xs border border-slate-300 bg-white">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-1.5 border-r border-slate-300 text-left">Denomination</th>
                <th className="p-1.5 border-r border-slate-300 text-center">Physical Count</th>
                <th className="p-1.5 text-right">Counted Amount (NPR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 10</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 5</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 2</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr><td className="p-1.5 font-bold border-r border-slate-300">NPR 1</td><td className="p-1.5 text-center border-r border-slate-300">___________</td><td className="p-1.5 text-right">___________</td></tr>
              <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                <td colSpan={2} className="p-1.5 border-r border-slate-300 font-bold">TOTAL PHYSICAL CASH COUNTED:</td>
                <td className="p-1.5 text-right font-mono font-bold text-slate-900">Rs. ___________</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Verification Lines */}
        <div className="p-2.5 bg-white border border-slate-300 rounded mb-3 space-y-1.5">
          <p className="font-bold text-slate-800 text-[11px] uppercase border-b border-slate-200 pb-1">Payment Tender Settlement Verification</p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div><span>Card Batch #: ________________</span></div>
            <div><span>Verified Card Slip Total: Rs. ____________</span></div>
            <div><span>Card Diff: Rs. ____________</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div><span>QR Settlement Ref: ________________</span></div>
            <div><span>Verified QR Total: Rs. ____________</span></div>
            <div><span>QR Diff: Rs. ____________</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div><span>Bank Statement Advice: ________________</span></div>
            <div><span>Verified Bank Total: Rs. ____________</span></div>
            <div><span>Bank Diff: Rs. ____________</span></div>
          </div>
        </div>

        {/* Expected vs Actual & Variance Calculation */}
        <div className="p-2.5 bg-white border-2 border-slate-800 rounded mb-3">
          <div className="grid grid-cols-3 gap-3 text-xs font-bold items-center">
            <div>Expected Cash: <span className="font-mono">Rs. {expectedClosingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            <div>Actual Cash Counted: <span className="font-mono">Rs. ______________</span></div>
            <div>
              Cash Variance: <span className="font-mono">Rs. ______________</span>
              <span className="block text-[10px] text-slate-500 font-normal">[  ] BALANCED  [  ] OVERAGE  [  ] SHORTAGE</span>
            </div>
          </div>
          <div className="mt-2 text-xs">
            <span className="font-bold text-slate-800">Accountant Variance Remarks / Discrepancy Note:</span>
            <div className="border-b border-slate-300 h-6 mt-1"></div>
          </div>
        </div>

        {/* Accountant Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-2">
          <div>
            <div className="border-b border-slate-400 h-7"></div>
            <p className="mt-1 font-bold text-slate-800">Reconciled by Accountant (Name &amp; Signature)</p>
            <p className="text-[10px] text-slate-500 font-mono">Date: ________________________</p>
          </div>
          <div>
            <div className="border-b border-slate-400 h-7"></div>
            <p className="mt-1 font-bold text-slate-800">Final EOD Approval / Finance Manager</p>
            <p className="text-[10px] text-slate-500 font-mono">Date: ________________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
