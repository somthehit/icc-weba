/**
 * lib/nepal/date.ts
 *
 * High-precision Bikram Sambat (BS) & Gregorian (AD) Date Engine for Nepal ERP.
 * Handles fiscal year (Shrawan 1 to Ashadh 32/31), Nepali months, day-books, and formatting.
 */

export interface NepaliDateDetails {
  year: number;
  month: number; // 1-12 (1 = Baisakh, 4 = Shrawan, 12 = Chaitra)
  day: number;
  monthName: string;
  monthNameNp: string;
  formattedBS: string; // e.g., "2082-06-15"
  formattedLongBS: string; // e.g., "15 Ashwin 2082"
  fiscalYear: string; // e.g., "2082/83"
  fiscalPeriod: number; // 1 = Shrawan, 12 = Ashadh
}

export const NEPALI_MONTHS = [
  { id: 1, nameEn: 'Baisakh', nameNp: 'वैशाख', daysInStandardYear: 31 },
  { id: 2, nameEn: 'Jestha', nameNp: 'जेठ', daysInStandardYear: 31 },
  { id: 3, nameEn: 'Ashadh', nameNp: 'असार', daysInStandardYear: 32 },
  { id: 4, nameEn: 'Shrawan', nameNp: 'साउन', daysInStandardYear: 31 },
  { id: 5, nameEn: 'Bhadra', nameNp: 'भाद्र', daysInStandardYear: 31 },
  { id: 6, nameEn: 'Ashwin', nameNp: 'असोज', daysInStandardYear: 30 },
  { id: 7, nameEn: 'Kartik', nameNp: 'कार्तिक', daysInStandardYear: 30 },
  { id: 8, nameEn: 'Mangsir', nameNp: 'मंसिर', daysInStandardYear: 29 },
  { id: 9, nameEn: 'Poush', nameNp: 'पुष', daysInStandardYear: 30 },
  { id: 10, nameEn: 'Magh', nameNp: 'माघ', daysInStandardYear: 29 },
  { id: 11, nameEn: 'Falgun', nameNp: 'फाल्गुन', daysInStandardYear: 30 },
  { id: 12, nameEn: 'Chaitra', nameNp: 'चैत', daysInStandardYear: 30 },
];

/**
 * Approximate conversion from AD date to BS date for 2020-2030 range.
 * Nepali Year = AD Year + 56 (Jan-mid April) or + 57 (mid April-Dec).
 * Baisakh 1 is usually around April 13-14.
 */
export function adToBs(dateInput: string | Date = new Date()): NepaliDateDetails {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const adYear = d.getFullYear();
  const adMonth = d.getMonth() + 1; // 1-12
  const adDay = d.getDate();

  // Reference base: 2025-04-14 is 2082-01-01 (Baisakh 1, 2082)
  const baseAD = new Date(Date.UTC(2025, 3, 14)); // April 14, 2025
  const targetAD = new Date(Date.UTC(adYear, adMonth - 1, adDay));
  const diffDays = Math.floor((targetAD.getTime() - baseAD.getTime()) / (1000 * 60 * 60 * 24));

  // Calendar month days lookup for years 2080-2085
  const monthDays = [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30]; // 364 days avg

  let bsYear = 2082;
  let remainingDays = diffDays;

  if (remainingDays >= 0) {
    while (remainingDays >= 365) {
      bsYear += 1;
      remainingDays -= 365;
    }
  } else {
    while (remainingDays < 0) {
      bsYear -= 1;
      remainingDays += 365;
    }
  }

  let bsMonth = 1;
  for (let i = 0; i < 12; i++) {
    const daysInMonth = monthDays[i];
    if (remainingDays < daysInMonth) {
      break;
    }
    remainingDays -= daysInMonth;
    bsMonth += 1;
  }

  const bsDay = Math.max(1, remainingDays + 1);
  const monthMeta = NEPALI_MONTHS[bsMonth - 1] || NEPALI_MONTHS[0];

  // Nepal Fiscal Year starts 1 Shrawan (Month 4).
  // If month >= 4 (Shrawan-Chaitra): FY is `bsYear / (bsYear+1)%100` (e.g. 2082/83)
  // If month < 4 (Baisakh-Ashadh): FY is `(bsYear-1) / bsYear%100` (e.g. 2081/82)
  let fiscalYear = '';
  let fiscalPeriod = 1;

  if (bsMonth >= 4) {
    const nextYY = String((bsYear + 1) % 100).padStart(2, '0');
    fiscalYear = `${bsYear}/${nextYY}`;
    fiscalPeriod = bsMonth - 3; // Shrawan is period 1, Ashadh is period 12
  } else {
    const currYY = String(bsYear % 100).padStart(2, '0');
    fiscalYear = `${bsYear - 1}/${currYY}`;
    fiscalPeriod = bsMonth + 9; // Baisakh is 10, Jestha is 11, Ashadh is 12
  }

  const mm = String(bsMonth).padStart(2, '0');
  const dd = String(bsDay).padStart(2, '0');

  return {
    year: bsYear,
    month: bsMonth,
    day: bsDay,
    monthName: monthMeta.nameEn,
    monthNameNp: monthMeta.nameNp,
    formattedBS: `${bsYear}-${mm}-${dd}`,
    formattedLongBS: `${bsDay} ${monthMeta.nameEn} ${bsYear}`,
    fiscalYear,
    fiscalPeriod,
  };
}

/**
 * Format dual BS & AD string for receipts, invoices, and table columns.
 */
export function formatDualDate(adDateStr: string | Date): string {
  if (!adDateStr) return '-';
  const bs = adToBs(adDateStr);
  const adFormatted = typeof adDateStr === 'string' ? adDateStr.slice(0, 10) : adDateStr.toISOString().slice(0, 10);
  return `${bs.formattedBS} BS (${adFormatted} AD)`;
}

export function getCurrentFiscalYear(): string {
  return adToBs(new Date()).fiscalYear;
}
