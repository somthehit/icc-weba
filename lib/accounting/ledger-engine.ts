/**
 * lib/accounting/ledger-engine.ts
 *
 * The Core Double-Entry Ledger Engine for Nepal Retail ERP.
 * Enforces balanced debits & credits, immutability, and automatic posting
 * across POS, E-commerce, Inventory, Procurement, and Cash Management.
 */

import { db } from '@/db';
import { journalEntries, journalLines, fiscalPeriods } from '@/db/schema';
import { getAccountMap, ACCOUNT_CODES } from './chart-of-accounts';
import { eq, and, sql } from 'drizzle-orm';
import { adToBs } from '@/lib/nepal/date';

export interface LedgerLineInput {
  accountCode: string; // e.g. "1010", "4010"
  description?: string;
  debit?: number;
  credit?: number;
}

export interface PostJournalOptions {
  entryNumber: string;
  entryDate: string; // YYYY-MM-DD
  description: string;
  sourceType: 'pos_sale' | 'ecom_order' | 'grn' | 'supplier_bill' | 'supplier_payment' | 'stock_adjustment' | 'damage_write_off' | 'cash_drop' | 'petty_cash' | 'eod_variance' | 'manual' | 'ecom_settlement';
  sourceId?: string | null;
  postedBy?: string | null;
  attachmentUrl?: string | null;
  lines: LedgerLineInput[];
}

/**
 * Validates and posts a balanced double-entry journal entry to the General Ledger.
 * Throws if debits and credits do not balance or if fiscal period is locked.
 */
export async function postDoubleEntryJournal(
  options: PostJournalOptions,
  client = db,
) {
  const { entryNumber, entryDate, description, sourceType, sourceId, postedBy, attachmentUrl, lines } = options;

  // 1. Check Fiscal Period Lock
  const bsMeta = adToBs(entryDate);
  const [lockedPeriod] = await client
    .select({ id: fiscalPeriods.id, isLocked: fiscalPeriods.isLocked })
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.fiscalYear, bsMeta.fiscalYear),
        eq(fiscalPeriods.periodNumber, bsMeta.fiscalPeriod),
        eq(fiscalPeriods.isLocked, true),
      ),
    )
    .limit(1);

  if (lockedPeriod) {
    throw new Error(`Cannot post journal entry: Fiscal Period ${bsMeta.monthName} ${bsMeta.fiscalYear} is LOCKED.`);
  }

  // 2. Validate Debits and Credits
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const d = Number(line.debit || 0);
    const c = Number(line.credit || 0);
    if (d > 0 && c > 0) {
      throw new Error(`Line for account ${line.accountCode} cannot have both debit and credit.`);
    }
    totalDebit += d;
    totalCredit += c;
  }

  const discrepancy = Math.abs(totalDebit - totalCredit);
  if (discrepancy > 0.005 || totalDebit <= 0) {
    throw new Error(
      `Unbalanced journal entry: Total Debit (NPR ${totalDebit.toFixed(2)}) != Total Credit (NPR ${totalCredit.toFixed(2)}). Discrepancy: ${discrepancy.toFixed(4)}`,
    );
  }

  // 3. Check for Idempotency
  const [existing] = await client
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.entryNumber, entryNumber))
    .limit(1);

  if (existing) {
    return { id: existing.id, isDuplicate: true };
  }

  // 4. Resolve Account Codes to Account IDs
  const accountMap = await getAccountMap();

  // 5. Execute DB Transaction
  return await client.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        entryNumber,
        entryDate,
        description,
        sourceType,
        sourceId: sourceId || null,
        attachmentUrl: attachmentUrl || null,
        postedBy: postedBy || null,
      })
      .returning({ id: journalEntries.id });

    const journalLineRows = lines
      .filter((l) => (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0))
      .map((line) => {
        const accountId = accountMap.get(line.accountCode);
        if (!accountId) {
          throw new Error(`Account code ${line.accountCode} not found in Chart of Accounts.`);
        }
        return {
          journalEntryId: entry.id,
          accountId,
          description: line.description || description,
          debit: String(Number(line.debit || 0).toFixed(2)),
          credit: String(Number(line.credit || 0).toFixed(2)),
        };
      });

    await tx.insert(journalLines).values(journalLineRows);

    return { id: entry.id, isDuplicate: false };
  });
}

/**
 * Auto-Post POS Counter Sale / E-Commerce Order
 */
export async function postSalesJournal(params: {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  channel: 'POS' | 'ECOM';
  totalAmount: number;
  vatAmount: number;
  discountAmount?: number;
  paymentMethod: string;
  cogsAmount: number;
  postedBy?: string | null;
}) {
  const {
    orderId,
    orderNumber,
    orderDate,
    channel,
    totalAmount,
    vatAmount,
    discountAmount = 0,
    paymentMethod,
    cogsAmount,
    postedBy,
  } = params;

  const netSalesRevenue = Math.max(0, totalAmount - vatAmount);
  const method = (paymentMethod || '').toLowerCase();

  // Resolve Asset Account based on Payment Gateway / Method
  let paymentAccountCode: string = ACCOUNT_CODES.CASH_POS;
  if (channel === 'ECOM') {
    if (method.includes('cod')) {
      paymentAccountCode = ACCOUNT_CODES.COD_IN_TRANSIT;
    } else if (method.includes('esewa')) {
      paymentAccountCode = ACCOUNT_CODES.ESEWA;
    } else if (method.includes('khalti')) {
      paymentAccountCode = ACCOUNT_CODES.KHALTI;
    } else if (method.includes('fonepay') || method.includes('qr')) {
      paymentAccountCode = ACCOUNT_CODES.FONEPAY;
    } else {
      paymentAccountCode = ACCOUNT_CODES.BANK_NABIL;
    }
  } else {
    if (method.includes('fonepay') || method.includes('qr')) {
      paymentAccountCode = ACCOUNT_CODES.FONEPAY;
    } else if (method.includes('card')) {
      paymentAccountCode = ACCOUNT_CODES.BANK_NABIL;
    } else if (method.includes('credit')) {
      paymentAccountCode = ACCOUNT_CODES.ACCOUNTS_RECEIVABLE;
    } else {
      paymentAccountCode = ACCOUNT_CODES.CASH_POS;
    }
  }

  const revenueAccountCode = channel === 'POS' ? ACCOUNT_CODES.SALES_POS : ACCOUNT_CODES.SALES_ECOM;

  const lines: LedgerLineInput[] = [
    // 1. Dr Cash / Bank / Receivable (Gross receipt)
    {
      accountCode: paymentAccountCode,
      description: `Payment received for ${channel} Sale #${orderNumber} via ${paymentMethod}`,
      debit: totalAmount,
    },
    // 2. Cr Sales Revenue (Net of VAT)
    {
      accountCode: revenueAccountCode,
      description: `Taxable sales revenue #${orderNumber}`,
      credit: netSalesRevenue,
    },
    // 3. Cr VAT Output (13% Government Tax)
    {
      accountCode: ACCOUNT_CODES.VAT_OUTPUT,
      description: `13% Output VAT collected #${orderNumber}`,
      credit: vatAmount,
    },
  ];

  // 4. If COGS > 0, post real-time inventory reduction
  if (cogsAmount > 0) {
    lines.push(
      {
        accountCode: ACCOUNT_CODES.COGS_HARDWARE,
        description: `Cost of goods sold for #${orderNumber}`,
        debit: cogsAmount,
      },
      {
        accountCode: ACCOUNT_CODES.INVENTORY,
        description: `Inventory reduction for #${orderNumber}`,
        credit: cogsAmount,
      },
    );
  }

  return await postDoubleEntryJournal({
    entryNumber: `JE-SALE-${orderNumber}`,
    entryDate: orderDate,
    description: `${channel} Sale Invoice #${orderNumber} [${paymentMethod}]`,
    sourceType: channel === 'POS' ? 'pos_sale' : 'ecom_order',
    sourceId: orderId,
    postedBy,
    lines,
  });
}

/**
 * Auto-Post Goods Receipt Note (GRN) from Warehouse
 * Dr Merchandise Inventory (1060)
 * Cr GRN Clearing Account (2020)
 */
export async function postGrnJournal(params: {
  grnId: string;
  grnNumber: string;
  receivedDate: string;
  totalAmount: number;
  supplierName: string;
  storekeeperId?: string | null;
}) {
  const { grnId, grnNumber, receivedDate, totalAmount, supplierName, storekeeperId } = params;

  return await postDoubleEntryJournal({
    entryNumber: `JE-GRN-${grnNumber}`,
    entryDate: receivedDate,
    description: `Goods Received Note #${grnNumber} from ${supplierName}`,
    sourceType: 'grn',
    sourceId: grnId,
    postedBy: storekeeperId,
    lines: [
      {
        accountCode: ACCOUNT_CODES.INVENTORY,
        description: `Stock received under ${grnNumber}`,
        debit: totalAmount,
      },
      {
        accountCode: ACCOUNT_CODES.GRN_CLEARING,
        description: `Uninvoiced GRN Clearing for ${supplierName} (${grnNumber})`,
        credit: totalAmount,
      },
    ],
  });
}

/**
 * Auto-Post Supplier Purchase Bill (3-Way Matched)
 * Dr GRN Clearing (2020)
 * Dr VAT Input Receivable 13% (1070)
 * Cr Accounts Payable (2010)
 */
export async function postSupplierBillJournal(params: {
  billId: string;
  billNumber: string;
  billDate: string;
  supplierName: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  postedBy?: string | null;
}) {
  const { billId, billNumber, billDate, supplierName, subtotal, vatAmount, totalAmount, postedBy } = params;

  return await postDoubleEntryJournal({
    entryNumber: `JE-BILL-${billNumber}`,
    entryDate: billDate,
    description: `Purchase Bill #${billNumber} from ${supplierName}`,
    sourceType: 'supplier_bill',
    sourceId: billId,
    postedBy,
    lines: [
      {
        accountCode: ACCOUNT_CODES.GRN_CLEARING,
        description: `GRN Clearing settled for Bill #${billNumber}`,
        debit: subtotal,
      },
      {
        accountCode: ACCOUNT_CODES.VAT_INPUT,
        description: `13% Claimable Input VAT on Bill #${billNumber}`,
        debit: vatAmount,
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        description: `Payable liability to ${supplierName} for Bill #${billNumber}`,
        credit: totalAmount,
      },
    ],
  });
}

/**
 * Auto-Post Supplier Payment with Nepal 1.5% TDS Withholding
 * Dr Accounts Payable (2010) - Full Settled Amount
 * Cr TDS Payable (2040) - 1.5% TDS
 * Cr Bank / Cash (1030 / 1010) - Net Paid Out
 */
export async function postSupplierPaymentJournal(params: {
  paymentId: string;
  paymentNumber: string;
  paymentDate: string;
  supplierName: string;
  settledAmount: number;
  tdsAmount: number;
  netPaidAmount: number;
  paymentMethod: string;
  bankReference?: string | null;
  postedBy?: string | null;
}) {
  const { paymentId, paymentNumber, paymentDate, supplierName, settledAmount, tdsAmount, netPaidAmount, paymentMethod, postedBy } = params;

  const bankAccountCode: string = paymentMethod.toLowerCase().includes('cash')
    ? ACCOUNT_CODES.CASH_VAULT
    : ACCOUNT_CODES.BANK_NABIL;

  const lines: LedgerLineInput[] = [
    {
      accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
      description: `Settlement of dues to ${supplierName}`,
      debit: settledAmount,
    },
    {
      accountCode: bankAccountCode,
      description: `Payment via ${paymentMethod} to ${supplierName}`,
      credit: netPaidAmount,
    },
  ];

  if (tdsAmount > 0) {
    lines.push({
      accountCode: ACCOUNT_CODES.TDS_PAYABLE,
      description: `1.5% Nepal TDS Withheld on payment to ${supplierName}`,
      credit: tdsAmount,
    });
  }

  return await postDoubleEntryJournal({
    entryNumber: `JE-PAY-${paymentNumber}`,
    entryDate: paymentDate,
    description: `Supplier Payment #${paymentNumber} to ${supplierName}`,
    sourceType: 'supplier_payment',
    sourceId: paymentId,
    postedBy,
    lines,
  });
}

/**
 * Auto-Post Cashier Till Over / Short Variance at EOD Blind Close
 */
export async function postCashVarianceJournal(params: {
  shiftId: string;
  shiftNumber: string;
  businessDate: string;
  cashierName: string;
  varianceAmount: number; // positive = overage, negative = shortage
  supervisorId?: string | null;
}) {
  const { shiftId, shiftNumber, businessDate, cashierName, varianceAmount, supervisorId } = params;
  if (Math.abs(varianceAmount) < 0.01) return null;

  const isShortage = varianceAmount < 0;
  const absAmount = Math.abs(varianceAmount);

  const lines: LedgerLineInput[] = isShortage
    ? [
        {
          accountCode: ACCOUNT_CODES.EXPENSE_CASH_VARIANCE,
          description: `Cash Shortage Loss for Shift #${shiftNumber} (${cashierName})`,
          debit: absAmount,
        },
        {
          accountCode: ACCOUNT_CODES.CASH_POS,
          description: `Till reconciliation adjustment #${shiftNumber}`,
          credit: absAmount,
        },
      ]
    : [
        {
          accountCode: ACCOUNT_CODES.CASH_POS,
          description: `Till cash overage collected #${shiftNumber}`,
          debit: absAmount,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_SERVICES,
          description: `Cash Overage Gain for Shift #${shiftNumber} (${cashierName})`,
          credit: absAmount,
        },
      ];

  return await postDoubleEntryJournal({
    entryNumber: `JE-VAR-SHIFT-${shiftId}`,
    entryDate: businessDate,
    description: `Cashier Shift #${shiftNumber} Discrepancy (${isShortage ? 'Shortage' : 'Overage'} of NPR ${absAmount.toFixed(2)})`,
    sourceType: 'eod_variance',
    sourceId: shiftId,
    postedBy: supervisorId,
    lines,
  });
}

/**
 * Auto-Post Cash Drop (POS Drawer to Main Safe/Vault)
 */
export async function postCashDropJournal(params: {
  dropId: string;
  shiftId: string;
  dropDate: string;
  amount: number;
  cashierName: string;
  receiverId?: string | null;
}) {
  const { dropId, shiftId, dropDate, amount, cashierName, receiverId } = params;

  return await postDoubleEntryJournal({
    entryNumber: `JE-DROP-${dropId}`,
    entryDate: dropDate,
    description: `Cash Drop from POS Drawer to Vault by ${cashierName}`,
    sourceType: 'cash_drop',
    sourceId: dropId,
    postedBy: receiverId,
    lines: [
      {
        accountCode: ACCOUNT_CODES.CASH_VAULT,
        description: `Safe deposit received from POS Drawer`,
        debit: amount,
      },
      {
        accountCode: ACCOUNT_CODES.CASH_POS,
        description: `Till drawer cash skimmed for safe storage`,
        credit: amount,
      },
    ],
  });
}

/**
 * Auto-Post Inventory Shrinkage or Damage Write-Off
 */
export async function postInventoryWriteOffJournal(params: {
  auditId: string;
  writeOffDate: string;
  productName: string;
  sku: string;
  quantity: number;
  costValue: number;
  reason: string;
  approvedBy?: string | null;
}) {
  const { auditId, writeOffDate, productName, sku, quantity, costValue, reason, approvedBy } = params;

  return await postDoubleEntryJournal({
    entryNumber: `JE-WRITEOFF-${auditId}-${Date.now().toString().slice(-4)}`,
    entryDate: writeOffDate,
    description: `Stock Write-off: ${quantity}x ${productName} (${sku}) - Reason: ${reason}`,
    sourceType: 'damage_write_off',
    sourceId: auditId,
    postedBy: approvedBy,
    lines: [
      {
        accountCode: ACCOUNT_CODES.INVENTORY_WRITE_OFF,
        description: `Loss on inventory write-off (${sku})`,
        debit: costValue,
      },
      {
        accountCode: ACCOUNT_CODES.INVENTORY,
        description: `Stock adjustment deduction (${sku})`,
        credit: costValue,
      },
    ],
  });
}
