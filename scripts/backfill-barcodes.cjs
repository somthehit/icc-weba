const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function backfillBarcodes() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  const products = await sql`SELECT id, sku, barcode FROM products`;
  for (const p of products) {
    if (!p.barcode) {
      // Generate EAN-13 style or SKU-based barcode
      const barcode = '890' + String(p.id).padStart(9, '0') + '1';
      await sql`UPDATE products SET barcode = ${barcode} WHERE id = ${p.id}`;
      console.log(`Product #${p.id} (${p.sku}) barcode set to ${barcode}`);
    }
  }
  console.log('Barcodes backfilled successfully!');
  await sql.end();
}

backfillBarcodes().catch(console.error);
