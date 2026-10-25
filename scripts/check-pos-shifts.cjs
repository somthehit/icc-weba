const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const shifts = await sql`
    SELECT id, shift_number, register_code, cashier_id, cashier_code, cashier_name, total_sales, expected_cash, closing_cash, cash_discrepancy, status, opened_at, closed_at 
    FROM pos_shifts 
    ORDER BY opened_at DESC 
    LIMIT 20
  `;
  console.log('--- POS SHIFTS (' + shifts.length + ') ---');
  console.log(shifts);

  const staff = await sql`
    SELECT id, staff_code, name, role, active, phone, email, status, pin_hash IS NOT NULL as has_pin, must_change_pin, failed_pin_attempts, pin_locked_until 
    FROM staff
  `;
  console.log('--- STAFF (' + staff.length + ') ---');
  console.log(staff);

  await sql.end();
}
check().catch(console.error);
