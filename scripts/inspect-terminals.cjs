const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'terminals'
  `;
  console.log('--- TERMINALS COLUMNS ---');
  console.log(cols.map(c => c.column_name + ' (' + c.data_type + ')').join(', '));

  const list = await sql`SELECT * FROM terminals`;
  console.log('--- TERMINALS ROWS ---');
  console.log(list);

  await sql.end();
}
check().catch(console.error);
