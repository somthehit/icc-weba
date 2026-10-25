// scripts/seed-phase3-sample-elevation.cjs
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require', max: 1 });

async function seed() {
  console.log('Seeding sample active elevation for testing...');

  const cashier = (await sql`SELECT id, name, staff_code FROM staff WHERE staff_code = 'CSH01'`)[0];
  const manager = (await sql`SELECT id, name FROM staff WHERE role = 'store_manager' LIMIT 1`)[0];

  if (!cashier || !manager) {
    console.error('Cashier or Manager not found.');
    process.exit(1);
  }

  // Check if active elevation already exists
  const existing = await sql`
    SELECT id FROM limit_overrides
    WHERE staff_id = ${cashier.id} AND status = 'active' AND expires_at > NOW()
  `;

  if (existing.length === 0) {
    const expiresAt = new Date(Date.now() + 3.5 * 60 * 60 * 1000); // 3.5 hours from now
    await sql`
      INSERT INTO limit_overrides (
        staff_id, granted_by_id, permission_key, override_value, reason, status, expires_at
      )
      VALUES (
        ${cashier.id}, ${manager.id}, 'maxRefundAmount', '25000',
        'Festival rush customer desk: authorized for high-value gadget return inspections without floor supervisor line delay',
        'active', ${expiresAt}
      )
    `;
    console.log(`Active elevation seeded for ${cashier.name} (${cashier.staff_code}) until ${expiresAt.toLocaleTimeString()}.`);
  } else {
    console.log('Active elevation already present.');
  }

  await sql.end();
  console.log('Done!');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
