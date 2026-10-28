const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function run() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  const countRes = await sql`SELECT count(*) as total, count(barcode) as with_barcode FROM products`;
  console.log('Total products:', countRes[0].total, '| With barcode:', countRes[0].with_barcode);
  
  const sample = await sql`SELECT id, name, sku, barcode FROM products ORDER BY name ASC LIMIT 10`;
  console.log('Sample products:');
  for (const s of sample) {
    console.log(`- [${s.sku}] ${s.name.slice(0, 40)} -> Barcode: ${s.barcode}`);
  }
  await sql.end();
}

run().catch(console.error);
