const { Client } = require('pg');
require('dotenv').config();

async function fix() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Dropping obsolete FK constraints to users on POS shift and staff tables...');
  
  await client.query(`
    ALTER TABLE pos_shifts DROP CONSTRAINT IF EXISTS pos_shifts_cashier_id_users_id_fk;
    ALTER TABLE pos_shifts DROP CONSTRAINT IF EXISTS pos_shifts_opened_by_supervisor_id_users_id_fk;
    ALTER TABLE pos_shifts DROP CONSTRAINT IF EXISTS pos_shifts_closed_by_supervisor_id_users_id_fk;
    
    ALTER TABLE pos_shift_tender_reconciliations DROP CONSTRAINT IF EXISTS pos_shift_tender_reconciliations_verified_by_id_users_id_fk;
    ALTER TABLE pos_shift_denominations DROP CONSTRAINT IF EXISTS pos_shift_denominations_counted_by_id_users_id_fk;
    ALTER TABLE pos_shift_denominations DROP CONSTRAINT IF EXISTS pos_shift_denominations_verified_by_id_users_id_fk;
    ALTER TABLE pos_shift_approvals DROP CONSTRAINT IF EXISTS pos_shift_approvals_approver_id_users_id_fk;
    ALTER TABLE business_days DROP CONSTRAINT IF EXISTS business_days_closed_by_supervisor_id_fkey;
  `);

  console.log('Testing insert into pos_shifts with Aayush Adhikari (staff ID)...');

  const insertRes = await client.query(`
    insert into "pos_shifts" (
      "shift_number", "register_code", "cashier_id", "cashier_name",
      "opening_float", "opening_denominations", "expected_cash",
      "opened_by_supervisor_name", "status", "note"
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning id, shift_number, cashier_id, cashier_name, status
  `, [
    'SHIFT-TEST-01', 'REG-01', 'c651f3e1-2709-437e-b8ec-a531a1a9d433', 'Aayush Adhikari',
    '5000.00', '{"1":30}', '5000.00',
    'Jay Dahit', 'OPEN', 'test insert'
  ]);

  console.log('Insert SUCCESS:', insertRes.rows);

  // Clean up test shift
  await client.query('DELETE FROM pos_shifts WHERE shift_number = $1', ['SHIFT-TEST-01']);
  console.log('Cleaned up test shift.');

  await client.end();
}

fix().catch(console.error);
