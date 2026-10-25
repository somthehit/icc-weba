const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = match ? match[1] : process.env.DATABASE_URL;

async function run() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('--- Migrating Database for Dedicated Counter POS System ---');

  // 1. terminals: is_locked, token_hash
  await sql`
    ALTER TABLE terminals
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS token_hash TEXT;
  `;
  console.log('✓ Updated terminals table with is_locked and token_hash');

  // 2. pos_shifts: add reason_paused, handover_slip
  await sql`
    ALTER TABLE pos_shifts
    ADD COLUMN IF NOT EXISTS reason_paused TEXT,
    ADD COLUMN IF NOT EXISTS handover_slip JSONB;
  `;
  console.log('✓ Updated pos_shifts table with reason_paused and handover_slip');

  // 3. pos_transactions: transactions synced directly for central accounts
  await sql`
    CREATE TABLE IF NOT EXISTS pos_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE CASCADE,
      cashier_id INTEGER,
      cashier_name VARCHAR(150),
      terminal_code VARCHAR(30) NOT NULL DEFAULT 'REG-01',
      invoice_number VARCHAR(60) NOT NULL UNIQUE,
      total_amount NUMERIC(14, 2) NOT NULL,
      payment_method VARCHAR(30) NOT NULL,
      payment_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      customer_name VARCHAR(150),
      customer_phone VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS pos_tx_shift_idx ON pos_transactions(shift_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS pos_tx_invoice_idx ON pos_transactions(invoice_number);
  `;
  console.log('✓ Created pos_transactions table & indices');

  await sql.end();
  console.log('Migration completed successfully.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
