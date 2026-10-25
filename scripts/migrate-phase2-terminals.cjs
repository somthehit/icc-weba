const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function run() {
  console.log('--- Migrating Phase 2: Terminals, Sessions, and Device Binding ---');

  // 1. Add extra columns to terminals
  const alters = [
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'`,
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50)`,
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS mac_address VARCHAR(50)`,
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS device_fingerprint TEXT`,
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES staff(id) ON DELETE SET NULL`,
    `ALTER TABLE terminals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE`
  ];

  for (const a of alters) {
    await sql.unsafe(a);
  }
  console.log('Terminals table columns extended.');

  // 2. Update existing terminals with realistic network telemetry
  await sql`
    UPDATE terminals SET
      status = 'approved',
      last_seen_at = NOW() - interval '2 minutes',
      ip_address = '192.168.1.101',
      mac_address = 'D4:5D:64:82:11:01',
      is_locked = false,
      active = true
    WHERE code = 'REG-01';
  `;

  await sql`
    UPDATE terminals SET
      status = 'approved',
      last_seen_at = NOW() - interval '5 minutes',
      ip_address = '192.168.1.102',
      mac_address = 'D4:5D:64:82:11:02',
      is_locked = false,
      active = true
    WHERE code = 'REG-02';
  `;

  await sql`
    UPDATE terminals SET
      status = 'approved',
      last_seen_at = NOW() - interval '18 minutes',
      ip_address = '192.168.1.103',
      mac_address = 'D4:5D:64:82:11:03',
      is_locked = false,
      active = true
    WHERE code = 'REG-03';
  `;

  // 3. Insert a pending device to demonstrate the device approval gate
  const pendingCheck = await sql`SELECT id FROM terminals WHERE code = 'REG-04-TAB'`;
  if (pendingCheck.length === 0) {
    await sql`
      INSERT INTO terminals (
        code, name, branch_id, status, is_locked, active, last_seen_at, ip_address, mac_address
      )
      VALUES (
        'REG-04-TAB', 'Mobile POS Tablet (Samsung Galaxy Tab A9)', 'Main - Dhangadhi',
        'pending_approval', true, true, NOW() - interval '12 minutes', '192.168.1.144', 'E8:4F:25:99:34:7B'
      );
    `;
    console.log('Inserted sample pending device REG-04-TAB for approval testing.');
  }

  // 4. Seed active staff sessions
  const aayush = await sql`SELECT id FROM staff WHERE staff_code = 'CSH01'`;
  const pooja = await sql`SELECT id FROM staff WHERE staff_code = 'CSH02'`;
  const reg1 = await sql`SELECT id FROM terminals WHERE code = 'REG-01'`;
  const reg2 = await sql`SELECT id FROM terminals WHERE code = 'REG-02'`;

  if (aayush.length > 0 && reg1.length > 0) {
    const dummyTokenHash1 = crypto.createHash('sha256').update('sess_aayush_reg01_active').digest('hex');
    await sql`DELETE FROM staff_sessions WHERE staff_id = ${aayush[0].id}`;
    await sql`
      INSERT INTO staff_sessions (
        staff_id, terminal_id, terminal_code, session_token_hash, ip_address, user_agent, is_revoked, last_active_at, created_at
      )
      VALUES (
        ${aayush[0].id}, ${reg1[0].id}, 'REG-01', ${dummyTokenHash1}, '192.168.1.101', 'Electron POS Client / Windows 11', false, NOW() - interval '3 minutes', NOW() - interval '4 hours'
      );
    `;
  }

  if (pooja.length > 0 && reg2.length > 0) {
    const dummyTokenHash2 = crypto.createHash('sha256').update('sess_pooja_reg02_active').digest('hex');
    await sql`DELETE FROM staff_sessions WHERE staff_id = ${pooja[0].id}`;
    await sql`
      INSERT INTO staff_sessions (
        staff_id, terminal_id, terminal_code, session_token_hash, ip_address, user_agent, is_revoked, last_active_at, created_at
      )
      VALUES (
        ${pooja[0].id}, ${reg2[0].id}, 'REG-02', ${dummyTokenHash2}, '192.168.1.102', 'Electron POS Client / Windows 11', false, NOW() - interval '7 minutes', NOW() - interval '2 hours'
      );
    `;
  }
  console.log('Seeded live active sessions for CSH01 & CSH02.');

  // 5. Seed sample audit logs
  const adminStaff = await sql`SELECT id FROM staff WHERE staff_code = 'ADM01'`;
  const adminId = adminStaff.length > 0 ? adminStaff[0].id : null;

  await sql`
    INSERT INTO staff_audit_log (
      actor_id, actor_name, actor_role, action, target_id, target_type, details, ip_address, created_at
    )
    VALUES 
    (
      ${adminId}, 'Bimal Sharma', 'admin', 'DEVICE_REGISTERED', 'REG-01', 'terminal',
      '{"code":"REG-01","name":"Counter 1 - Main Checkout","ip":"192.168.1.101"}'::jsonb, '192.168.1.50', NOW() - interval '3 days'
    );
  `;
  await sql`
    INSERT INTO staff_audit_log (
      actor_id, actor_name, actor_role, action, target_id, target_type, details, ip_address, created_at
    )
    VALUES 
    (
      ${adminId}, 'Bimal Sharma', 'admin', 'STAFF_ROLE_ASSIGNED', 'CSH01', 'staff',
      '{"staffCode":"CSH01","name":"Aayush Adhikari","role":"senior_cashier"}'::jsonb, '192.168.1.50', NOW() - interval '2 days'
    );
  `;
  await sql`
    INSERT INTO staff_audit_log (
      actor_id, actor_name, actor_role, action, target_id, target_type, details, ip_address, created_at
    )
    VALUES 
    (
      ${adminId}, 'Bimal Sharma', 'admin', 'STORE_HOURS_UPDATED', 'POLICY', 'access_control',
      '{"storeHours":"09:00 - 20:30","strictLock":true}'::jsonb, '192.168.1.50', NOW() - interval '1 day'
    );
  `;
  console.log('Seeded initial audit logs.');

  await sql.end();
  console.log('Phase 2 migration completed successfully!');
}

run().catch(err => {
  console.error('Phase 2 migration error:', err);
  process.exit(1);
});
