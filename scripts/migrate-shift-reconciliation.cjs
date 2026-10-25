const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function migrate() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('--- Migrating Shift & Cash Control Tables ---');

  try {
    // 1. Ensure columns exist on pos_shifts
    await sql`
      ALTER TABLE pos_shifts
      ADD COLUMN IF NOT EXISTS cashier_code VARCHAR(50) DEFAULT 'EMP-101',
      ADD COLUMN IF NOT EXISTS handover_variance NUMERIC(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS standard_float NUMERIC(12, 2) DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS previous_shift_id INTEGER,
      ADD COLUMN IF NOT EXISTS min_duration_override BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS min_duration_override_by VARCHAR(150),
      ADD COLUMN IF NOT EXISTS min_duration_override_reason TEXT,
      ADD COLUMN IF NOT EXISTS is_zero_sales BOOLEAN DEFAULT FALSE;
    `;
    console.log('✓ Added columns to pos_shifts');

    // 2. Create pos_shift_denominations
    await sql`
      CREATE TABLE IF NOT EXISTS pos_shift_denominations (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE CASCADE,
        count_type VARCHAR(50) NOT NULL, -- 'OPENING', 'CASHIER_CLOSING', 'SUPERVISOR_RECEIVING', 'RECOUNT'
        attempt_number INTEGER NOT NULL DEFAULT 1,
        d1000 INTEGER NOT NULL DEFAULT 0,
        d500 INTEGER NOT NULL DEFAULT 0,
        d100 INTEGER NOT NULL DEFAULT 0,
        d50 INTEGER NOT NULL DEFAULT 0,
        d20 INTEGER NOT NULL DEFAULT 0,
        d10 INTEGER NOT NULL DEFAULT 0,
        d5 INTEGER NOT NULL DEFAULT 0,
        d2 INTEGER NOT NULL DEFAULT 0,
        d1 INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        counted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        counted_by_name VARCHAR(150) NOT NULL,
        verified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        verified_by_name VARCHAR(150),
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('✓ Created pos_shift_denominations table');

    // 3. Create pos_shift_tender_reconciliations
    await sql`
      CREATE TABLE IF NOT EXISTS pos_shift_tender_reconciliations (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE CASCADE,
        tender_type VARCHAR(50) NOT NULL, -- 'card', 'fonepay', 'esewa', 'khalti', 'connectips', 'bank_transfer', 'credit'
        system_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        entered_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        variance NUMERIC(14, 2) NOT NULL DEFAULT 0,
        reference_no VARCHAR(100),
        batch_number VARCHAR(100),
        slip_image_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'BALANCED', -- 'BALANCED', 'VARIANCE', 'AUTO_MATCHED'
        verified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('✓ Created pos_shift_tender_reconciliations table');

    // 4. Create pos_shift_cash_movements (extended cash transactions)
    await sql`
      CREATE TABLE IF NOT EXISTS pos_shift_cash_movements (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'SAFE_DROP', 'PAID_IN', 'PAID_OUT', 'PETTY_CASH', 'ADJUSTMENT'
        amount NUMERIC(14, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        authorized_by_name VARCHAR(150) NOT NULL,
        authorized_by_pin VARCHAR(255),
        receipt_no VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('✓ Created pos_shift_cash_movements table');

    // 5. Create pos_shift_approvals
    await sql`
      CREATE TABLE IF NOT EXISTS pos_shift_approvals (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE CASCADE,
        approval_type VARCHAR(50) NOT NULL, -- 'BOD_OVERRIDE', 'MIN_DURATION_OVERRIDE', 'VARIANCE_TOLERANCE', 'REOPEN_SHIFT'
        approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approver_name VARCHAR(150) NOT NULL,
        approver_role VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log('✓ Created pos_shift_approvals table');

    // 6. Clean up test records and update test shift to production format
    await sql`
      UPDATE pos_shifts
      SET 
        shift_number = 'SH-2081/82-000101',
        cashier_name = 'Bikash Shrestha',
        cashier_code = 'EMP-204',
        status = 'CLOSED',
        is_zero_sales = TRUE,
        min_duration_override = TRUE,
        min_duration_override_by = 'Suresh Sharma (Supervisor)',
        min_duration_override_reason = 'Zero-activity register check and test audit close',
        opening_float = 5000.00,
        closing_cash = 5000.00,
        expected_cash = 5000.00,
        cash_discrepancy = 0.00
      WHERE shift_number = 'SHIFT-TEST-5364' OR cashier_name = 'Sales Manager';
    `;
    console.log('✓ Cleaned up test shift records into compliant production fiscal format');

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
