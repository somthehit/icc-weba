const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function check() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products'
    ORDER BY ordinal_position;
  `;
  console.log('Columns in products table:');
  console.log(cols.map(c => c.column_name).join(', '));
  await sql.end();
}

check().catch(console.error);
