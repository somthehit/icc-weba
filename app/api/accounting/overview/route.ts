import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, journalEntries, journalLines, purchaseOrders, goodsReceiptNotes, purchaseBills, fiscalPeriods } from '@/db/schema';
import { posShifts, posBusinessDays, posCashTransactions } from '@/db/schema/pos';
import { products } from '@/db/schema/catalog';
import { eq, desc, sql, and, asc } from 'drizzle-orm';
import { adToBs, formatDualDate } from '@/lib/nepal/date';
import { getAccountMap, ACCOUNT_CODES } from '@/lib/accounting/chart-of-accounts';

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const bsMeta = adToBs(today);

    // 1. Ensure Chart of Accounts Map is loaded
    await getAccountMap();

    // 2. Fetch all Active GL Accounts with aggregated Debit & Credit balances
    const glBalances = await db
      .select({
        accountId: accounts.id,
        code: accounts.code,
        name: accounts.name,
        type: accounts.type,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
      .where(eq(accounts.isActive, true))
      .groupBy(accounts.id, accounts.code, accounts.name, accounts.type)
      .orderBy(asc(accounts.code));

    // Map account code -> net balance
    // For Assets/Expenses: Net Balance = Debit - Credit
    // For Liabilities/Equity/Revenue: Net Balance = Credit - Debit
    const accountSummaryMap = new Map<string, { id: number; name: string; type: string; debit: number; credit: number; balance: number }>();

    for (const row of glBalances) {
      const debit = Number(row.totalDebit || 0);
      const credit = Number(row.totalCredit || 0);
      let balance = 0;
      if (row.type === 'asset' || row.type === 'expense') {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }
      accountSummaryMap.set(row.code, {
        id: row.accountId,
        name: row.name,
        type: row.type,
        debit,
        credit,
        balance,
      });
    }

    // --- DERIVED METRICS DIRECTLY FROM GENERAL LEDGER ---

    // Turnover & Sales
    const posSalesRevenue = accountSummaryMap.get(ACCOUNT_CODES.SALES_POS)?.balance || 0;
    const ecomSalesRevenue = accountSummaryMap.get(ACCOUNT_CODES.SALES_ECOM)?.balance || 0;
    const serviceRevenue = accountSummaryMap.get(ACCOUNT_CODES.SALES_SERVICES)?.balance || 0;
    const salesDiscounts = accountSummaryMap.get(ACCOUNT_CODES.SALES_DISCOUNTS)?.balance || 0;
    const grossSalesTurnover = posSalesRevenue + ecomSalesRevenue + serviceRevenue - salesDiscounts;

    // VAT Position
    const vatOutputCollected = accountSummaryMap.get(ACCOUNT_CODES.VAT_OUTPUT)?.balance || 0;
    const vatInputPaid = accountSummaryMap.get(ACCOUNT_CODES.VAT_INPUT)?.balance || 0;
    const netVatPayable = Math.max(0, vatOutputCollected - vatInputPaid);
    const vatRefundable = Math.max(0, vatInputPaid - vatOutputCollected);

    // COGS & Gross Profit
    const cogsHardware = accountSummaryMap.get(ACCOUNT_CODES.COGS_HARDWARE)?.balance || 0;
    const cogsSystems = accountSummaryMap.get(ACCOUNT_CODES.COGS_SYSTEMS)?.balance || 0;
    const freightCustoms = accountSummaryMap.get(ACCOUNT_CODES.FREIGHT_CUSTOMS)?.balance || 0;
    const inventoryWriteOff = accountSummaryMap.get(ACCOUNT_CODES.INVENTORY_WRITE_OFF)?.balance || 0;
    const totalCogs = cogsHardware + cogsSystems + freightCustoms + inventoryWriteOff;

    const netSales = Math.max(0, grossSalesTurnover);
    const estimatedGrossProfit = netSales - totalCogs;
    const marginPercent = netSales > 0 ? ((estimatedGrossProfit / netSales) * 100).toFixed(1) : '25.0';

    // Real-Time Inventory Valuation (Asset 1060 Balance)
    const glInventoryValue = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.INVENTORY)?.balance || 0);

    // Cash, Bank, and Digital Wallets
    const posTillCash = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.CASH_POS)?.balance || 0);
    const vaultCash = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.CASH_VAULT)?.balance || 0);
    const nabilBank = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.BANK_NABIL)?.balance || 0);
    const nimbBank = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.BANK_NIMB)?.balance || 0);
    const esewaWallet = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.ESEWA)?.balance || 0);
    const khaltiWallet = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.KHALTI)?.balance || 0);
    const fonepayClearing = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.FONEPAY)?.balance || 0);
    const pettyCashFund = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.PETTY_CASH)?.balance || 0);

    const totalLiquidAssets = posTillCash + vaultCash + nabilBank + nimbBank + esewaWallet + khaltiWallet + fonepayClearing + pettyCashFund;

    // Receivables & Payables
    const accountsReceivable = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE)?.balance || 0);
    const codInTransit = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.COD_IN_TRANSIT)?.balance || 0);
    const totalReceivables = accountsReceivable + codInTransit;

    const accountsPayable = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.ACCOUNTS_PAYABLE)?.balance || 0);
    const grnClearingUninvoiced = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.GRN_CLEARING)?.balance || 0);
    const tdsPayable = Math.max(0, accountSummaryMap.get(ACCOUNT_CODES.TDS_PAYABLE)?.balance || 0);

    // Operating Expenses
    const salaryExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_SALARIES)?.balance || 0;
    const rentExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_RENT)?.balance || 0;
    const utilitiesExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_UTILITIES)?.balance || 0;
    const gatewayFeeExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_GATEWAY_FEES)?.balance || 0;
    const courierExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_COURIER)?.balance || 0;
    const cashVarianceExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_CASH_VARIANCE)?.balance || 0;
    const marketingExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_MARKETING)?.balance || 0;
    const pettyExpense = accountSummaryMap.get(ACCOUNT_CODES.EXPENSE_PETTY_CASH)?.balance || 0;

    const totalOperatingExpenses = salaryExpense + rentExpense + utilitiesExpense + gatewayFeeExpense + courierExpense + cashVarianceExpense + marketingExpense + pettyExpense;
    const netProfit = estimatedGrossProfit - totalOperatingExpenses;

    // 3. Shifts & Cashier Metrics
    let businessDay = null;
    let openShifts = 0;
    let totalShifts = 0;
    let todayExpectedCash = 0;
    let todayActualCash = 0;
    let todayVariance = 0;
    let highVarianceCount = 0;

    try {
      const [bDay] = await db
        .select()
        .from(posBusinessDays)
        .where(eq(posBusinessDays.businessDate, todayStr))
        .limit(1);
      businessDay = bDay || null;

      const shiftsList = await db
        .select()
        .from(posShifts)
        .orderBy(desc(posShifts.openedAt))
        .limit(20);

      totalShifts = shiftsList.length;
      for (const s of shiftsList) {
        if (s.status === 'OPEN') openShifts++;
        todayExpectedCash += Number(s.expectedCash || 0);
        todayActualCash += Number(s.closingCash || s.expectedCash || 0);
        const diff = Number(s.cashDiscrepancy || 0);
        todayVariance += diff;
        if (Math.abs(diff) > 500 && !s.varianceApproved) {
          highVarianceCount++;
        }
      }
    } catch (e) {
      console.warn('Error reading shifts for overview:', e);
    }

    // 4. Products & SKU Count
    let totalSkuCount = 0;
    let lowStockCount = 0;
    try {
      const prods = await db.select({
        id: products.id,
        stockQuantity: products.stockQuantity,
        lowStockThreshold: products.lowStockThreshold,
      }).from(products);
      totalSkuCount = prods.length;
      for (const p of prods) {
        if ((p.stockQuantity || 0) <= (p.lowStockThreshold || 3)) {
          lowStockCount++;
        }
      }
    } catch (e) {
      console.warn('Error fetching products count:', e);
    }

    // 5. Recent Journal Activity
    const recentJournals = await db
      .select({
        id: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        description: journalEntries.description,
        sourceType: journalEntries.sourceType,
        sourceId: journalEntries.sourceId,
        createdAt: journalEntries.createdAt,
      })
      .from(journalEntries)
      .orderBy(desc(journalEntries.id))
      .limit(8);

    // 6. Action Center Items
    const actionCenter = {
      openShiftsCount: openShifts,
      unapprovedVariancesCount: highVarianceCount,
      pendingGrnClearing: grnClearingUninvoiced > 0 ? 1 : 0,
      vatFilingStatus: 'Due by 25th Ashwin 2082',
      isFiscalPeriodLocked: false,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      nepaliDate: {
        bsDate: bsMeta.formattedBS,
        bsLong: bsMeta.formattedLongBS,
        fiscalYear: bsMeta.fiscalYear,
        fiscalPeriod: bsMeta.fiscalPeriod,
        monthName: bsMeta.monthName,
        dualDate: formatDualDate(todayStr),
      },
      kpis: {
        todayGrossSales: grossSalesTurnover,
        netSales,
        estimatedGrossProfit,
        netProfit,
        marginPercent,
        totalVatLiability: netVatPayable,
        vatOutputCollected,
        vatInputPaid,
        vatRefundable,
        tdsPayable,
        totalPayables: accountsPayable,
        grnClearingUninvoiced,
        totalReceivables,
        totalInventoryValue: glInventoryValue,
        totalLiquidAssets,
        openShifts,
        totalShifts,
        todayExpectedCash,
        todayActualCash,
        todayVariance,
        highVarianceCount,
        totalSkuCount,
        lowStockCount,
        businessDayStatus: businessDay?.status || 'OPEN',
        businessDate: businessDay?.businessDate || todayStr,
      },
      liquidityBreakdown: {
        posTillCash,
        vaultCash,
        nabilBank,
        nimbBank,
        esewaWallet,
        khaltiWallet,
        fonepayClearing,
        pettyCashFund,
      },
      channelSplit: {
        posSales: posSalesRevenue,
        ecomSales: ecomSalesRevenue,
        services: serviceRevenue,
      },
      actionCenter,
      recentJournals,
      dataFreshness: {
        source: 'GENERAL_LEDGER',
        status: 'LIVE_SYNCED',
        lastRefreshed: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Accounting Overview API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch accounting overview',
    }, { status: 500 });
  }
}
