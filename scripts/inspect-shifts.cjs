const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function run() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  try {
    const shifts = await sql`
      SELECT id, shift_number, cashier_name, register_code, status, opening_float, closing_cash, cash_discrepancy, opened_at, closed_at 
      FROM pos_shifts 
      ORDER BY opened_at DESC 
      LIMIT 10
    `;
    console.log('Shifts:', JSON.stringify(shifts, null, 2));

    const counts = await sql`
      SELECT COUNT(*) as total_shifts, 
             COUNT(*) FILTER (WHERE shift_number LIKE '%TEST%') as test_shifts
      FROM pos_shifts
    `;
    console.log('Shift counts:', JSON.stringify(counts, null, 2));
  } catch (err) {
    console.error('Error querying shifts:', err);
  } finally {
    await sql.end();
  }
}

run();
