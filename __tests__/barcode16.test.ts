import assert from 'node:assert/strict';
import {
  calculateLuhnCheckDigit,
  generate16DigitBarcode,
  is16DigitBarcode,
  format16DigitBarcode,
  generate16DigitBarcodeSvg,
  generate16DigitPrintableLabelHtml,
} from '../lib/barcode/barcode16';

console.log('🚀 Running 16-Digit Barcode Engine Test Suite...\n');

// 1. Length & Prefix Test
const barcode1 = generate16DigitBarcode(1);
assert.equal(barcode1.length, 16, 'Barcode must be exactly 16 digits');
assert.match(barcode1, /^\d{16}$/, 'Barcode must only contain numeric digits');
assert.ok(barcode1.startsWith('89010'), 'Barcode should start with Nepal country prefix (890) + store (10)');
console.log('✅ Test 1 Passed: 16-digit length & prefix validation (89010...)');

// 2. Sequential Uniqueness & Determinism Test
const barcode2 = generate16DigitBarcode(2);
const barcode3 = generate16DigitBarcode(3);
assert.notEqual(barcode1, barcode2, 'Different sequences must yield different barcodes');
assert.notEqual(barcode2, barcode3, 'Sequential barcodes must be unique');
assert.equal(generate16DigitBarcode(1), barcode1, 'Same sequence must yield deterministic barcode');
console.log('✅ Test 2 Passed: Sequential uniqueness & deterministic reproducibility');

// 3. Luhn / Mod-10 Check Digit Validation Test
assert.equal(is16DigitBarcode(barcode1), true, 'Generated barcode must pass Luhn verification');
assert.equal(is16DigitBarcode(barcode2), true, 'Generated barcode 2 must pass Luhn verification');
assert.equal(is16DigitBarcode(barcode3), true, 'Generated barcode 3 must pass Luhn verification');

// Tampered check digit should be rejected
const tamperedLast = barcode1.slice(0, 15) + ((parseInt(barcode1[15], 10) + 1) % 10);
assert.equal(is16DigitBarcode(tamperedLast), false, 'Tampered check digit must fail validation');

// Non-16-digit strings should be rejected
assert.equal(is16DigitBarcode('APC-UPS-1100VA'), false, 'Text SKU must not be recognized as 16-digit barcode');
assert.equal(is16DigitBarcode('123456789'), false, 'Short number must fail validation');
assert.equal(is16DigitBarcode(null), false, 'Null must return false');
console.log('✅ Test 3 Passed: Strict Luhn / Mod-10 check digit verification & rejection of text SKUs');

// 4. Readable Spacing Formatting Test
const rawBarcode = '8901000000000011';
const formatted = format16DigitBarcode(rawBarcode);
assert.equal(formatted, '8901 0000 0000 0011', 'Barcode must be grouped in 4-digit chunks for human readability');
console.log('✅ Test 4 Passed: 4-4-4-4 grouped readability formatting');

// 5. Code 128-C SVG Barcode Graphics Generation Test
const svg = generate16DigitBarcodeSvg(rawBarcode, 40, 220);
assert.ok(svg.includes('<svg'), 'Output must be valid SVG element');
assert.ok(svg.includes('</svg>'), 'Output must close SVG element');
assert.ok(svg.includes('<rect'), 'Output must contain bar rect elements');
assert.ok(svg.includes('8901 0000 0000 0011'), 'Output must include legible formatted text label');
console.log('✅ Test 5 Passed: Code 128-C SVG barcode graphic generation');

// 6. Complete Thermal Label Printable HTML Test
const html = generate16DigitPrintableLabelHtml({
  productName: 'APC Back-UPS 1100VA 230V AVR Uninterruptible Power Supply (BX1100C-IN)',
  sku: 'APC-UPS-1100VA',
  barcode: '8901000000000011',
  price: 11500,
  brand: 'APC',
  category: 'Electronics & Appliances',
  quantity: 2,
});

assert.ok(html.includes('INTEL COMPUTER CENTER'), 'Label must include store brand name');
assert.ok(html.includes('APC-UPS-1100VA'), 'Label must display SKU');
assert.ok(html.includes('Rs. 11,500'), 'Label must display price in NPR');
assert.ok(html.includes('50mm 30mm'), 'Label must specify 50x30mm thermal label page size');
assert.ok(html.includes('window.print()'), 'Label HTML must trigger print dialog');
assert.equal(html.split('class="label-sticker"').length - 1, 2, 'Must generate exactly 2 stickers');
console.log('✅ Test 6 Passed: Thermal label 50mm x 30mm print template rendering');

console.log('\n🎉 ALL 6/6 16-DIGIT BARCODE TESTS PASSED PERFECTLY!\n');
