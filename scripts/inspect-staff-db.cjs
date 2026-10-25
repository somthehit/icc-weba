const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const staffRows = await sql`SELECT id, name, staff_code, role, active, pin_hash IS NOT NULL as has_pin FROM staff`;
  console.log('Staff in pos-enterprise table:', staffRows);

  const usersRows = await sql`SELECT id, name, email, role, is_active FROM users LIMIT 10`;
  console.log('Users in users table:', usersRows);

  const terminalRows = await sql`SELECT * FROM terminals`;
  console.log('Terminals in terminals table:', terminalRows);

  await sql.end();
}
check().catch(console.error);
