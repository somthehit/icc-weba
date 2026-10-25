/**
 * scripts/test-po-engine.ts
 *
 * Tests for Purchase Order Calculator and Zod Validation:
 * - VAT 13% rounding and discounts
 * - Apportioned landed cost calculation
 * - Negative and inverted delivery date rejection
 * - Price variance warning flags
 */

import { calculatePoTotals } from '../lib/procurement/po-calculator';
import { purchaseOrderFormSchema } from '../lib/procurement/po-validation';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('--- Testing Purchase Order Calculation & Validation Engine ---\n');

// 1. VAT and Discount Line Calculation
console.log('1. Subtotal, Discount & 13% VAT Math');
const mockLines = [
  {
    sku: 'LAP-ASUS-G14',
    description: 'Asus ROG Zephyrus G14 (Ryzen 9 / 16GB / 1TB / RTX 4060)',
    quantityOrdered: 2,
    unitCost: 180000.00, // 2 * 180k = 360k
    discountPercent: 5,   // 5% discount = 18,000 => Net = 342,000
    taxCategory: 'vat_13' as const,
    expectedSellingPrice: 225000.00,
    lastPurchaseCost: 175000.00,
    unitOfMeasure: 'Pcs',
    requiresSerial: true,
  },
  {
    sku: 'ACC-LOGI-MX3',
    description: 'Logitech MX Master 3S Wireless Mouse',
    quantityOrdered: 10,
    unitCost: 12000.00,  // 10 * 12k = 120k
    discountPercent: 0,
    taxCategory: 'vat_13' as const,
    expectedSellingPrice: 15500.00,
    lastPurchaseCost: 11000.00,
    unitOfMeasure: 'Pcs',
    requiresSerial: false,
  }
];

const summary = calculatePoTotals(mockLines, 5000); // 5000 other charges (freight)

assert(summary.subtotal === 480000, 'Subtotal before discount is NPR 4,80,000');
assert(summary.totalDiscount === 18000, 'Total discount is NPR 18,000');
assert(summary.taxableAmount === 462000, 'Taxable amount is NPR 4,62,000 (480k - 18k)');
assert(summary.vatAmount === 60060, '13% Nepal VAT on 4,62,000 is NPR 60,060');
assert(summary.otherCharges === 5000, 'Other charges recorded as NPR 5,000');
assert(summary.grandTotal === 527060, 'Grand Total is NPR 5,27,060 (462k + 60,060 + 5k)');

// 2. Landed Cost & Margins
console.log('\n2. Landed Cost Apportionment & Expected Margins');
const laptop = summary.lines[0];
assert(laptop.landedCostPerUnit > 171000, 'Landed cost per unit includes apportioned freight');
assert(laptop.expectedMarginPercent > 20, 'Expected margin calculated against selling price (~23.6%)');
assert(!laptop.isPriceVariance, 'Price variance < 10% is not flagged');

// 3. Zod Validation Rules
console.log('\n3. Zod Schema Validation');
const validPo = {
  supplierId: 1,
  fiscalYear: '2082/83',
  orderDate: '2026-10-03',
  expectedDeliveryDate: '2026-10-08',
  deliverToLocation: 'Main Store - Dhangadhi',
  paymentTerms: 'Credit 30 Days',
  currency: 'NPR' as const,
  exchangeRate: 1.0,
  otherCharges: 0,
  items: mockLines,
};

const validRes = purchaseOrderFormSchema.safeParse(validPo);
assert(validRes.success, 'Valid PO passes schema check');

// Invalid: Delivery date before order date
const invalidDatePo = {
  ...validPo,
  orderDate: '2026-10-08',
  expectedDeliveryDate: '2026-10-03',
};
const invalidRes = purchaseOrderFormSchema.safeParse(invalidDatePo);
assert(!invalidRes.success, 'Delivery date before order date is rejected by Zod refinement');

console.log(`\n========================================`);
console.log(`Tests finished: ${passed} passed, ${failed} failed.`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
process.exit(0);
