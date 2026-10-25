import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const sql = postgres(dbUrl, { ssl: 'require' });

async function run() {
  console.log('--- Migrating Purchase Order Enterprise Schema ---');

  const statements = [
    // 1. Alter purchase_orders table
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS fiscal_year VARCHAR(20) DEFAULT '2082/83'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS deliver_to_location VARCHAR(150) DEFAULT 'Main Store - Dhangadhi'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS billing_reference VARCHAR(100)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NPR'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10, 4) DEFAULT 1.0000`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_quote_no VARCHAR(80)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS internal_notes TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS other_charges NUMERIC(14, 2) DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(150)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_method VARCHAR(30)`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(30) DEFAULT 'pending'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64)`,

    // 2. Alter purchase_order_items table
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS supplier_part_no VARCHAR(80)`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(20) DEFAULT 'Pcs'`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) DEFAULT 0`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_category VARCHAR(20) DEFAULT 'vat_13'`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 13.00`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(14, 2) DEFAULT 0`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS requires_serial BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS last_purchase_cost NUMERIC(14, 2)`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS average_cost NUMERIC(14, 2)`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS current_stock INTEGER`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS estimated_landed_cost NUMERIC(14, 2)`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expected_selling_price NUMERIC(14, 2)`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expected_margin_percent NUMERIC(5, 2)`,

    // 3. Create purchase_order_revisions table
    `CREATE TABLE IF NOT EXISTS purchase_order_revisions (
      id SERIAL PRIMARY KEY,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      snapshot_json JSONB NOT NULL,
      change_reason TEXT,
      changed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_by_name VARCHAR(150),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS po_revisions_poid_idx ON purchase_order_revisions(purchase_order_id)`,

    // 4. Create po_approvals table
    `CREATE TABLE IF NOT EXISTS po_approvals (
      id SERIAL PRIMARY KEY,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approver_name VARCHAR(150) NOT NULL,
      role VARCHAR(50) NOT NULL,
      action VARCHAR(30) NOT NULL,
      amount NUMERIC(14, 2) NOT NULL,
      pin_hash VARCHAR(128),
      device_ip VARCHAR(45),
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS po_approvals_poid_idx ON po_approvals(purchase_order_id)`,

    // 5. Create po_attachments table
    `CREATE TABLE IF NOT EXISTS po_attachments (
      id SERIAL PRIMARY KEY,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_type VARCHAR(50),
      file_size INTEGER,
      uploaded_by_name VARCHAR(150),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS po_attachments_poid_idx ON po_attachments(purchase_order_id)`,

    // 6. Create po_communications table
    `CREATE TABLE IF NOT EXISTS po_communications (
      id SERIAL PRIMARY KEY,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      channel VARCHAR(30) NOT NULL,
      recipient VARCHAR(150) NOT NULL,
      message_body TEXT,
      tracking_token VARCHAR(64) UNIQUE,
      status VARCHAR(30) DEFAULT 'sent',
      sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
      delivered_at TIMESTAMP,
      confirmed_at TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS po_comm_poid_idx ON po_communications(purchase_order_id)`,

    // 7. Create supplier_terms table
    `CREATE TABLE IF NOT EXISTS supplier_terms (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
      lead_time_days INTEGER DEFAULT 7,
      default_payment_terms VARCHAR(80) DEFAULT 'Credit 30 Days',
      minimum_order_value NUMERIC(14, 2) DEFAULT 0,
      is_blacklisted BOOLEAN DEFAULT FALSE,
      blacklist_reason TEXT,
      credit_limit NUMERIC(14, 2) DEFAULT 500000,
      rating NUMERIC(3, 2) DEFAULT 4.5,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`
  ];

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      console.log('Executed:', stmt.slice(0, 60) + '...');
    } catch (err) {
      console.error('Error on statement:', stmt, err.message);
    }
  }

  // Seed default supplier_terms for existing suppliers if none
  const existingTerms = await sql`SELECT count(*) FROM supplier_terms`;
  if (parseInt(existingTerms[0].count) === 0) {
    console.log('Seeding default supplier terms...');
    await sql.unsafe(`
      INSERT INTO supplier_terms (supplier_id, lead_time_days, default_payment_terms, minimum_order_value, credit_limit, rating)
      SELECT id, 5, 'Credit 30 Days', 25000.00, 1000000.00, 4.8 FROM suppliers
      ON CONFLICT (supplier_id) DO NOTHING
    `);
  }

  console.log('✅ PO Enterprise migration completed.');
  await sql.end();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
