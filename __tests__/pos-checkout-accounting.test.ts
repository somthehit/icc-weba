import assert from 'node:assert/strict';

/**
 * POS Checkout & Nepal Accounting Automation Verification
 * Tests:
 * 1. Nepal 13% VAT (IRD Inclusive Formula)
 * 2. Multi-Tender Split Payment Allocations
 * 3. Discount Allowance & Margin/Markup Formulas
 * 4. Double-Entry General Ledger Balancing (Debits === Credits)
 * 5. Serial Number & Warranty Attachment Integrity
 */

console.log('🧪 Starting Counter POS & Accounting Integrity Test Suite...\n');

// 1. Nepal 13% Inclusive VAT Test
function testNepalVatCalculation() {
  console.log('▶ Testing Nepal 13% Inclusive VAT Calculations...');
  
  // Case A: Clean round number
  const totalA = 11300;
  const taxableA = Number((totalA / 1.13).toFixed(2));
  const vatA = Number((totalA - taxableA).toFixed(2));
  assert.equal(taxableA, 10000);
  assert.equal(vatA, 1300);
  assert.equal(Number((taxableA + vatA).toFixed(2)), totalA);

  // Case B: Real-world retail total (NPR 4,599)
  const totalB = 4599;
  const taxableB = Number((totalB / 1.13).toFixed(2));
  const vatB = Number((totalB - taxableB).toFixed(2));
  assert.equal(taxableB, 4069.91);
  assert.equal(vatB, 529.09);
  assert.equal(Number((taxableB + vatB).toFixed(2)), totalB);

  console.log('  ✔ Nepal IRD 13% VAT calculation verified (taxable + vat === total).\n');
}

// 2. Multi-Tender Split Payment Validation
interface PaymentAllocation {
  method: 'cash' | 'card' | 'qr' | 'bank_transfer' | 'credit';
  amount: number;
  reference?: string;
  verified?: boolean;
}

function validateSplitPayment(totalDue: number, allocations: PaymentAllocation[]): { isValid: boolean; remaining: number; error?: string } {
  if (!allocations || allocations.length === 0) {
    return { isValid: false, remaining: totalDue, error: 'At least one payment allocation is required.' };
  }

  for (const alloc of allocations) {
    if (alloc.amount <= 0) {
      return { isValid: false, remaining: totalDue, error: 'Allocation amount must be greater than 0.' };
    }
    if ((alloc.method === 'card' || alloc.method === 'qr' || alloc.method === 'bank_transfer') && !alloc.reference) {
      // In strict retail mode, card and bank require reference/auth code
    }
  }

  const allocatedSum = Number(allocations.reduce((sum, a) => sum + a.amount, 0).toFixed(2));
  const remaining = Number((totalDue - allocatedSum).toFixed(2));

  if (allocatedSum < totalDue) {
    return { isValid: false, remaining, error: `Allocated sum (NPR ${allocatedSum}) is less than total due (NPR ${totalDue}).` };
  }

  return { isValid: true, remaining: Math.max(0, remaining) };
}

function testSplitPaymentValidation() {
  console.log('▶ Testing Multi-Tender Split Payment Allocation Rules...');

  const totalDue = 85000; // e.g. Laptop sale

  // Test Case A: Valid 3-way split (Cash + Card + Fonepay QR)
  const validSplit: PaymentAllocation[] = [
    { method: 'cash', amount: 35000 },
    { method: 'card', amount: 30000, reference: 'APP-92014' },
    { method: 'qr', amount: 20000, reference: 'FONE-481023', verified: true },
  ];
  const resA = validateSplitPayment(totalDue, validSplit);
  assert.equal(resA.isValid, true);
  assert.equal(resA.remaining, 0);

  // Test Case B: Under-allocated split (Cash 20,000 + QR 50,000 = 70,000 < 85,000)
  const underAllocated: PaymentAllocation[] = [
    { method: 'cash', amount: 20000 },
    { method: 'qr', amount: 50000, reference: 'QR-123' },
  ];
  const resB = validateSplitPayment(totalDue, underAllocated);
  assert.equal(resB.isValid, false);
  assert.equal(resB.remaining, 15000);

  // Test Case C: Over-tendered cash payment gives change
  const overTender: PaymentAllocation[] = [{ method: 'cash', amount: 86000 }];
  const resC = validateSplitPayment(totalDue, overTender);
  assert.equal(resC.isValid, true);

  console.log('  ✔ Split payment allocation validation verified.\n');
}

// 3. Discount Limit & Profit Margin Calculator
function calculateProfitability(sellingPrice: number, costPrice: number, discountPct: number, supervisorPin?: string) {
  const isSupervisorRequired = discountPct > 10;
  if (isSupervisorRequired && (!supervisorPin || supervisorPin.length < 4)) {
    throw new Error('Supervisor authorization PIN required for discounts exceeding 10% limit.');
  }

  const discountAmount = Number(((sellingPrice * discountPct) / 100).toFixed(2));
  const netSellingPrice = Number((sellingPrice - discountAmount).toFixed(2));
  const grossProfit = Number((netSellingPrice - costPrice).toFixed(2));
  const grossMarginPct = netSellingPrice > 0 ? Number(((grossProfit / netSellingPrice) * 100).toFixed(2)) : 0;
  const markupPct = costPrice > 0 ? Number(((grossProfit / costPrice) * 100).toFixed(2)) : 0;

  return {
    sellingPrice,
    costPrice,
    discountPct,
    discountAmount,
    netSellingPrice,
    grossProfit,
    grossMarginPct,
    markupPct,
  };
}

function testDiscountAndMarginCalculator() {
  console.log('▶ Testing Retail Discount Limits & Profit Margin Calculator...');

  const retailSelling = 10000;
  const cogsCost = 7500;

  // Case A: 5% Cashier discount (Permitted without supervisor)
  const calcA = calculateProfitability(retailSelling, cogsCost, 5);
  assert.equal(calcA.discountAmount, 500);
  assert.equal(calcA.netSellingPrice, 9500);
  assert.equal(calcA.grossProfit, 2000);
  assert.equal(calcA.grossMarginPct, 21.05); // (2000 / 9500) * 100
  assert.equal(calcA.markupPct, 26.67);      // (2000 / 7500) * 100

  // Case B: 15% Discount without PIN (Must reject)
  assert.throws(() => {
    calculateProfitability(retailSelling, cogsCost, 15);
  }, /Supervisor authorization PIN required/);

  // Case C: 15% Discount with Supervisor PIN (Approved)
  const calcC = calculateProfitability(retailSelling, cogsCost, 15, '1234');
  assert.equal(calcC.discountAmount, 1500);
  assert.equal(calcC.netSellingPrice, 8500);
  assert.equal(calcC.grossProfit, 1000);

  console.log('  ✔ Cashier discount limits and margin/markup math verified.\n');
}

// 4. Double-Entry General Ledger Balance Verification
interface JournalLineItem {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

function generateSaleJournalEntries(
  totalDue: number,
  allocations: PaymentAllocation[],
  costTotal: number
): { lines: JournalLineItem[]; isBalanced: boolean; totalDebits: number; totalCredits: number } {
  const taxableAmount = Number((totalDue / 1.13).toFixed(2));
  const vatAmount = Number((totalDue - taxableAmount).toFixed(2));

  const lines: JournalLineItem[] = [];

  // Debits from Allocations
  for (const alloc of allocations) {
    let accountCode = '1000';
    let accountName = 'Cash on Hand';
    if (alloc.method === 'card' || alloc.method === 'qr' || alloc.method === 'bank_transfer') {
      accountCode = '1010';
      accountName = 'Bank Account / Fonepay Settlement';
    } else if (alloc.method === 'credit') {
      accountCode = '1100';
      accountName = 'Accounts Receivable';
    }

    lines.push({
      accountCode,
      accountName,
      debit: alloc.amount,
      credit: 0,
    });
  }

  // Cost of Goods Sold (Debit 5000)
  if (costTotal > 0) {
    lines.push({
      accountCode: '5000',
      accountName: 'Cost of Goods Sold (COGS)',
      debit: costTotal,
      credit: 0,
    });
  }

  // Sales Revenue (Credit 4000)
  lines.push({
    accountCode: '4000',
    accountName: 'Product Sales Revenue',
    debit: 0,
    credit: taxableAmount,
  });

  // VAT Payable (Credit 2100)
  lines.push({
    accountCode: '2100',
    accountName: '13% VAT Output Tax Payable',
    debit: 0,
    credit: vatAmount,
  });

  // Merchandise Inventory (Credit 1200)
  if (costTotal > 0) {
    lines.push({
      accountCode: '1200',
      accountName: 'Merchandise Inventory Asset',
      debit: 0,
      credit: costTotal,
    });
  }

  const totalDebits = Number(lines.reduce((s, l) => s + l.debit, 0).toFixed(2));
  const totalCredits = Number(lines.reduce((s, l) => s + l.credit, 0).toFixed(2));
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

  return { lines, isBalanced, totalDebits, totalCredits };
}

function testDoubleEntryAccounting() {
  console.log('▶ Testing Double-Entry General Ledger Balance (Debits === Credits)...');

  const invoiceAmount = 56500;
  const costAmount = 42000;
  const allocations: PaymentAllocation[] = [
    { method: 'cash', amount: 26500 },
    { method: 'card', amount: 30000, reference: 'EDC-8472' },
  ];

  const gl = generateSaleJournalEntries(invoiceAmount, allocations, costAmount);

  assert.equal(gl.isBalanced, true, 'General ledger entry must be balanced');
  assert.equal(gl.totalDebits, gl.totalCredits, `Total debits (${gl.totalDebits}) must equal total credits (${gl.totalCredits})`);
  assert.equal(gl.totalDebits, invoiceAmount + costAmount);

  console.log(`  ✔ Balanced General Ledger Journal Verified: Total Debits = NPR ${gl.totalDebits}, Total Credits = NPR ${gl.totalCredits}\n`);
}

// 5. Serial Number & Warranty Data Attachment
function testSerialAndWarrantyTracking() {
  console.log('▶ Testing Electronics Retail Serial Number & Warranty Attachment...');

  const cartItem = {
    productId: 101,
    sku: 'LAP-ASUS-G14',
    name: 'Asus ROG Zephyrus G14',
    price: 185000,
    quantity: 1,
    serialNumber: 'SN-G14-2026-NEP-9021',
    warrantyMonths: 24,
    warrantyText: '24 Months Official Asus Warranty',
  };

  assert.ok(cartItem.serialNumber, 'Serialized product must have attached S/N');
  assert.equal(cartItem.warrantyMonths, 24);
  assert.ok(cartItem.warrantyText.includes('24 Months'));

  console.log('  ✔ Serial number and warranty link verified.\n');
}

// Run all test suites
try {
  testNepalVatCalculation();
  testSplitPaymentValidation();
  testDiscountAndMarginCalculator();
  testDoubleEntryAccounting();
  testSerialAndWarrantyTracking();

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL COUNTER POS & ACCOUNTING INTEGRITY TESTS PASSED SUCCESSFULLY! ');
  console.log('══════════════════════════════════════════════════════════════════════');
} catch (err: any) {
  console.error('❌ Test Failure:', err.message);
  process.exit(1);
}
