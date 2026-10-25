/**
 * lib/nepal/money.ts
 *
 * Safe Nepali Currency & Paisa Arithmetic Engine for ERP & Bank Reconciliation.
 * - Guarantees NO float math precision loss.
 * - Stores money as fixed-precision numeric string or integer Paisa (1 NPR = 100 Paisa).
 * - Bulletproof formatter that NEVER renders "NaN".
 * - Follows Nepali/South-Asian grouping conventions (e.g. 12,34,567.89).
 */

/**
 * Convert any string, number, null, or undefined to safe integer Paisa.
 * Avoids IEEE-754 float rounding errors by parsing numeric strings directly.
 */
export function toPaisa(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  if (typeof amount === 'number') {
    if (isNaN(amount) || !isFinite(amount)) return 0;
    return Math.round(amount * 100);
  }

  const clean = String(amount).trim().replace(/,/g, '');
  if (!clean || clean === 'NaN' || clean === 'null' || clean === 'undefined') return 0;

  const num = parseFloat(clean);
  if (isNaN(num) || !isFinite(num)) return 0;

  // Split on decimal to avoid float math
  const parts = clean.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  if (isNaN(whole)) return 0;

  const sign = whole < 0 || clean.startsWith('-') ? -1 : 1;
  const absWhole = Math.abs(whole);
  const fractionStr = (parts[1] || '').slice(0, 2).padEnd(2, '0');
  const fraction = parseInt(fractionStr, 10) || 0;

  return sign * (absWhole * 100 + fraction);
}

/**
 * Convert integer Paisa back to fixed 2-decimal string (e.g. 14500000 -> "145000.00").
 */
export function fromPaisa(paisa: number): string {
  if (isNaN(paisa) || !isFinite(paisa)) return '0.00';
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(Math.round(paisa));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/**
 * Format a number using Nepali/Indian comma system:
 * Last 3 digits grouped together, followed by pairs of 2 digits (e.g. 1,45,000.00).
 */
export function formatNepaliNumber(valStr: string): string {
  const parts = valStr.split('.');
  const wholeStr = parts[0] || '0';
  const fracStr = parts[1] || '00';

  const sign = wholeStr.startsWith('-') ? '-' : '';
  const absWhole = wholeStr.replace('-', '');

  if (absWhole.length <= 3) {
    return `${sign}${absWhole}.${fracStr}`;
  }

  const lastThree = absWhole.slice(-3);
  const remaining = absWhole.slice(0, -3);

  // Group pairs from right to left
  const groups: string[] = [];
  let i = remaining.length;
  while (i > 0) {
    const start = Math.max(0, i - 2);
    groups.unshift(remaining.slice(start, i));
    i -= 2;
  }

  return `${sign}${groups.join(',')},${lastThree}.${fracStr}`;
}

export interface MoneyFormatOptions {
  showCurrency?: boolean; // prefix "NPR " (default true)
  showSign?: boolean; // prefix "+" for positive values (default false)
  compact?: boolean; // e.g. "1.5L" for large summaries
  showFraction?: boolean; // include .00 decimals (default true)
}

/**
 * Safe NPR Money Formatter.
 * NEVER renders "NaN". Guaranteed to always output a valid, clean string.
 *
 * Examples:
 *   formatNpr(145000) => "NPR 1,45,000.00"
 *   formatNpr(-54000) => "- NPR 54,000.00"
 *   formatNpr(undefined) => "NPR 0.00"
 *   formatNpr(null) => "NPR 0.00"
 *   formatNpr("NaN") => "NPR 0.00"
 */
export function formatNpr(
  amount: string | number | null | undefined,
  options?: MoneyFormatOptions
): string {
  const showCurrency = options?.showCurrency ?? true;
  const showSign = options?.showSign ?? false;
  const showFraction = options?.showFraction ?? true;

  const paisa = toPaisa(amount);
  const isNegative = paisa < 0;
  const absPaisa = Math.abs(paisa);

  let rawFixed = fromPaisa(absPaisa);
  if (!showFraction) {
    rawFixed = rawFixed.split('.')[0] + '.00';
  }

  let formattedNum = formatNepaliNumber(rawFixed);
  if (!showFraction) {
    formattedNum = formattedNum.split('.')[0];
  }

  const currencyPrefix = showCurrency ? 'NPR ' : '';

  if (isNegative) {
    return `- ${currencyPrefix}${formattedNum}`;
  }

  if (showSign && paisa > 0) {
    return `+ ${currencyPrefix}${formattedNum}`;
  }

  return `${currencyPrefix}${formattedNum}`;
}

/**
 * Parse an entered amount into standard fixed numeric string or 0.00
 */
export function sanitizeNumericAmount(amount: string | number | null | undefined): string {
  return fromPaisa(toPaisa(amount));
}
