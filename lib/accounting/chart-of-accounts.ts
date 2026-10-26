/**
 * lib/accounting/chart-of-accounts.ts
 *
 * Nepal Standard Chart of Accounts (COA) for Retail & E-Commerce ERP.
 * Configured with standard numbering, types, and sub-ledgers.
 */

import { db } from '@/db';
import { accounts, fiscalPeriods } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NEPALI_MONTHS } from '@/lib/nepal/date';

export const STANDARD_COA = [
  // 1000 - ASSETS
  { code: '1010', name: 'Cash in POS Till / Drawer', type: 'asset' as const, parentCode: null },
  { code: '1020', name: 'Main Safe / Vault Cash', type: 'asset' as const, parentCode: null },
  { code: '1030', name: 'Nabil Bank Operating A/C', type: 'asset' as const, parentCode: null },
  { code: '1031', name: 'NIMB Bank Operating A/C', type: 'asset' as const, parentCode: null },
  { code: '1040', name: 'eSewa Merchant Wallet', type: 'asset' as const, parentCode: null },
  { code: '1041', name: 'Khalti Merchant Wallet', type: 'asset' as const, parentCode: null },
  { code: '1042', name: 'Fonepay QR Clearing', type: 'asset' as const, parentCode: null },
  { code: '1050', name: 'Accounts Receivable (Trade Debtors)', type: 'asset' as const, parentCode: null },
  { code: '1055', name: 'Courier COD Remittance In-Transit', type: 'asset' as const, parentCode: null },
  { code: '1060', name: 'Merchandise Stock (Inventory Asset)', type: 'asset' as const, parentCode: null },
  { code: '1070', name: 'VAT Input Receivable (13% Paid)', type: 'asset' as const, parentCode: null },
  { code: '1080', name: 'Advances Paid to Suppliers', type: 'asset' as const, parentCode: null },
  { code: '1090', name: 'Petty Cash Fund', type: 'asset' as const, parentCode: null },

  // 2000 - LIABILITIES
  { code: '2010', name: 'Accounts Payable (Trade Creditors)', type: 'liability' as const, parentCode: null },
  { code: '2020', name: 'GRN Clearing (Goods Received Not Invoiced)', type: 'liability' as const, parentCode: null },
  { code: '2030', name: 'VAT Output Payable (13% Collected)', type: 'liability' as const, parentCode: null },
  { code: '2040', name: 'TDS Payable (Nepal Withholding 1.5%)', type: 'liability' as const, parentCode: null },
  { code: '2050', name: 'Customer Advance & Store Credits', type: 'liability' as const, parentCode: null },
  { code: '2060', name: 'Unearned Online Order Revenue', type: 'liability' as const, parentCode: null },

  // 3000 - EQUITY
  { code: '3010', name: "Owner's Capital / Share Capital", type: 'equity' as const, parentCode: null },
  { code: '3020', name: 'Retained Earnings', type: 'equity' as const, parentCode: null },
  { code: '3030', name: 'Current Year Profit/Loss', type: 'equity' as const, parentCode: null },

  // 4000 - REVENUE / INCOME
  { code: '4010', name: 'POS Counter Sales Revenue', type: 'revenue' as const, parentCode: null },
  { code: '4020', name: 'E-Commerce Online Sales Revenue', type: 'revenue' as const, parentCode: null },
  { code: '4030', name: 'Service, Assembly & Repair Income', type: 'revenue' as const, parentCode: null },
  { code: '4090', name: 'Sales Discounts & Promotional Rebates', type: 'revenue' as const, parentCode: null }, // Contra-revenue

  // 5000 - COST OF GOODS SOLD (COGS)
  { code: '5010', name: 'COGS - Hardware, Parts & Components', type: 'expense' as const, parentCode: null },
  { code: '5020', name: 'COGS - Laptops, PCs & Displays', type: 'expense' as const, parentCode: null },
  { code: '5030', name: 'Inbound Freight & Customs Duties', type: 'expense' as const, parentCode: null },
  { code: '5040', name: 'Inventory Shrinkage & Damage Write-Off', type: 'expense' as const, parentCode: null },

  // 6000 - OPERATING EXPENSES
  { code: '6010', name: 'Staff Salaries, Wages & Allowances', type: 'expense' as const, parentCode: null },
  { code: '6020', name: 'Store & Warehouse Rent', type: 'expense' as const, parentCode: null },
  { code: '6030', name: 'Electricity, Water & Internet Utilities', type: 'expense' as const, parentCode: null },
  { code: '6040', name: 'Digital Payment Gateway & Merchant Fees', type: 'expense' as const, parentCode: null },
  { code: '6050', name: 'Courier Delivery & Logistics Expense', type: 'expense' as const, parentCode: null },
  { code: '6060', name: 'Cashier Till Over/Short Variance Expense', type: 'expense' as const, parentCode: null },
  { code: '6070', name: 'Advertising & Marketing Promotion', type: 'expense' as const, parentCode: null },
  { code: '6080', name: 'General Office & Petty Cash Expenses', type: 'expense' as const, parentCode: null },
];

export const ACCOUNT_CODES = {
  CASH_POS: '1010',
  CASH_VAULT: '1020',
  BANK_NABIL: '1030',
  BANK_NIMB: '1031',
  ESEWA: '1040',
  KHALTI: '1041',
  FONEPAY: '1042',
  ACCOUNTS_RECEIVABLE: '1050',
  COD_IN_TRANSIT: '1055',
  INVENTORY: '1060',
  VAT_INPUT: '1070',
  SUPPLIER_ADVANCES: '1080',
  PETTY_CASH: '1090',

  ACCOUNTS_PAYABLE: '2010',
  GRN_CLEARING: '2020',
  VAT_OUTPUT: '2030',
  TDS_PAYABLE: '2040',
  CUSTOMER_ADVANCES: '2050',

  CAPITAL: '3010',
  RETAINED_EARNINGS: '3020',

  SALES_POS: '4010',
  SALES_ECOM: '4020',
  SALES_SERVICES: '4030',
  SALES_DISCOUNTS: '4090',

  COGS_HARDWARE: '5010',
  COGS_SYSTEMS: '5020',
  FREIGHT_CUSTOMS: '5030',
  INVENTORY_WRITE_OFF: '5040',

  EXPENSE_SALARIES: '6010',
  EXPENSE_RENT: '6020',
  EXPENSE_UTILITIES: '6030',
  EXPENSE_GATEWAY_FEES: '6040',
  EXPENSE_COURIER: '6050',
  EXPENSE_CASH_VARIANCE: '6060',
  EXPENSE_MARKETING: '6070',
  EXPENSE_PETTY_CASH: '6080',
} as const;

let cachedAccountMap: Map<string, string> | null = null;

/**
 * Ensures standard Chart of Accounts exist in DB and returns a fast Code->ID lookup map.
 */
export async function getAccountMap(): Promise<Map<string, string>> {
  if (cachedAccountMap && cachedAccountMap.size >= STANDARD_COA.length) {
    return cachedAccountMap;
  }

  const existing = await db.select().from(accounts);
  const map = new Map<string, string>();

  for (const acc of existing) {
    map.set(acc.code, acc.id);
  }

  // Insert missing standard accounts
  for (const item of STANDARD_COA) {
    if (!map.has(item.code)) {
      try {
        const [created] = await db
          .insert(accounts)
          .values({
            code: item.code,
            name: item.name,
            type: item.type,
            isActive: true,
          })
          .returning();
        map.set(item.code, created.id);
      } catch (err) {
        // In case of concurrent insert or code already existing
        const [found] = await db.select().from(accounts).where(eq(accounts.code, item.code)).limit(1);
        if (found) map.set(item.code, found.id);
      }
    }
  }

  cachedAccountMap = map;
  return map;
}

/**
 * Seed or verify Nepal Fiscal Periods for FY 2082/83 (12 months from Shrawan to Ashadh).
 */
export async function ensureFiscalPeriods(fiscalYear = '2082/83') {
  const existing = await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.fiscalYear, fiscalYear));
  if (existing.length >= 12) return existing;

  // Month mapping for 2082/83:
  // Period 1: Shrawan 2082 (July 17, 2025 to Aug 16, 2025)
  // ...
  // Period 12: Ashadh 2083 (June 15, 2026 to July 15, 2026)
  const monthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // Shrawan is 4, Ashadh is 3
  
  for (let idx = 0; idx < monthOrder.length; idx++) {
    const monthNum = monthOrder[idx];
    const monthMeta = NEPALI_MONTHS[monthNum - 1];
    const periodNumber = idx + 1;
    const periodName = `${monthMeta.nameEn} 2082`;
    
    // Check if period already exists
    const [found] = await db
      .select()
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.fiscalYear, fiscalYear), eq(fiscalPeriods.periodNumber, periodNumber)))
      .limit(1);

    if (!found) {
      const startMonth = (7 + idx) > 12 ? (7 + idx - 12) : (7 + idx);
      const endMonth = (8 + idx) > 12 ? (8 + idx - 12) : (8 + idx);
      const startYear = (7 + idx) > 12 ? 2026 : 2025;
      const endYear = (8 + idx) > 12 ? 2026 : 2025;

      await db.insert(fiscalPeriods).values({
        fiscalYear,
        periodNumber,
        monthNameBs: monthMeta.nameEn,
        startDateAd: `${startYear}-${String(startMonth).padStart(2, '0')}-15`,
        endDateAd: `${endYear}-${String(endMonth).padStart(2, '0')}-14`,
        isLocked: false,
      }).onConflictDoNothing();
    }
  }
}
