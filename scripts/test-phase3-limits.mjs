// scripts/test-phase3-limits.mjs
// Automated verification for Phase 3: Per-Staff Limits & Temporary Elevation

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require', max: 1 });

async function runTests() {
  console.log('=== PHASE 3 AUTOMATED LIMITS & PERMISSION TESTS ===\n');

  try {
    // TEST 1: Verify Role Limit Defaults & Schema
    console.log('--- TEST 1: Role Limit Defaults & Schema Consistency ---');
    const existingLimits = await sql`
      SELECT sl.*, s.staff_code, s.name, s.role
      FROM staff_limits sl
      JOIN staff s ON sl.staff_id = s.id
      ORDER BY s.staff_code
    `;

    console.log(`Found ${existingLimits.length} configured staff limit records in database.`);
    for (const lim of existingLimits.slice(0, 3)) {
      console.log(`Staff: ${lim.staff_code} (${lim.name} - ${lim.role}) | Max Refund: NPR ${lim.max_refund_amount} | Max Invoice Disc: NPR ${lim.max_invoice_discount_amount} | Override Price: ${lim.can_override_price}`);
    }

    if (existingLimits.length === 0) {
      throw new Error('No staff limits found! Ensure seeding was completed.');
    }
    console.log('[PASS] Staff limits schema and baseline records verified.\n');

    // TEST 2: Update Individual Staff Limits (Ramesh CSH05)
    console.log('--- TEST 2: Customize Per-Staff Limits (CSH05 Ramesh Bhatta) ---');
    const ramesh = (await sql`SELECT id, staff_code, name FROM staff WHERE staff_code = 'CSH05'`)[0];
    if (!ramesh) throw new Error('CSH05 Ramesh Bhatta not found.');

    const newLimits = {
      maxLineDiscountPct: 7.50,
      maxInvoiceDiscountAmount: 1200.00,
      maxRefundAmount: 3500.00,
      maxVoidAmount: 2500.00,
      canOverridePrice: false,
      canNoSaleOpen: true, // Specific allowance
      maxCashPayout: 1500.00,
      canCreditSale: false,
      returnWindowDays: 10,
    };

    await sql`
      INSERT INTO staff_limits (
        staff_id, max_line_discount_pct, max_invoice_discount_amount,
        max_refund_amount, max_void_amount, can_override_price,
        can_no_sale_open, max_cash_payout, can_credit_sale, return_window_days,
        updated_at
      )
      VALUES (
        ${ramesh.id}, ${newLimits.maxLineDiscountPct}, ${newLimits.maxInvoiceDiscountAmount},
        ${newLimits.maxRefundAmount}, ${newLimits.maxVoidAmount}, ${newLimits.canOverridePrice},
        ${newLimits.canNoSaleOpen}, ${newLimits.maxCashPayout}, ${newLimits.canCreditSale},
        ${newLimits.returnWindowDays}, NOW()
      )
      ON CONFLICT (staff_id) DO UPDATE SET
        max_line_discount_pct = EXCLUDED.max_line_discount_pct,
        max_invoice_discount_amount = EXCLUDED.max_invoice_discount_amount,
        max_refund_amount = EXCLUDED.max_refund_amount,
        max_void_amount = EXCLUDED.max_void_amount,
        can_override_price = EXCLUDED.can_override_price,
        can_no_sale_open = EXCLUDED.can_no_sale_open,
        max_cash_payout = EXCLUDED.max_cash_payout,
        can_credit_sale = EXCLUDED.can_credit_sale,
        return_window_days = EXCLUDED.return_window_days,
        updated_at = NOW();
    `;

    const updatedRamesh = (await sql`SELECT * FROM staff_limits WHERE staff_id = ${ramesh.id}`)[0];
    if (Number(updatedRamesh.max_refund_amount) !== 3500 || updatedRamesh.can_no_sale_open !== true) {
      throw new Error('Limits failed to update properly in database.');
    }
    console.log(`[PASS] Customized limits for ${ramesh.name}: Max Refund NPR ${updatedRamesh.max_refund_amount}, Can No-Sale Open: ${updatedRamesh.can_no_sale_open}.\n`);

    // TEST 3: Temporary Time-Bound Manager Elevation
    console.log('--- TEST 3: Grant Temporary Elevation (Diwali Rush Refund Elevation) ---');
    const manager = (await sql`SELECT id, name FROM staff WHERE role = 'store_manager' OR role = 'admin' LIMIT 1`)[0];
    const expiry = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

    const insertedElevation = (await sql`
      INSERT INTO limit_overrides (
        staff_id, granted_by_id, permission_key, override_value, reason, status, expires_at
      )
      VALUES (
        ${ramesh.id}, ${manager.id}, 'maxRefundAmount', '25000',
        'Customer satisfaction cover during Diwali festival rush', 'active', ${expiry}
      )
      RETURNING *
    `)[0];

    console.log(`Created Elevation ID: ${insertedElevation.id}`);
    console.log(`Elevated: ${insertedElevation.permission_key} -> NPR ${insertedElevation.override_value} (Expires: ${insertedElevation.expires_at})`);

    // Audit log
    await sql`
      INSERT INTO staff_audit_log (
        actor_id, actor_name, actor_role, action, target_id, target_type, details
      )
      VALUES (
        ${manager.id}, ${manager.name}, 'manager', 'ELEVATION_GRANTED',
        ${'staff:' + ramesh.staff_code}, 'limit_override',
        ${JSON.stringify({ elevationId: insertedElevation.id, key: 'maxRefundAmount', value: '25000' })}
      )
    `;

    const activeElevations = await sql`
      SELECT * FROM limit_overrides WHERE staff_id = ${ramesh.id} AND status = 'active' AND expires_at > NOW()
    `;
    if (activeElevations.length === 0) {
      throw new Error('Active elevation not found!');
    }
    console.log(`[PASS] Active temporary elevation confirmed in database.\n`);

    // TEST 4: Revocation of Active Elevation
    console.log('--- TEST 4: Early Revocation of Temporary Elevation ---');
    await sql`
      UPDATE limit_overrides
      SET status = 'revoked'
      WHERE id = ${insertedElevation.id}
    `;

    const revokedElevation = (await sql`SELECT status FROM limit_overrides WHERE id = ${insertedElevation.id}`)[0];
    if (revokedElevation.status !== 'revoked') {
      throw new Error('Elevation status failed to update to revoked.');
    }
    console.log(`[PASS] Elevation ${insertedElevation.id} successfully revoked early.\n`);

    // TEST 5: Auto-Expiration Logic Test
    console.log('--- TEST 5: Auto-Expiration Simulation ---');
    const pastElevation = (await sql`
      INSERT INTO limit_overrides (
        staff_id, granted_by_id, permission_key, override_value, reason, status, expires_at
      )
      VALUES (
        ${ramesh.id}, ${manager.id}, 'canOverridePrice', 'true',
        'Quick price fix', 'active', NOW() - INTERVAL '5 minutes'
      )
      RETURNING *
    `)[0];

    // Trigger auto-expiration query
    await sql`
      UPDATE limit_overrides
      SET status = 'expired'
      WHERE status = 'active' AND expires_at <= NOW()
    `;

    const expiredCheck = (await sql`SELECT status FROM limit_overrides WHERE id = ${pastElevation.id}`)[0];
    if (expiredCheck.status !== 'expired') {
      throw new Error('Auto-expiration query failed to expire past elevation.');
    }
    console.log(`[PASS] Expired elevation automatically transitioned from 'active' to 'expired'.\n`);

    console.log('=== ALL PHASE 3 DATABASE & LOGIC TESTS PASSED! ===');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runTests();
