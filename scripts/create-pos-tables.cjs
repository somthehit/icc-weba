const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function run() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('Creating pos_shifts and pos_cash_transactions tables if not exists...');
  
  await sql`
    CREATE TABLE IF NOT EXISTS pos_shifts (
      id SERIAL PRIMARY KEY,
      shift_number VARCHAR(30) NOT NULL,
      register_code VARCHAR(30) NOT NULL DEFAULT 'REG-01',
      cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      cashier_name VARCHAR(150) NOT NULL,
      opening_float NUMERIC(12, 2) NOT NULL DEFAULT 0,
      closing_cash NUMERIC(12, 2),
      expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
      cash_discrepancy NUMERIC(12, 2),
      total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_transactions INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMP,
      note TEXT
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS pos_shifts_register_idx ON pos_shifts(register_code);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS pos_shifts_cashier_idx ON pos_shifts(cashier_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS pos_shifts_status_idx ON pos_shifts(status);
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pos_cash_transactions (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      performed_by_name VARCHAR(150) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  console.log('POS tables ready!');
  await sql.end();
}

run().catch(console.error);
