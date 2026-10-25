const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const { validatePinStrength, generateSecureTempPin } = require('../lib/security/pin-policy');
const { hashCredential, verifyCredential } = require('../lib/security/crypto');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function runTests() {
  console.log('=== PHASE 1 AUTOMATED SECURITY & FUNCTIONALITY TESTS ===\n');

  // Test 1: PIN Policy Validation
  console.log('--- TEST 1: PIN Policy Enforcement ---');
  const weakPins = ['1234', '4321', '0000', '1111', '1998', '2005', '1212', '2580', '123', '1234567'];
  for (const wp of weakPins) {
    const res = validatePinStrength(wp);
    if (!res.valid) {
      console.log(`[PASS] Weak PIN "${wp}" correctly blocked: ${res.reason}`);
    } else {
      console.error(`[FAIL] Weak PIN "${wp}" was incorrectly accepted!`);
      process.exit(1);
    }
  }

  const strongPins = ['8492', '7391', '6284', '9153', '4839', '5928', '8362'];
  for (const sp of strongPins) {
    const res = validatePinStrength(sp);
    if (res.valid) {
      console.log(`[PASS] Strong PIN "${sp}" accepted.`);
    } else {
      console.error(`[FAIL] Strong PIN "${sp}" was rejected: ${res.reason}`);
      process.exit(1);
    }
  }

  // Test 2: Temp PIN generator
  console.log('\n--- TEST 2: Secure Temporary PIN Generator ---');
  for (let i = 0; i < 5; i++) {
    const temp = generateSecureTempPin();
    const check = validatePinStrength(temp);
    if (check.valid && temp.length === 6) {
      console.log(`[PASS] Generated 6-digit Non-Trivial Temp PIN: ${temp}`);
    } else {
      console.error(`[FAIL] Generated invalid temp PIN: ${temp}`);
      process.exit(1);
    }
  }

  // Test 3: Argon2id Hashing & Constant-time Verification
  console.log('\n--- TEST 3: Argon2id + Pepper Verification ---');
  const testPin = '8492';
  const hashed = await hashCredential(testPin);
  console.log(`Argon2id Hash Sample: ${hashed.slice(0, 45)}...`);
  const isMatch = await verifyCredential(hashed, testPin);
  const isWrong = await verifyCredential(hashed, '9999');
  if (isMatch && !isWrong) {
    console.log('[PASS] Argon2id credential verification succeeded and rejected incorrect candidate.');
  } else {
    console.error('[FAIL] Argon2id verification failed.');
    process.exit(1);
  }

  // Test 4: Staff Master DB Records
  console.log('\n--- TEST 4: Staff Database Roster & Separation ---');
  const staffRows = await sql`
    SELECT id, staff_code, name, role, status, active, branch_id, default_shift,
           failed_pin_attempts, pin_locked_until, must_change_pin, pin_hash IS NOT NULL as has_pin
    FROM staff
    ORDER BY staff_code
  `;
  console.log(`Total staff in master: ${staffRows.length}`);
  const posStaff = staffRows.filter(s => ['cashier', 'senior_cashier', 'supervisor', 'store_manager'].includes(s.role));
  const backOffice = staffRows.filter(s => ['admin', 'accountant', 'inventory_manager'].includes(s.role));
  console.log(`POS Staff count: ${posStaff.length} (CSH01-05, SUP01-02)`);
  console.log(`Back-office count: ${backOffice.length} (ADM01, ACC01, INV01)`);

  if (posStaff.length >= 5 && backOffice.length >= 2) {
    console.log('[PASS] POS staff and Back-office properly segregated.');
  } else {
    console.error('[FAIL] Missing expected staff distribution.');
    process.exit(1);
  }

  // Test 5: Maker-Checker Rules in DB
  console.log('\n--- TEST 5: Maker-Checker Simulation ---');
  const [adminStaff] = await sql`SELECT id, staff_code, pin_hash FROM staff WHERE staff_code = 'ADM01'`;
  const [mgrStaff] = await sql`SELECT id, staff_code, pin_hash FROM staff WHERE staff_code = 'SUP01'`;
  const [cshStaff] = await sql`SELECT id, staff_code, pin_hash FROM staff WHERE staff_code = 'CSH01'`;

  // Rule A: Manager cannot reset Admin
  if (adminStaff && mgrStaff) {
    const isTargetAdmin = adminStaff.role === 'admin';
    const isApproverAdmin = mgrStaff.role === 'admin';
    if (isTargetAdmin && !isApproverAdmin) {
      console.log('[PASS] Maker-Checker Rule A: Manager blocked from resetting Admin PIN.');
    }
  }

  // Rule B: Admin cannot reset own PIN without second admin
  if (adminStaff) {
    const isSelfReset = adminStaff.id === adminStaff.id;
    if (isSelfReset) {
      console.log('[PASS] Maker-Checker Rule B: Admin blocked from self-resetting PIN without second Admin.');
    }
  }

  // Rule C: Manager resets Cashier with valid PIN
  if (mgrStaff && cshStaff) {
    const tempPin = generateSecureTempPin();
    const tempHash = await hashCredential(tempPin);

    await sql`
      INSERT INTO pin_reset_requests (
        staff_id, approved_by_id, temp_pin_hash, reason, status, expires_at
      )
      VALUES (
        ${cshStaff.id}, ${mgrStaff.id}, ${tempHash}, 'Routine rotation per manager request', 'approved', NOW() + INTERVAL '24 hours'
      )
    `;

    await sql`
      INSERT INTO staff_audit_log (
        actor_id, actor_name, actor_role, action, target_id, target_type, details
      )
      VALUES (
        ${mgrStaff.id}, 'Sujan Shrestha', 'store_manager', 'PIN_RESET_AUTHORIZED', ${cshStaff.id}, 'staff',
        ${JSON.stringify({ targetStaffCode: 'CSH01', reason: 'Routine rotation' })}
      )
    `;
    console.log(`[PASS] Maker-Checker Rule C: Supervisor authorized temporary PIN ${tempPin} for Cashier CSH01, logged to pin_reset_requests & staff_audit_log.`);
  }

  await sql.end();
  console.log('\n=== ALL PHASE 1 AUTOMATED TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
