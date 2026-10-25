const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function migrate() {
  console.log('Connecting to database...');
  const sql = postgres(dbUrl, { ssl: 'require', max: 5 });

  console.log('1. Ensuring pg_trgm extension...');
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
    console.log('   pg_trgm extension enabled.');
  } catch (err) {
    console.warn('   pg_trgm extension warning:', err.message);
  }

  console.log('2. Creating BTree & Trigram indexes on products...');
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode) WHERE barcode IS NOT NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_cat_status ON products (category_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_status_stock ON products (status, stock_status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);`;
    console.log('   Products indexes created successfully.');
  } catch (err) {
    console.error('   Products indexes error:', err.message);
  }

  console.log('3. Checking existing indexes on products...');
  const indexes = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'products';
  `;
  for (const idx of indexes) {
    console.log(`   - ${idx.indexname}: ${idx.indexdef}`);
  }

  await sql.end();
  console.log('Done!');
}

migrate().catch(console.error);
