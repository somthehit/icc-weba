const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  console.log('Public tables:', tables.map(t => t.table_name));
  await sql.end();
}
check().catch(console.error);
