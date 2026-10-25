import { toPaisa, fromPaisa, formatNpr, sanitizeNumericAmount } from '../lib/nepal/money';

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}\n      Expected: "${expected}"\n      Actual:   "${actual}"`);
  }
}

console.log('--- Testing Safe Nepali Money Engine ---');

// 1. Never renders NaN on bad inputs
assertEqual(formatNpr(undefined), 'NPR 0.00', 'undefined returns NPR 0.00');
assertEqual(formatNpr(null), 'NPR 0.00', 'null returns NPR 0.00');
assertEqual(formatNpr('NaN'), 'NPR 0.00', '"NaN" string returns NPR 0.00');
assertEqual(formatNpr(NaN), 'NPR 0.00', 'NaN value returns NPR 0.00');
assertEqual(formatNpr(''), 'NPR 0.00', 'empty string returns NPR 0.00');
assertEqual(formatNpr('bad-string'), 'NPR 0.00', 'invalid string returns NPR 0.00');

// 2. Standard positive formatting with Nepali grouping
assertEqual(formatNpr(0), 'NPR 0.00', 'zero returns NPR 0.00');
assertEqual(formatNpr(50), 'NPR 50.00', 'two digits: NPR 50.00');
assertEqual(formatNpr(1000), 'NPR 1,000.00', 'one thousand: NPR 1,000.00');
assertEqual(formatNpr(145000), 'NPR 1,45,000.00', 'one lakh forty-five thousand: NPR 1,45,000.00');
assertEqual(formatNpr('485000.50'), 'NPR 4,85,000.50', 'string with decimals: NPR 4,85,000.50');
assertEqual(formatNpr('1234567.89'), 'NPR 12,34,567.89', 'twelve lakh: NPR 12,34,567.89');

// 3. Negative formatting
assertEqual(formatNpr(-54000), '- NPR 54,000.00', 'negative number: - NPR 54,000.00');
assertEqual(formatNpr('-18500.75'), '- NPR 18,500.75', 'negative string: - NPR 18,500.75');

// 4. Options: showSign and showCurrency
assertEqual(formatNpr(145000, { showSign: true }), '+ NPR 1,45,000.00', 'showSign +: + NPR 1,45,000.00');
assertEqual(formatNpr(145000, { showCurrency: false }), '1,45,000.00', 'showCurrency false: 1,45,000.00');

// 5. Paisa precision math
assertEqual(toPaisa('145000.50'), 14500050, 'toPaisa handles string correctly');
assertEqual(fromPaisa(14500050), '145000.50', 'fromPaisa handles integers correctly');
assertEqual(sanitizeNumericAmount('1,45,000.50'), '145000.50', 'sanitizeNumericAmount removes commas');

console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
