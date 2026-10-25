/**
 * lib/procurement/po-calculator.ts
 *
 * Deterministic mathematical engine for Purchase Orders:
 * - Computes Subtotal, Discounts, 13% Nepal VAT, and Grand Total.
 * - Apportions freight/customs to calculate Landed Cost per line.
 * - Calculates expected gross margins against retail catalog selling prices.
 * - Detects price variance against last historical purchase cost.
 */

import { toPaisa, fromPaisa } from '@/lib/nepal/money';
import { PurchaseOrderLineInput } from './po-validation';

export interface CalculatedPoLine extends PurchaseOrderLineInput {
  baseAmount: number;
  discountCalculated: number;
  netTaxableAmount: number;
  vatCalculated: number;
  lineTotalCalculated: number;
  apportionedCharges: number;
  landedCostTotal: number;
  landedCostPerUnit: number;
  expectedMarginPercent: number;
  isPriceVariance: boolean;
  priceVariancePercent: number;
}

export interface PoTotalsSummary {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  vatAmount: number;
  otherCharges: number;
  grandTotal: number;
  lines: CalculatedPoLine[];
}

export function calculatePoTotals(
  items: PurchaseOrderLineInput[],
  otherCharges: number = 0
): PoTotalsSummary {
  let subtotalPaisa = 0;
  let totalDiscountPaisa = 0;
  let taxablePaisa = 0;
  let vatPaisa = 0;

  // First pass: line math
  const lineDetails = items.map((item) => {
    const qty = Math.max(1, Number(item.quantityOrdered) || 1);
    const unitCost = Math.max(0, Number(item.unitCost) || 0);

    const baseAmountPaisa = Math.round(qty * unitCost * 100);
    const discPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const discountPaisa = Math.round((baseAmountPaisa * discPct) / 100);
    const netPaisa = baseAmountPaisa - discountPaisa;

    let lineVatPaisa = 0;
    if (item.taxCategory === 'vat_13') {
      lineVatPaisa = Math.round(netPaisa * 0.13); // Nepal 13% statutory VAT
      taxablePaisa += netPaisa;
    }

    subtotalPaisa += baseAmountPaisa;
    totalDiscountPaisa += discountPaisa;
    vatPaisa += lineVatPaisa;

    // Price variance detection against last purchase cost
    let isPriceVariance = false;
    let priceVariancePercent = 0;
    if (item.lastPurchaseCost && item.lastPurchaseCost > 0) {
      priceVariancePercent = Number((((unitCost - item.lastPurchaseCost) / item.lastPurchaseCost) * 100).toFixed(1));
      if (Math.abs(priceVariancePercent) >= 10) {
        isPriceVariance = true;
      }
    }

    return {
      item,
      qty,
      unitCost,
      baseAmount: baseAmountPaisa / 100,
      discountCalculated: discountPaisa / 100,
      netTaxableAmount: netPaisa / 100,
      vatCalculated: lineVatPaisa / 100,
      lineTotalCalculated: (netPaisa + lineVatPaisa) / 100,
      netPaisa,
      isPriceVariance,
      priceVariancePercent,
    };
  });

  const totalNetPaisa = subtotalPaisa - totalDiscountPaisa;
  const otherChargesPaisa = Math.round(Math.max(0, otherCharges) * 100);

  // Second pass: Apportion other charges (freight, customs) to calculate Landed Cost
  const calculatedLines: CalculatedPoLine[] = lineDetails.map((detail) => {
    let apportionedChargePaisa = 0;
    if (totalNetPaisa > 0 && otherChargesPaisa > 0) {
      apportionedChargePaisa = Math.round((detail.netPaisa / totalNetPaisa) * otherChargesPaisa);
    }

    const landedTotalPaisa = detail.netPaisa + apportionedChargePaisa;
    const landedPerUnit = Number((landedTotalPaisa / 100 / detail.qty).toFixed(2));

    // Expected margin against selling price
    let expectedMarginPercent = 0;
    const sellingPrice = Number(detail.item.expectedSellingPrice || 0);
    if (sellingPrice > 0 && landedPerUnit > 0) {
      expectedMarginPercent = Number((((sellingPrice - landedPerUnit) / sellingPrice) * 100).toFixed(1));
    }

    return {
      ...detail.item,
      baseAmount: detail.baseAmount,
      discountCalculated: detail.discountCalculated,
      netTaxableAmount: detail.netTaxableAmount,
      vatCalculated: detail.vatCalculated,
      lineTotalCalculated: detail.lineTotalCalculated,
      lineTotal: detail.lineTotalCalculated,
      vatAmount: detail.vatCalculated,
      apportionedCharges: apportionedChargePaisa / 100,
      landedCostTotal: landedTotalPaisa / 100,
      landedCostPerUnit: landedPerUnit,
      expectedMarginPercent,
      isPriceVariance: detail.isPriceVariance,
      priceVariancePercent: detail.priceVariancePercent,
    };
  });

  const grandTotalPaisa = totalNetPaisa + vatPaisa + otherChargesPaisa;

  return {
    subtotal: subtotalPaisa / 100,
    totalDiscount: totalDiscountPaisa / 100,
    taxableAmount: taxablePaisa / 100,
    vatAmount: vatPaisa / 100,
    otherCharges: otherChargesPaisa / 100,
    grandTotal: grandTotalPaisa / 100,
    lines: calculatedLines,
  };
}
