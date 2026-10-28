const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// 1. Calculate Luhn / Mod-10 Check Digit for 15 numeric digits
function calculateLuhnCheckDigit(digits15) {
  const clean = digits15.replace(/\D/g, '');
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    let digit = parseInt(clean[clean.length - 1 - i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

function generate16DigitBarcode(seq) {
  const seqPadded = String(seq).padStart(10, '0');
  const base15 = `89010${seqPadded}`;
  const check = calculateLuhnCheckDigit(base15);
  return `${base15}${check}`;
}

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function updateBarcodes() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('Connecting to database...');
  
  const products = await sql`
    SELECT id, name, sku, barcode 
    FROM products 
    ORDER BY name ASC
  `;

  console.log(`Found ${products.length} products to evaluate for 16-digit barcodes.`);

  let updatedCount = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const seq = i + 1;
    const barcode16 = generate16DigitBarcode(seq);

    // If barcode is null, empty, or not a 16-digit barcode
    if (!p.barcode || !/^\d{16}$/.test(p.barcode)) {
      await sql`
        UPDATE products 
        SET barcode = ${barcode16} 
        WHERE id = ${p.id}
      `;
      console.log(`[${seq}/${products.length}] Updated ${p.sku} (${p.name.slice(0, 30)}...) -> 16-Digit Barcode: ${barcode16}`);
      updatedCount++;
    } else {
      console.log(`[${seq}/${products.length}] ${p.sku} already has valid 16-digit barcode: ${p.barcode}`);
    }
  }

  console.log(`\n✅ Completed! Updated ${updatedCount} products with real 16-digit barcodes.`);
  
  // Verify APC product specifically
  const apc = await sql`SELECT id, name, sku, barcode FROM products WHERE sku = 'APC-UPS-1100VA'`;
  if (apc.length > 0) {
    console.log(`Verification: APC-UPS-1100VA barcode is now: ${apc[0].barcode} (Length: ${apc[0].barcode.length} digits)`);
  }

  await sql.end();
}

updateBarcodes().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
