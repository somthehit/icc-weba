/**
 * lib/barcode/barcode16.ts
 *
 * Real 16-Digit Barcode Engine for Retail & Enterprise POS
 * Standard: 16 numeric digits (GS1 / Code 128-C symbology)
 * Structure: 890 (Country: Nepal) + 10 (Store: ICC) + 10-digit Item Sequence + 1 Luhn Check Digit = 16 digits
 */

// 1. Calculate Luhn / Mod-10 Check Digit for 15 numeric digits
export function calculateLuhnCheckDigit(digits15: string): number {
  const clean = digits15.replace(/\D/g, '');
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    let digit = parseInt(clean[clean.length - 1 - i], 10);
    // Double every second digit from the right (1-indexed from right: odd positions unchanged, even doubled)
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

// 2. Validate if string is a valid 16-digit numeric barcode
export function is16DigitBarcode(code: string | null | undefined): boolean {
  if (!code) return false;
  const clean = String(code).trim().replace(/\s/g, '');
  if (!/^\d{16}$/.test(clean)) return false;
  const base15 = clean.slice(0, 15);
  const check = parseInt(clean[15], 10);
  return calculateLuhnCheckDigit(base15) === check;
}

// 3. Generate a 16-digit barcode deterministically from sequence number or text
export function generate16DigitBarcode(seed: number | string): string {
  let seqNum: number;
  if (typeof seed === 'number' && Number.isFinite(seed) && seed > 0) {
    seqNum = Math.floor(seed);
  } else {
    // Generate deterministic positive integer hash from string (e.g. UUID, SKU, or slug)
    const str = String(seed || 'item');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) >>> 0; // 32-bit positive integer
    }
    seqNum = (hash % 9000000000) + 1000000000; // 10-digit number
  }

  // Format: 890 (Nepal) + 10 (ICC Store) + 10-digit sequence (15 digits)
  const seqPadded = String(seqNum).slice(-10).padStart(10, '0');
  const base15 = `89010${seqPadded}`;
  const checkDigit = calculateLuhnCheckDigit(base15);
  return `${base15}${checkDigit}`;
}

// 4. Format 16-digit barcode with readable spacing (e.g. 8901 0000 0000 0015)
export function format16DigitBarcode(code: string | null | undefined): string {
  if (!code) return 'N/A';
  const clean = String(code).trim().replace(/\s/g, '');
  if (clean.length === 16) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
  }
  return clean;
}

// 5. Authentic Code 128 Table C Patterns (107 patterns, each pattern is 11 modules wide, Stop is 13)
// 1 = bar, 0 = space
const CODE128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', // 0-4
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000', // 5-9
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', // 10-14
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100', // 15-19
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100', // 20-24
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010', // 25-29
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', // 30-34
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000', // 35-39
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', // 40-44
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110', // 45-49
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', // 50-54
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010', // 55-59
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', // 60-64
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000', // 65-69
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', // 70-74
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010', // 75-79
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', // 80-84
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110', // 85-89
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', // 90-94
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110', // 95-99
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000', // 100-104
  '11010011100', // 105: Start C
  '1100011101011' // 106: Stop (13 modules)
];

/**
 * Generate a 100% compliant Code 128-C SVG barcode for a 16-digit numeric barcode
 */
export function generate16DigitBarcodeSvg(barcode16: string, height = 48, width = 240): string {
  const clean = barcode16.replace(/\D/g, '').padEnd(16, '0').slice(0, 16);
  
  // Code 128 Subset C encodes two digits per symbol: 16 digits = 8 pairs
  const pairs: number[] = [];
  for (let i = 0; i < 16; i += 2) {
    pairs.push(parseInt(clean.slice(i, i + 2), 10));
  }

  // Start Code C is pattern index 105
  let checksum = 105;
  const symbolIndices = [105];

  for (let i = 0; i < pairs.length; i++) {
    const val = pairs[i];
    symbolIndices.push(val);
    checksum += (i + 1) * val;
  }

  const checkSymbol = checksum % 103;
  symbolIndices.push(checkSymbol);
  symbolIndices.push(106); // Stop code

  // Build binary string of modules (1 = black bar, 0 = white space)
  let binaryString = '0000000000'; // Quiet zone
  for (const idx of symbolIndices) {
    binaryString += CODE128_PATTERNS[idx] || '10101010101';
  }
  binaryString += '0000000000'; // Quiet zone

  const totalModules = binaryString.length;
  const moduleWidth = width / totalModules;

  let barsSvg = '';
  let inBar = false;
  let barStart = 0;

  for (let m = 0; m <= totalModules; m++) {
    const isOne = m < totalModules && binaryString[m] === '1';
    if (isOne && !inBar) {
      inBar = true;
      barStart = m;
    } else if (!isOne && inBar) {
      inBar = false;
      const x = (barStart * moduleWidth).toFixed(2);
      const w = ((m - barStart) * moduleWidth).toFixed(2);
      barsSvg += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#0f172a" />`;
    }
  }

  const formattedLabel = format16DigitBarcode(clean);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 18}" width="${width}" height="${height + 18}" style="display:block;margin:0 auto;max-width:100%;">
    <rect width="100%" height="100%" fill="#ffffff" />
    <g transform="translate(0, 2)">
      ${barsSvg}
    </g>
    <text x="${width / 2}" y="${height + 15}" text-anchor="middle" font-family="'JetBrains Mono', 'SF Mono', Consolas, monospace" font-size="11" font-weight="700" letter-spacing="1.5" fill="#0f172a">
      ${formattedLabel}
    </text>
  </svg>`;
}

/**
 * Generate Printable Retail Label HTML (Thermal 50mm x 30mm or Sheet)
 */
export function generate16DigitPrintableLabelHtml(params: {
  productName: string;
  sku: string;
  barcode: string;
  price: number;
  category?: string;
  brand?: string;
  quantity?: number;
}): string {
  const { productName, sku, barcode, price, category, brand, quantity = 1 } = params;
  const barcodeSvg = generate16DigitBarcodeSvg(barcode, 42, 210);
  const formattedPrice = Number(price).toLocaleString('en-IN');

  const singleLabel = `
    <div class="label-sticker">
      <div class="store-header">
        <span class="brand-tag">INTEL COMPUTER CENTER</span>
        <span class="branch-tag">KTM / JAULAKHEL</span>
      </div>
      <div class="product-name" title="${escapeHtml(productName)}">
        ${escapeHtml(productName)}
      </div>
      <div class="meta-row">
        <span>SKU: <strong>${escapeHtml(sku)}</strong></span>
        ${brand ? `<span>${escapeHtml(brand)}</span>` : ''}
      </div>
      <div class="barcode-wrapper">
        ${barcodeSvg}
      </div>
      <div class="footer-row">
        <div class="vat-note">MRP (INCL. 13% VAT)</div>
        <div class="price-val">Rs. ${formattedPrice}</div>
      </div>
    </div>
  `;

  const allLabels = Array.from({ length: Math.max(1, quantity) })
    .map(() => singleLabel)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Label - ${escapeHtml(sku)}</title>
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
    }
    .print-sheet {
      display: flex;
      flex-wrap: wrap;
      gap: 3mm;
      padding: 3mm;
      justify-content: center;
    }
    .label-sticker {
      width: 50mm;
      height: 30mm;
      padding: 1.8mm 2.2mm;
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 3px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .store-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 0.5px solid #e2e8f0;
      padding-bottom: 0.8mm;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .branch-tag {
      font-size: 5pt;
      color: #64748b;
      font-weight: 600;
    }
    .product-name {
      font-size: 7pt;
      font-weight: 700;
      line-height: 1.15;
      color: #0f172a;
      max-height: 5.5mm;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin: 0.8mm 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 5.5pt;
      color: #475569;
      font-family: monospace;
    }
    .barcode-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0.5mm 0;
    }
    .barcode-wrapper svg {
      width: 100%;
      height: auto;
      max-height: 10.5mm;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-top: 0.5px solid #0f172a;
      padding-top: 0.8mm;
    }
    .vat-note {
      font-size: 5pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.2px;
    }
    .price-val {
      font-size: 8.5pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .print-sheet {
        padding: 0;
        gap: 0;
      }
      .label-sticker {
        border: none;
        width: 50mm;
        height: 30mm;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="print-sheet">
    ${allLabels}
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
