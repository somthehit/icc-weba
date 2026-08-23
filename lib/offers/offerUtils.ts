// lib/offers/offerUtils.ts
// Pure client-safe offer calculation helpers that can be imported safely in React components.

import { Product } from "@/types";

/**
 * Pure client-side helper to compute effective price and offer status dynamically
 * for React state / rendering without requiring direct database or Node.js access.
 */
export function computeProductEffectivePrice(product: Product): {
  effectivePrice: number;
  onOffer: boolean;
  offerEndsAt: Date | null;
  timeRemainingMs: number;
  discountPercentage: number;
} {
  const basePrice = product.sellingPrice;

  if (!product.offer || !product.offer.enabled) {
    return {
      effectivePrice: basePrice,
      onOffer: false,
      offerEndsAt: null,
      timeRemainingMs: 0,
      discountPercentage: product.discountPercent || 0,
    };
  }

  const now = new Date();
  const startsAt = product.offer.startsAt ? new Date(product.offer.startsAt) : new Date(0);
  const endsAt = product.offer.endsAt ? new Date(product.offer.endsAt) : null;

  // Check if current time is within active offer window
  const isStarted = now >= startsAt;
  const isNotExpired = !endsAt || now <= endsAt;

  if (!isStarted || !isNotExpired) {
    // Offer window has expired or not started yet -> automatic revert!
    return {
      effectivePrice: basePrice,
      onOffer: false,
      offerEndsAt: endsAt,
      timeRemainingMs: 0,
      discountPercentage: 0,
    };
  }

  let discountAmount = 0;
  if (product.offer.discountType === 'percentage') {
    discountAmount = basePrice * (product.offer.discountValue / 100);
  } else {
    discountAmount = product.offer.discountValue;
  }

  const finalPrice = Math.round(Math.max(basePrice - discountAmount, 0));
  const timeRemainingMs = endsAt ? Math.max(endsAt.getTime() - now.getTime(), 0) : 0;
  const calcPct = Math.round(((basePrice - finalPrice) / basePrice) * 100);

  return {
    effectivePrice: finalPrice,
    onOffer: true,
    offerEndsAt: endsAt,
    timeRemainingMs,
    discountPercentage: calcPct > 0 ? calcPct : product.discountPercent || 0,
  };
}

/**
 * Format remaining milliseconds into human readable "Xd Yh Zm" string
 */
export function formatCountdownTime(timeRemainingMs: number): string {
  if (timeRemainingMs <= 0) return "Offer expired";
  const seconds = Math.floor((timeRemainingMs / 1000) % 60);
  const minutes = Math.floor((timeRemainingMs / (1000 * 60)) % 60);
  const hours = Math.floor((timeRemainingMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}
