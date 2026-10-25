const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const bcrypt = require('bcryptjs');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function run() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('--- Migrating users and pos_shifts for POS Auth & EOD ---');

  // 1. Add pos_pin to users
  await sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS pos_pin VARCHAR(255);
  `;
  console.log('✓ Added pos_pin column to users (if not exists)');

  // 2. Add POS shift denomination and supervisor columns
  await sql`
    ALTER TABLE pos_shifts
    ADD COLUMN IF NOT EXISTS opening_denominations JSONB,
    ADD COLUMN IF NOT EXISTS closing_denominations JSONB,
    ADD COLUMN IF NOT EXISTS opened_by_supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS opened_by_supervisor_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS closed_by_supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS closed_by_supervisor_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS total_cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_card_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_qr_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS eod_report JSONB;
  `;
  console.log('✓ Added denomination & supervisor audit columns to pos_shifts');

  // 3. Set default PINs for seeded staff accounts (admin: 9999, sales: 1234, inventory: 5678, service: 4321)
  // Store both hash and allow quick verification
  const pin9999 = await bcrypt.hash('9999', 10);
  const pin1234 = await bcrypt.hash('1234', 10);
  const pin5678 = await bcrypt.hash('5678', 10);
  const pin4321 = await bcrypt.hash('4321', 10);

  await sql`UPDATE users SET pos_pin = ${pin9999} WHERE email = 'admin@icecomputers.com.np' AND pos_pin IS NULL;`;
  await sql`UPDATE users SET pos_pin = ${pin1234} WHERE email = 'sales@icecomputers.com.np' AND pos_pin IS NULL;`;
  await sql`UPDATE users SET pos_pin = ${pin5678} WHERE email = 'inventory@icecomputers.com.np' AND pos_pin IS NULL;`;
  await sql`UPDATE users SET pos_pin = ${pin4321} WHERE email = 'service@icecomputers.com.np' AND pos_pin IS NULL;`;

  console.log('✓ Configured default POS PINs for admin & managers:');
  console.log('  - admin@icecomputers.com.np: PIN 9999 (also accepts 1234 or account password)');
  console.log('  - sales@icecomputers.com.np: PIN 1234');
  console.log('  - inventory@icecomputers.com.np: PIN 5678');
  console.log('  - service@icecomputers.com.np: PIN 4321');

  // Verify
  const staff = await sql`SELECT id, name, email, role, (pos_pin IS NOT NULL) as has_pin FROM users WHERE role IN ('admin', 'sales', 'inventory_manager', 'service_technician');`;
  console.log('Staff records:', staff);

  await sql.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
