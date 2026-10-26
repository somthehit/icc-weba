const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postgres = require('postgres');
const { hash } = require('@node-rs/argon2');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

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

async function seed() {
  console.log('--- Seeding Enterprise Staff, Terminals, and Shifts ---');

  // 1. Terminals
  const terminalsData = [
    { code: 'REG-01', name: 'Counter 01 - Laptops & Desktops', branch: 'Main - Dhangadhi' },
    { code: 'REG-02', name: 'Counter 02 - Accessories & Peripherals', branch: 'Main - Dhangadhi' },
    { code: 'REG-03', name: 'Counter 03 - Mobile & Repair Counter', branch: 'Main - Dhangadhi' },
  ];

  for (const t of terminalsData) {
    const existing = await sql`SELECT id FROM terminals WHERE code = ${t.code}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO terminals (code, name, branch_id, active, is_locked)
        VALUES (${t.code}, ${t.name}, ${t.branch}, true, false)
      `;
      console.log(`Created terminal: ${t.code}`);
    }
  }

  // 2. Staff roster (2 Supervisors, 5 Cashiers, 1 Admin, 1 Accountant, 1 Inventory Manager)
  const staffData = [
    {
      code: 'ADM01',
      name: 'Bimal Sharma',
      role: 'admin',
      phone: '9851084291',
      email: 'admin@icecomputers.com.np',
      pin: '8492',
      defaultShift: 'day',
      branch: 'Main - Dhangadhi',
      notes: 'System Administrator & Store Owner',
      emergencyContact: '9841000001 (Spouse)'
    },
    {
      code: 'SUP01',
      name: 'Sujan Shrestha',
      role: 'store_manager',
      phone: '9801234567',
      email: 'sujan.mgr@icecomputers.com.np',
      pin: '7391',
      defaultShift: 'morning',
      branch: 'Main - Dhangadhi',
      notes: 'Senior Store Operations Manager',
      emergencyContact: '9801000002 (Brother)'
    },
    {
      code: 'SUP02',
      name: 'Kiran Joshi',
      role: 'supervisor',
      phone: '9848012345',
      email: 'kiran.sup@icecomputers.com.np',
      pin: '6284',
      defaultShift: 'evening',
      branch: 'Main - Dhangadhi',
      notes: 'Front Desk Floor Supervisor',
      emergencyContact: '9848000003 (Father)'
    },
    {
      code: 'CSH01',
      name: 'Aayush Adhikari',
      role: 'senior_cashier',
      phone: '9841234567',
      email: 'aayush.csh@icecomputers.com.np',
      pin: '9153',
      defaultShift: 'morning',
      branch: 'Main - Dhangadhi',
      notes: 'Primary Counter Cashier - High Accuracy',
      emergencyContact: '9841000004 (Mother)'
    },
    {
      code: 'CSH02',
      name: 'Pooja KC',
      role: 'cashier',
      phone: '9861234567',
      email: 'pooja.csh@icecomputers.com.np',
      pin: '8362',
      defaultShift: 'day',
      branch: 'Main - Dhangadhi',
      notes: 'Day Shift Cashier - Counter 2',
      emergencyContact: '9861000005 (Sister)'
    },
    {
      code: 'CSH03',
      name: 'Bikash Shrestha',
      role: 'cashier',
      phone: '9812345678',
      email: 'bikash.csh@icecomputers.com.np',
      pin: '7194',
      defaultShift: 'evening',
      branch: 'Main - Dhangadhi',
      notes: 'Evening Shift Counter Cashier',
      emergencyContact: '9812000006 (Spouse)'
    },
    {
      code: 'CSH04',
      name: 'Sunita Thapa',
      role: 'cashier',
      phone: '9808765432',
      email: 'sunita.csh@icecomputers.com.np',
      pin: '5928',
      defaultShift: 'morning',
      branch: 'Main - Dhangadhi',
      notes: 'Counter 3 Hardware Cashier',
      emergencyContact: '9808000007 (Brother)'
    },
    {
      code: 'CSH05',
      name: 'Ramesh Bhatta',
      role: 'cashier',
      phone: '9849876543',
      email: 'ramesh.csh@icecomputers.com.np',
      pin: '4839',
      defaultShift: 'evening',
      branch: 'Main - Dhangadhi',
      notes: 'Junior Cashier - In Probation',
      emergencyContact: '9849000008 (Father)'
    },
    {
      code: 'ACC01',
      name: 'Gita Pathak',
      role: 'accountant',
      phone: '9851122334',
      email: 'gita.acc@icecomputers.com.np',
      pin: '9472',
      defaultShift: 'day',
      branch: 'Main - Dhangadhi',
      notes: 'Senior Retail Accountant & Tax Lead',
      emergencyContact: '9851000009 (Husband)'
    },
    {
      code: 'INV01',
      name: 'Deepak Verma',
      role: 'inventory_manager',
      phone: '9841998877',
      email: 'deepak.inv@icecomputers.com.np',
      pin: '6183',
      defaultShift: 'day',
      branch: 'Main - Dhangadhi',
      notes: 'Warehouse & Receiving Head',
      emergencyContact: '9841000010 (Brother)'
    }
  ];

  for (const s of staffData) {
    const pinH = await hashCredential(s.pin);
    const passH = await hashCredential('Welcome@123');

    const existing = await sql`SELECT id FROM staff WHERE staff_code = ${s.code}`;
    let staffId;

    if (existing.length === 0) {
      const inserted = await sql`
        INSERT INTO staff (
          staff_code, name, email, phone, role, password_hash, pin_hash,
          status, branch_id, default_shift, emergency_contact, notes,
          must_change_password, must_change_pin, active, join_date, pin_changed_at
        )
        VALUES (
          ${s.code}, ${s.name}, ${s.email}, ${s.phone}, ${s.role}, ${passH}, ${pinH},
          'active', ${s.branch}, ${s.defaultShift}, ${s.emergencyContact}, ${s.notes},
          false, false, true, CURRENT_DATE - 90, NOW() - interval '10 days'
        )
        RETURNING id
      `;
      staffId = inserted[0].id;
      console.log(`Created staff: ${s.code} - ${s.name} (${s.role})`);
    } else {
      staffId = existing[0].id;
      await sql`
        UPDATE staff SET
          name = ${s.name},
          role = ${s.role},
          phone = ${s.phone},
          email = ${s.email},
          pin_hash = ${pinH},
          status = 'active',
          branch_id = ${s.branch},
          default_shift = ${s.defaultShift},
          emergency_contact = ${s.emergencyContact},
          notes = ${s.notes},
          pin_changed_at = NOW() - interval '10 days'
        WHERE id = ${staffId}
      `;
      console.log(`Updated staff: ${s.code} - ${s.name} (${s.role})`);
    }

    // Record in pin_history
    await sql`
      INSERT INTO pin_history (staff_id, pin_hash, created_at)
      VALUES (${staffId}, ${pinH}, NOW() - interval '10 days')
    `;

    // Seed staff_limits
    const isMgr = s.role === 'admin' || s.role === 'store_manager' || s.role === 'supervisor';
    await sql`
      INSERT INTO staff_limits (
        staff_id, max_line_discount_pct, max_invoice_discount_amount, max_refund_amount,
        max_void_amount, can_override_price, can_no_sale_open, max_cash_payout, can_credit_sale,
        return_window_days
      )
      VALUES (
        ${staffId},
        ${isMgr ? 25.00 : 7.50},
        ${isMgr ? 15000.00 : 1500.00},
        ${isMgr ? 50000.00 : 5000.00},
        ${isMgr ? 50000.00 : 3000.00},
        ${isMgr},
        ${isMgr},
        ${isMgr ? 25000.00 : 2000.00},
        ${isMgr},
        ${isMgr ? 30 : 7}
      )
      ON CONFLICT (staff_id) DO UPDATE SET
        max_line_discount_pct = EXCLUDED.max_line_discount_pct,
        max_invoice_discount_amount = EXCLUDED.max_invoice_discount_amount;
    `;
  }

  // 3. Link staff to terminals
  const allTerminals = await sql`SELECT id, code FROM terminals`;
  const allStaff = await sql`SELECT id, staff_code, role FROM staff`;

  for (const st of allStaff) {
    for (const term of allTerminals) {
      const existing = await sql`SELECT id FROM staff_terminals WHERE staff_id = ${st.id} AND terminal_id = ${term.id}`;
      if (existing.length === 0) {
        await sql`
          INSERT INTO staff_terminals (staff_id, terminal_id, is_primary)
          VALUES (${st.id}, ${term.id}, ${term.code === 'REG-01'})
        `;
      }
    }
  }
  console.log('Linked staff to registered terminals.');

  // 4. Seed realistic shifts for variance calculation
  // Let's populate shifts for CSH01, CSH02, CSH03, CSH04, CSH05
  const shiftsPlan = [
    // CSH01 (Aayush): 6 shifts, Net variance: -50 (balanced track record)
    { code: 'CSH01', name: 'Aayush Adhikari', reg: 'REG-01', sales: 125000, exp: 45000, close: 45000, disc: 0, daysAgo: 1 },
    { code: 'CSH01', name: 'Aayush Adhikari', reg: 'REG-01', sales: 98000, exp: 32000, close: 32000, disc: 0, daysAgo: 2 },
    { code: 'CSH01', name: 'Aayush Adhikari', reg: 'REG-01', sales: 142000, exp: 51000, close: 50950, disc: -50, daysAgo: 3 },
    { code: 'CSH01', name: 'Aayush Adhikari', reg: 'REG-01', sales: 110000, exp: 40000, close: 40000, disc: 0, daysAgo: 4 },
    { code: 'CSH01', name: 'Aayush Adhikari', reg: 'REG-01', sales: 88000, exp: 29000, close: 29000, disc: 0, daysAgo: 5 },
    { code: 'CSH01', name: 'Aayush Adhikari', reg: 'REG-01', sales: 165000, exp: 62000, close: 62000, disc: 0, daysAgo: 6 },

    // CSH02 (Pooja): 5 shifts, Net variance: +150 (small overage)
    { code: 'CSH02', name: 'Pooja KC', reg: 'REG-02', sales: 74000, exp: 25000, close: 25100, disc: 100, daysAgo: 1 },
    { code: 'CSH02', name: 'Pooja KC', reg: 'REG-02', sales: 82000, exp: 31000, close: 31000, disc: 0, daysAgo: 2 },
    { code: 'CSH02', name: 'Pooja KC', reg: 'REG-02', sales: 95000, exp: 34000, close: 34050, disc: 50, daysAgo: 3 },
    { code: 'CSH02', name: 'Pooja KC', reg: 'REG-02', sales: 68000, exp: 21000, close: 21000, disc: 0, daysAgo: 4 },
    { code: 'CSH02', name: 'Pooja KC', reg: 'REG-02', sales: 102000, exp: 38000, close: 38000, disc: 0, daysAgo: 5 },

    // CSH03 (Bikash): 4 shifts, Net variance: 0 (perfect accuracy)
    { code: 'CSH03', name: 'Bikash Shrestha', reg: 'REG-02', sales: 54000, exp: 18000, close: 18000, disc: 0, daysAgo: 1 },
    { code: 'CSH03', name: 'Bikash Shrestha', reg: 'REG-02', sales: 61000, exp: 22000, close: 22000, disc: 0, daysAgo: 2 },
    { code: 'CSH03', name: 'Bikash Shrestha', reg: 'REG-02', sales: 49000, exp: 16000, close: 16000, disc: 0, daysAgo: 3 },
    { code: 'CSH03', name: 'Bikash Shrestha', reg: 'REG-02', sales: 72000, exp: 27000, close: 27000, disc: 0, daysAgo: 4 },

    // CSH04 (Sunita): 4 shifts, Net variance: -200 (small short)
    { code: 'CSH04', name: 'Sunita Thapa', reg: 'REG-03', sales: 43000, exp: 14000, close: 13900, disc: -100, daysAgo: 1 },
    { code: 'CSH04', name: 'Sunita Thapa', reg: 'REG-03', sales: 38000, exp: 12000, close: 12000, disc: 0, daysAgo: 2 },
    { code: 'CSH04', name: 'Sunita Thapa', reg: 'REG-03', sales: 52000, exp: 19000, close: 18900, disc: -100, daysAgo: 3 },
    { code: 'CSH04', name: 'Sunita Thapa', reg: 'REG-03', sales: 41000, exp: 15000, close: 15000, disc: 0, daysAgo: 4 },

    // CSH05 (Ramesh): 4 shifts, Net variance: -1850 (repeated shortage - anomaly trigger!)
    { code: 'CSH05', name: 'Ramesh Bhatta', reg: 'REG-03', sales: 62000, exp: 24000, close: 23200, disc: -800, daysAgo: 1 },
    { code: 'CSH05', name: 'Ramesh Bhatta', reg: 'REG-03', sales: 49000, exp: 17000, close: 16500, disc: -500, daysAgo: 2 },
    { code: 'CSH05', name: 'Ramesh Bhatta', reg: 'REG-03', sales: 58000, exp: 21000, close: 20450, disc: -550, daysAgo: 3 },
    { code: 'CSH05', name: 'Ramesh Bhatta', reg: 'REG-03', sales: 35000, exp: 11000, close: 11000, disc: 0, daysAgo: 4 },
  ];

  for (let i = 0; i < shiftsPlan.length; i++) {
    const sp = shiftsPlan[i];
    const shiftNum = `SH-2081/82-${String(1000 + i).padStart(6, '0')}`;
    const checkExisting = await sql`SELECT id FROM pos_shifts WHERE shift_number = ${shiftNum}`;
    if (checkExisting.length === 0) {
      await sql`
        INSERT INTO pos_shifts (
          shift_number, register_code, cashier_code, cashier_name,
          total_sales, expected_cash, closing_cash, cash_discrepancy,
          status, opened_at, closed_at, total_transactions
        )
        VALUES (
          ${shiftNum}, ${sp.reg}, ${sp.code}, ${sp.name},
          ${sp.sales}, ${sp.exp}, ${sp.close}, ${sp.disc},
          'CLOSED', NOW() - (${sp.daysAgo} * INTERVAL '1 day' + INTERVAL '8 hours'),
          NOW() - (${sp.daysAgo} * INTERVAL '1 day'),
          ${Math.floor(sp.sales / 3500) + 5}
        )
      `;
    }
  }
  console.log('Seeded realistic historical shifts.');

  await sql.end();
  console.log('--- Seeding Complete Successfully! ---');
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
