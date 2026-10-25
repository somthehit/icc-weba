const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function migrate() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('Adding missing columns to products...');
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_physical_product boolean NOT NULL DEFAULT true;`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_shipping boolean NOT NULL DEFAULT true;`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg numeric(8,3);`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm numeric(8,2);`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm numeric(8,2);`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm numeric(8,2);`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_free_shipping boolean NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS fixed_shipping_fee numeric(10,2);`;
  console.log('Columns added successfully!');
  await sql.end();
}

migrate().catch(console.error);
