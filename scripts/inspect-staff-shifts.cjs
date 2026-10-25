const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('--- TABLES IN DB ---');
  console.log(tables.map(t => t.table_name).join(', '));

  const staffCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'staff'
  `;
  console.log('--- STAFF COLUMNS ---');
  console.log(staffCols.map(c => c.column_name + ' (' + c.data_type + ')').join(', '));

  const posShiftsCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pos_shifts'
  `;
  console.log('--- POS_SHIFTS COLUMNS ---');
  console.log(posShiftsCols.map(c => c.column_name + ' (' + c.data_type + ')').join(', '));

  const staffRows = await sql`SELECT id, name, staff_code, role, active, failed_pin_attempts, pin_locked_until, must_change_pin, pin_hash IS NOT NULL as has_pin FROM staff`;
  console.log('--- STAFF ROWS ---');
  console.log(staffRows);

  await sql.end();
}
check().catch(console.error);
