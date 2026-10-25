const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'staff'
    ORDER BY ordinal_position
  `;
  console.log('Columns in staff table:', cols.map(c => `${c.column_name} (${c.data_type})`));
  await sql.end();
}
check().catch(console.error);
