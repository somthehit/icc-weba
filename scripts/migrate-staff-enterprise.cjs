const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function run() {
  console.log('--- Migrating Staff & POS Access Control Enterprise Schema ---');

  // 1. Extend pos_staff_role enum if needed
  const newRoles = [
    'senior_cashier',
    'store_manager',
    'inventory_manager',
    'sales_manager',
    'accountant',
    'auditor'
  ];

  for (const r of newRoles) {
    try {
      await sql.unsafe(`ALTER TYPE pos_staff_role ADD VALUE IF NOT EXISTS '${r}'`);
      console.log(`Added enum value to pos_staff_role: ${r}`);
    } catch (e) {
      console.log(`Enum value note (${r}):`, e.message);
    }
  }

  // 2. Extend staff table
  const staffAlters = [
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) DEFAULT 'MAIN'`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS default_shift VARCHAR(30) DEFAULT 'morning'`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100)`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50)`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_terminal_code VARCHAR(50)`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS totp_secret TEXT`
  ];

  for (const stmt of staffAlters) {
    await sql.unsafe(stmt);
  }
  console.log('Staff table columns extended successfully.');

  // 3. Create pin_history table (Argon2id hashes only, no cleartext)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS pin_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      pin_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pin_history_staff_idx ON pin_history(staff_id);
  `);
  console.log('pin_history table verified.');

  // 4. Create pin_reset_requests table (Maker-Checker audit flow)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS pin_reset_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      requested_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
      approved_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
      temp_pin_hash TEXT,
      reason TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'approved',
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pin_reset_requests_staff_idx ON pin_reset_requests(staff_id);
  `);
  console.log('pin_reset_requests table verified.');

  // 5. Create staff_terminals table
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS staff_terminals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      terminal_id UUID NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
      allowed_days JSONB DEFAULT '["sun","mon","tue","wed","thu","fri","sat"]'::jsonb,
      allowed_start_time VARCHAR(10) DEFAULT '09:00',
      allowed_end_time VARCHAR(10) DEFAULT '20:00',
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(staff_id, terminal_id)
    );
    CREATE INDEX IF NOT EXISTS staff_terminals_staff_idx ON staff_terminals(staff_id);
  `);
  console.log('staff_terminals table verified.');

  // 6. Create staff_limits table (Role defaults and per-staff overrides)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS staff_limits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
      max_line_discount_pct NUMERIC(5, 2) DEFAULT 10.00,
      max_invoice_discount_amount NUMERIC(14, 2) DEFAULT 1000.00,
      max_refund_amount NUMERIC(14, 2) DEFAULT 5000.00,
      max_void_amount NUMERIC(14, 2) DEFAULT 5000.00,
      can_override_price BOOLEAN DEFAULT FALSE,
      can_no_sale_open BOOLEAN DEFAULT FALSE,
      max_cash_payout NUMERIC(14, 2) DEFAULT 2000.00,
      can_credit_sale BOOLEAN DEFAULT FALSE,
      return_window_days INTEGER DEFAULT 7,
      updated_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('staff_limits table verified.');

  // 7. Create limit_overrides table (Time-bound supervisor elevations)
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS limit_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      granted_by_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      permission_key VARCHAR(50) NOT NULL,
      override_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS limit_overrides_staff_idx ON limit_overrides(staff_id, status);
  `);
  console.log('limit_overrides table verified.');

  // 8. Create staff_sessions table
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL,
      terminal_code VARCHAR(50),
      session_token_hash TEXT NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      is_revoked BOOLEAN DEFAULT FALSE,
      revoked_reason TEXT,
      last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS staff_sessions_staff_idx ON staff_sessions(staff_id, is_revoked);
  `);
  console.log('staff_sessions table verified.');

  // 9. Create anomaly_rules and anomaly_alerts
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS anomaly_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_code VARCHAR(50) UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      threshold_value NUMERIC(14, 2) NOT NULL,
      severity VARCHAR(20) DEFAULT 'medium',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS anomaly_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_code VARCHAR(50) NOT NULL,
      staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
      shift_id INTEGER,
      severity VARCHAR(20) DEFAULT 'medium',
      title TEXT NOT NULL,
      description TEXT,
      details JSONB,
      status VARCHAR(20) DEFAULT 'new',
      assigned_to_id UUID REFERENCES staff(id) ON DELETE SET NULL,
      resolution_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      resolved_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS anomaly_alerts_staff_idx ON anomaly_alerts(staff_id, status);
  `);
  console.log('anomaly_rules & anomaly_alerts tables verified.');

  // 10. Create staff_targets
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS staff_targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      period_type VARCHAR(20) DEFAULT 'monthly',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      sales_target NUMERIC(14, 2) DEFAULT 500000.00,
      accuracy_target NUMERIC(5, 2) DEFAULT 99.50,
      achieved_sales NUMERIC(14, 2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('staff_targets table verified.');

  // 11. Create staff_audit_log
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS staff_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID,
      actor_name TEXT,
      actor_role TEXT,
      action VARCHAR(100) NOT NULL,
      target_id VARCHAR(100),
      target_type VARCHAR(50),
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS staff_audit_log_target_idx ON staff_audit_log(target_id, action);
  `);
  console.log('staff_audit_log table verified.');

  await sql.end();
  console.log('All migrations completed successfully!');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
