/**
 * reset-staff-pins.mjs
 * 
 * Sets known PINs and passwords for all staff so the POS terminal can be tested.
 * 
 * After running this script:
 *   SUP01 (Manager)  → PIN: 1234,  Password: manager123
 *   ADM01 (Admin)    → PIN: 9999,  Password: admin123
 *   CSH01 (Cashier)  → PIN: 1111,  Password: cashier123
 *   CSH02 (Cashier)  → PIN: 2222,  Password: cashier123
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

// Extract pepper from .env
const pepperMatch = envContent.match(/POS_AUTH_PEPPER="([^"]+)"/);
const PEPPER = pepperMatch ? pepperMatch[1] : 'pos_secure_default_pepper_change_in_prod';

function applyPepper(value) {
  return crypto.createHmac('sha256', PEPPER).update(value).digest('hex');
}

async function hashCredential(value) {
  const peppered = applyPepper(value);
  return hash(peppered, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

const staffSeeds = [
  { staffCode: 'ADM01', pin: '9999', password: 'admin123' },
  { staffCode: 'SUP01', pin: '1234', password: 'manager123' },
  { staffCode: 'CSH01', pin: '1111', password: 'cashier123' },
  { staffCode: 'CSH02', pin: '2222', password: 'cashier123' },
];

async function run() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('--- Resetting Staff PINs and Passwords for POS Testing ---\n');

  for (const seed of staffSeeds) {
    const pinHash = await hashCredential(seed.pin);
    const pwHash = await hashCredential(seed.password);

    const result = await sql`
      UPDATE staff
      SET
        pin_hash = ${pinHash},
        password_hash = ${pwHash},
        must_change_pin = false,
        must_change_password = false,
        failed_pin_attempts = 0,
        pin_locked_until = null,
        failed_attempts = 0,
        locked_until = null,
        active = true
      WHERE staff_code = ${seed.staffCode}
      RETURNING id, name, staff_code, role;
    `;

    if (result.length > 0) {
      const s = result[0];
      console.log(`✓ ${s.staff_code} (${s.name}) [${s.role}]`);
      console.log(`  PIN: ${seed.pin}  |  Password: ${seed.password}`);
    } else {
      console.log(`✗ Staff code ${seed.staffCode} not found in DB`);
    }
  }

  console.log('\n✅ Done! Use these credentials to test the POS terminal:\n');
  console.log('  SUPERVISOR unlock:  Staff Code = ADM01, PIN = 9999');
  console.log('               OR:    Staff Code = SUP01, PIN = 1234');
  console.log('  CASHIER login:      Staff Code = CSH01, PIN = 1111');
  console.log('               OR:    Staff Code = CSH02, PIN = 2222');
  console.log('');

  await sql.end();
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
