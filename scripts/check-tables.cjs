const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const match = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = match ? match[1] : process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('Tables:', tables.map(t => t.table_name).sort());
  await sql.end();
}
main().catch(console.error);
