const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const pShifts = await sql`SELECT count(*) FROM pos_shifts`;
  console.log('pos_shifts count:', pShifts[0].count);

  const eShifts = await sql`SELECT count(*) FROM shifts`;
  console.log('shifts count:', eShifts[0].count);

  const pShiftSample = await sql`SELECT id, cashier_id, shift_status, expected_cash, cash_discrepancy, opened_at FROM pos_shifts LIMIT 5`;
  console.log('Sample pos_shifts:', pShiftSample);

  await sql.end();
}
check().catch(console.error);
