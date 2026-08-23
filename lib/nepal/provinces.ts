// lib/nepal/provinces.ts
//
// Display names for the seven federal provinces.
//
// The database stores a `province_enum` code (`bagmati`), while the checkout form
// used to hold free text ("Bagmati Province") that matched nothing. This is the
// one place the two spellings meet, so an address saved from the form and a
// delivery zone's `provinces` list can be compared on the code.

export const PROVINCE_CODES = [
  'koshi',
  'madhesh',
  'bagmati',
  'gandaki',
  'lumbini',
  'karnali',
  'sudurpashchim',
] as const;

export type ProvinceCode = (typeof PROVINCE_CODES)[number];

export const PROVINCE_LABELS: Record<ProvinceCode, string> = {
  koshi: 'Koshi Province',
  madhesh: 'Madhesh Province',
  bagmati: 'Bagmati Province',
  gandaki: 'Gandaki Province',
  lumbini: 'Lumbini Province',
  karnali: 'Karnali Province',
  sudurpashchim: 'Sudurpashchim Province',
};

/** For a `<select>`: `[{ value: 'bagmati', label: 'Bagmati Province' }, …]`. */
export const PROVINCE_OPTIONS = PROVINCE_CODES.map((value) => ({
  value,
  label: PROVINCE_LABELS[value],
}));

/** The display name for a stored code, falling back to the code itself. */
export function provinceLabel(code: string | null | undefined): string {
  if (!code) return '';
  return PROVINCE_LABELS[code as ProvinceCode] ?? code;
}
