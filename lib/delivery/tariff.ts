// lib/delivery/tariff.ts
//
// Core tariff and fare calculation logic for Nepal logistics & courier dispatch.
// Supports:
// 1. Billable Weight determination (Max of Actual vs Volumetric Weight)
// 2. Base weight & incremental per-kg tiered rates
// 3. Remote / Out of Delivery Area (ODA) Surcharge
// 4. COD Handling rules (Flat fee + Percentage of order value)
// 5. Free Shipping threshold waiver

export interface TariffRule {
  baseWeightKg: number; // e.g. 1.0 (kg)
  baseRate: number; // e.g. NPR 100
  additionalPerKgRate: number; // e.g. NPR 30
  volumetricDivisor?: number; // default: 5000 (IATA standard: L*W*H / 5000)
  codPercent: number; // e.g. 0.015 (1.5%)
  codFlatFee: number; // e.g. NPR 20
  freeShippingThreshold: number; // e.g. NPR 5000 (0 to disable)
  remoteSurcharge: number; // e.g. NPR 50
}

export interface VolumetricDimensionsCm {
  l: number; // Length in cm
  w: number; // Width in cm
  h: number; // Height in cm
}

export interface CalculateShippingInput {
  orderValue: number;
  actualWeightKg: number;
  volumetricDimensionsCm?: VolumetricDimensionsCm;
  isCod: boolean;
  isRemoteArea?: boolean;
  rule: TariffRule;
}

export interface TariffCalculationResult {
  chargeableWeightKg: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  isVolumetricApplied: boolean;
  baseFreight: number;
  incrementalFreight: number;
  freightFee: number;
  remoteSurchargeFee: number;
  codFee: number;
  totalDeliveryCharge: number;
  isFreeShipping: boolean;
  breakdown: {
    baseWeightCoveredKg: number;
    extraWeightKg: number;
    extraWeightCharge: number;
    codFlatPortion: number;
    codPercentPortion: number;
  };
}

/**
 * Calculates shipping cost according to standard logistics rules:
 * - Free shipping applies if orderValue >= freeShippingThreshold (when threshold > 0)
 * - Billable weight = ceil(max(actualWeight, (L*W*H)/volumetricDivisor))
 * - Freight = baseRate + ceil(extraKg) * additionalPerKgRate + remoteSurcharge
 * - COD fee = codFlatFee + (orderValue * codPercent)
 */
export function calculateShippingCost(
  orderValue: number,
  actualWeightKg: number,
  volumetricDimensionsCm: VolumetricDimensionsCm | undefined,
  isCod: boolean,
  isRemoteArea: boolean = false,
  rule: TariffRule,
): TariffCalculationResult {
  const divisor = rule.volumetricDivisor && rule.volumetricDivisor > 0 ? rule.volumetricDivisor : 5000;

  // 1. Calculate volumetric weight
  const volWeightRaw = volumetricDimensionsCm
    ? (Math.max(0, volumetricDimensionsCm.l) *
        Math.max(0, volumetricDimensionsCm.w) *
        Math.max(0, volumetricDimensionsCm.h)) /
      divisor
    : 0;

  const actualWeight = Math.max(0, actualWeightKg);
  const rawMaxWeight = Math.max(actualWeight, volWeightRaw);
  // Chargeable weight is rounded up to the nearest integer kg (or 1 if < 1)
  const chargeableWeight = Math.max(1, Math.ceil(rawMaxWeight));
  const isVolumetricApplied = volWeightRaw > actualWeight;

  // 2. Free Shipping Check
  if (rule.freeShippingThreshold > 0 && orderValue >= rule.freeShippingThreshold) {
    return {
      chargeableWeightKg: chargeableWeight,
      actualWeightKg: actualWeight,
      volumetricWeightKg: Number(volWeightRaw.toFixed(2)),
      isVolumetricApplied,
      baseFreight: 0,
      incrementalFreight: 0,
      freightFee: 0,
      remoteSurchargeFee: 0,
      codFee: 0,
      totalDeliveryCharge: 0,
      isFreeShipping: true,
      breakdown: {
        baseWeightCoveredKg: rule.baseWeightKg,
        extraWeightKg: 0,
        extraWeightCharge: 0,
        codFlatPortion: 0,
        codPercentPortion: 0,
      },
    };
  }

  // 3. Weight-based Freight
  const baseFreight = Math.max(0, rule.baseRate);
  let incrementalFreight = 0;
  let extraWeight = 0;

  if (chargeableWeight > rule.baseWeightKg) {
    extraWeight = chargeableWeight - rule.baseWeightKg;
    incrementalFreight = extraWeight * Math.max(0, rule.additionalPerKgRate);
  }

  let totalFreight = baseFreight + incrementalFreight;

  // 4. Remote / ODA (Out of Delivery Area) Surcharge
  const remoteSurchargeFee = isRemoteArea ? Math.max(0, rule.remoteSurcharge) : 0;
  totalFreight += remoteSurchargeFee;

  // 5. COD Handling Fee
  let codFlatPortion = 0;
  let codPercentPortion = 0;
  let codFee = 0;

  if (isCod) {
    codFlatPortion = Math.max(0, rule.codFlatFee);
    codPercentPortion = Math.max(0, orderValue * Math.max(0, rule.codPercent));
    codFee = codFlatPortion + codPercentPortion;
  }

  return {
    chargeableWeightKg: chargeableWeight,
    actualWeightKg: actualWeight,
    volumetricWeightKg: Number(volWeightRaw.toFixed(2)),
    isVolumetricApplied,
    baseFreight: Math.round(baseFreight),
    incrementalFreight: Math.round(incrementalFreight),
    freightFee: Math.round(baseFreight + incrementalFreight),
    remoteSurchargeFee: Math.round(remoteSurchargeFee),
    codFee: Math.round(codFee),
    totalDeliveryCharge: Math.round(totalFreight + codFee),
    isFreeShipping: false,
    breakdown: {
      baseWeightCoveredKg: rule.baseWeightKg,
      extraWeightKg: extraWeight,
      extraWeightCharge: Math.round(incrementalFreight),
      codFlatPortion: Math.round(codFlatPortion),
      codPercentPortion: Math.round(codPercentPortion),
    },
  };
}

/** Formats COD summary rule string e.g. "Free (0%)", "1.5% + NPR 20", or "Prepaid Only" */
export function formatCodChargeLabel(codAvailable: boolean, codFlatFee?: number, codPercent?: number): string {
  if (!codAvailable) return 'Prepaid Only';
  const flat = codFlatFee ?? 0;
  const pct = (codPercent ?? 0) * 100;

  if (flat === 0 && pct === 0) return 'Free (0%)';
  if (flat > 0 && pct > 0) return `${pct}% + NPR ${flat}`;
  if (pct > 0) return `${pct}% of order`;
  return `NPR ${flat} flat`;
}

export interface CartShippingItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isPhysicalProduct?: boolean;
  requiresShipping?: boolean;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  isFreeShipping?: boolean;
  fixedShippingFee?: number;
}

export interface CartShippingCalculationResult {
  totalDeliveryCharge: number;
  totalActualWeightKg: number;
  totalVolumetricWeightKg: number;
  totalChargeableWeightKg: number;
  hasPhysicalItems: boolean;
  isEntirelyFreeShipping: boolean;
  fixedShippingTotal: number;
  standardFreightTotal: number;
  codFee: number;
  remoteSurchargeFee: number;
  breakdown: TariffCalculationResult | null;
}

/**
 * Calculates delivery fees across an entire cart of heterogeneous products,
 * handling digital items, free shipping flags, flat fee overrides, and tiered weight tariffs.
 */
export function calculateCartShipping(
  items: CartShippingItem[],
  isCod: boolean,
  isRemoteArea: boolean = false,
  rule: TariffRule,
): CartShippingCalculationResult {
  const physicalItems = items.filter(
    (item) => item.isPhysicalProduct !== false && item.requiresShipping !== false,
  );

  if (physicalItems.length === 0) {
    return {
      totalDeliveryCharge: 0,
      totalActualWeightKg: 0,
      totalVolumetricWeightKg: 0,
      totalChargeableWeightKg: 0,
      hasPhysicalItems: false,
      isEntirelyFreeShipping: true,
      fixedShippingTotal: 0,
      standardFreightTotal: 0,
      codFee: 0,
      remoteSurchargeFee: 0,
      breakdown: null,
    };
  }

  const divisor = rule.volumetricDivisor && rule.volumetricDivisor > 0 ? rule.volumetricDivisor : 5000;

  let totalActualWeightKg = 0;
  let totalVolumetricWeightKg = 0;
  let fixedShippingTotal = 0;
  let standardItemsOrderValue = 0;
  const entireOrderValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let hasStandardWeightItems = false;

  for (const item of physicalItems) {
    const qty = Math.max(1, item.quantity);

    // Free shipping items don't accumulate freight
    if (item.isFreeShipping) {
      continue;
    }

    // Fixed shipping fee items
    if (item.fixedShippingFee !== undefined && item.fixedShippingFee !== null && item.fixedShippingFee >= 0) {
      fixedShippingTotal += item.fixedShippingFee * qty;
      continue;
    }

    // Standard tariff items (default to 0.5kg if unspecified)
    hasStandardWeightItems = true;
    const unitActualWeight = item.weightKg !== undefined && item.weightKg !== null && item.weightKg > 0 ? item.weightKg : 0.5;
    totalActualWeightKg += unitActualWeight * qty;

    if (item.lengthCm && item.widthCm && item.heightCm) {
      const unitVolumetric = (item.lengthCm * item.widthCm * item.heightCm) / divisor;
      totalVolumetricWeightKg += unitVolumetric * qty;
    }

    standardItemsOrderValue += item.price * qty;
  }

  // If order qualifies for global free shipping threshold
  const isGlobalFreeShipping = rule.freeShippingThreshold > 0 && entireOrderValue >= rule.freeShippingThreshold;

  if (isGlobalFreeShipping) {
    return {
      totalDeliveryCharge: 0,
      totalActualWeightKg: Number(totalActualWeightKg.toFixed(2)),
      totalVolumetricWeightKg: Number(totalVolumetricWeightKg.toFixed(2)),
      totalChargeableWeightKg: Math.max(1, Math.ceil(Math.max(totalActualWeightKg, totalVolumetricWeightKg))),
      hasPhysicalItems: true,
      isEntirelyFreeShipping: true,
      fixedShippingTotal: 0,
      standardFreightTotal: 0,
      codFee: 0,
      remoteSurchargeFee: 0,
      breakdown: null,
    };
  }

  let standardTariffResult: TariffCalculationResult | null = null;
  if (hasStandardWeightItems) {
    // Treat the aggregated volumetric weight as a single virtual parcel
    standardTariffResult = calculateShippingCost(
      standardItemsOrderValue,
      totalActualWeightKg,
      totalVolumetricWeightKg > 0 ? { l: totalVolumetricWeightKg * divisor, w: 1, h: 1 } : undefined,
      isCod,
      isRemoteArea,
      rule,
    );
  }

  const standardFreight = standardTariffResult ? standardTariffResult.freightFee : 0;
  const codFee = standardTariffResult ? standardTariffResult.codFee : (isCod ? rule.codFlatFee + entireOrderValue * rule.codPercent : 0);
  const remoteSurchargeFee = isRemoteArea && hasStandardWeightItems ? rule.remoteSurcharge : 0;

  const totalDeliveryCharge = Math.round(standardFreight + fixedShippingTotal + (isCod ? codFee : 0));
  const chargeableWeight = Math.max(1, Math.ceil(Math.max(totalActualWeightKg, totalVolumetricWeightKg)));

  return {
    totalDeliveryCharge,
    totalActualWeightKg: Number(totalActualWeightKg.toFixed(2)),
    totalVolumetricWeightKg: Number(totalVolumetricWeightKg.toFixed(2)),
    totalChargeableWeightKg: chargeableWeight,
    hasPhysicalItems: true,
    isEntirelyFreeShipping: totalDeliveryCharge === 0,
    fixedShippingTotal: Math.round(fixedShippingTotal),
    standardFreightTotal: Math.round(standardFreight),
    codFee: Math.round(codFee),
    remoteSurchargeFee: Math.round(remoteSurchargeFee),
    breakdown: standardTariffResult,
  };
}
