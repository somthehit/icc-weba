const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function check() {
  console.log('Connecting to DB...');
  const sql = postgres(dbUrl, { ssl: 'require' });
  const rows = await sql`SELECT id, name, sku, barcode, stock_quantity, stock_status, base_price FROM products LIMIT 5`;
  console.log('Found', rows.length, 'products in PostgreSQL:');
  for (const r of rows) {
    console.log(`- [ID ${r.id}] ${r.name} | SKU: ${r.sku} | Barcode: ${r.barcode || 'N/A'} | Stock: ${r.stock_quantity} (${r.stock_status}) | Price: Rs. ${r.base_price}`);
  }
  await sql.end();
}

check().catch(console.error);
