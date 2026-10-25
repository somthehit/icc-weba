const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const match = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = match ? match[1] : process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'terminals'
  `;
  console.log('Terminals columns:', cols);

  const shiftCols = await sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'pos_shifts'
  `;
  console.log('pos_shifts columns:', shiftCols);

  const termRows = await sql`SELECT * FROM terminals`;
  console.log('Existing terminals:', termRows);

  await sql.end();
}
main().catch(console.error);
