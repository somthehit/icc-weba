const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function seed() {
  const sql = postgres(dbUrl, { ssl: 'require' });
  console.log('--- Seeding Realistic POS Shifts, Denominations, Movements, and Audit Logs ---');

  try {
    // 1. Get or create staff users for cashier and supervisor
    const usersList = await sql`SELECT id, name, role, email FROM users LIMIT 10`;
    let cashierUser = usersList.find(u => u.name.includes('Aayush') || u.role === 'sales') || usersList[0];
    let supervisorUser = usersList.find(u => u.role === 'admin' || u.name.includes('Admin') || u.name.includes('Manager')) || usersList[0];

    console.log(`Using Cashier: ${cashierUser.name} (ID: ${cashierUser.id}), Supervisor: ${supervisorUser.name} (ID: ${supervisorUser.id})`);

    // Clean up any remaining test shifts and test cash transactions
    await sql`
      DELETE FROM pos_shifts WHERE shift_number LIKE '%TEST%';
    `;
    await sql`
      DELETE FROM pos_cash_transactions WHERE shift_id = 1 OR performed_by_name = 'Sales Manager';
    `;

    // 2. Insert or update closed shift 1: Zero-activity shift (clearly labelled No Sales / Minimum duration override)
    const [zeroShift] = await sql`
      INSERT INTO pos_shifts (
        shift_number, register_code, cashier_id, cashier_name, cashier_code,
        opening_float, opening_denominations, standard_float, handover_variance,
        closing_cash, closing_denominations, expected_cash, cash_discrepancy,
        total_sales, total_cash_sales, total_card_sales, total_qr_sales, total_transactions,
        opened_by_supervisor_id, opened_by_supervisor_name,
        closed_by_supervisor_id, closed_by_supervisor_name,
        status, opened_at, closed_at, note,
        is_zero_sales, min_duration_override, min_duration_override_by, min_duration_override_reason,
        variance_approved, variance_approved_by, variance_approved_at
      ) VALUES (
        'SH-2081/82-000101', 'TERM-02 (Register A)', ${cashierUser.id}, 'Bikash Shrestha', 'EMP-204',
        5000.00, '{"1000": 3, "500": 3, "100": 4, "50": 2}', 5000.00, 0.00,
        5000.00, '{"1000": 3, "500": 3, "100": 4, "50": 2}', 5000.00, 0.00,
        0.00, 0.00, 0.00, 0.00, 0,
        ${supervisorUser.id}, ${supervisorUser.name + ' (Supervisor)'},
        ${supervisorUser.id}, ${supervisorUser.name + ' (Supervisor)'},
        'CLOSED', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '3 minutes',
        'Shift opened for register hardware maintenance and closed immediately. No sales conducted.',
        TRUE, TRUE, ${supervisorUser.name + ' (Supervisor)'}, 'Authorized early close for register hardware maintenance',
        TRUE, ${supervisorUser.name}, NOW() - INTERVAL '2 days' + INTERVAL '3 minutes'
      )
      ON CONFLICT DO NOTHING
      RETURNING id, shift_number;
    `;

    const zeroShiftId = zeroShift ? zeroShift.id : 1;

    // 3. Create Shift 2: Full Day Shift with sales, returns, voids, safe drops, and slight variance
    const openTimeShift2 = new Date(Date.now() - 28 * 60 * 60 * 1000); // 28 hours ago
    const closeTimeShift2 = new Date(Date.now() - 18 * 60 * 60 * 1000); // 18 hours ago

    const [fullShift] = await sql`
      INSERT INTO pos_shifts (
        shift_number, register_code, cashier_id, cashier_name, cashier_code,
        opening_float, opening_denominations, standard_float, handover_variance,
        closing_cash, closing_denominations, expected_cash, cash_discrepancy,
        total_sales, total_cash_sales, total_card_sales, total_qr_sales, total_transactions,
        opened_by_supervisor_id, opened_by_supervisor_name,
        closed_by_supervisor_id, closed_by_supervisor_name,
        status, opened_at, closed_at, note,
        is_zero_sales, min_duration_override,
        variance_approved, variance_approved_by, variance_approved_at, variance_reason
      ) VALUES (
        'SH-2081/82-000102', 'TERM-01 (Main Counter)', ${cashierUser.id}, 'Aayush Adhikari', 'EMP-104',
        10000.00, '{"1000": 6, "500": 6, "100": 8, "50": 3, "20": 2, "10": 1}', 10000.00, 0.00,
        28450.00, '{"1000": 22, "500": 10, "100": 12, "50": 4, "20": 2, "10": 1}', 28500.00, -50.00,
        146500.00, 38500.00, 48000.00, 60000.00, 14,
        ${supervisorUser.id}, ${supervisorUser.name + ' (Store Manager)'},
        ${supervisorUser.id}, ${supervisorUser.name + ' (Store Manager)'},
        'CLOSED', ${openTimeShift2}, ${closeTimeShift2}, 'Regular morning & afternoon peak shift. NPR 20,000 safe drop performed at 14:30.',
        FALSE, FALSE,
        TRUE, ${supervisorUser.name}, ${closeTimeShift2}, 'Minor rounding shortage on small change (< NPR 50 auto-approved tolerance)'
      )
      RETURNING id, shift_number;
    `;

    const shiftId2 = fullShift.id;
    console.log(`Created Full Shift #${fullShift.shift_number} (ID: ${shiftId2})`);

    // 4. Denomination Counts for Shift 2 (BOD, Cashier Closing, Supervisor Receiving)
    // Opening count
    await sql`
      INSERT INTO pos_shift_denominations (
        shift_id, count_type, attempt_number,
        d1000, d500, d100, d50, d20, d10, d5, d2, d1, coins,
        total_amount, counted_by_id, counted_by_name, verified_by_id, verified_by_name, created_at
      ) VALUES (
        ${shiftId2}, 'OPENING', 1,
        6, 6, 8, 3, 2, 1, 0, 0, 0, 0,
        10000.00, ${cashierUser.id}, 'Aayush Adhikari', ${supervisorUser.id}, ${supervisorUser.name}, ${openTimeShift2}
      );
    `;

    // Cashier Closing Blind Count
    await sql`
      INSERT INTO pos_shift_denominations (
        shift_id, count_type, attempt_number,
        d1000, d500, d100, d50, d20, d10, d5, d2, d1, coins,
        total_amount, counted_by_id, counted_by_name, verified_by_id, verified_by_name, reason, created_at
      ) VALUES (
        ${shiftId2}, 'CASHIER_CLOSING', 1,
        22, 10, 12, 4, 2, 1, 0, 0, 0, 0,
        28450.00, ${cashierUser.id}, 'Aayush Adhikari', NULL, NULL, 'Initial EOD blind count submitted by cashier', ${closeTimeShift2}
      );
    `;

    // Supervisor Receiving Count
    await sql`
      INSERT INTO pos_shift_denominations (
        shift_id, count_type, attempt_number,
        d1000, d500, d100, d50, d20, d10, d5, d2, d1, coins,
        total_amount, counted_by_id, counted_by_name, verified_by_id, verified_by_name, reason, created_at
      ) VALUES (
        ${shiftId2}, 'SUPERVISOR_RECEIVING', 1,
        22, 10, 12, 4, 2, 1, 0, 0, 0, 0,
        28450.00, ${supervisorUser.id}, ${supervisorUser.name}, ${cashierUser.id}, 'Aayush Adhikari', 'Verified cash envelope at vault receiving counter', ${closeTimeShift2}
      );
    `;

    // 5. Cash movements for Shift 2
    await sql`
      INSERT INTO pos_shift_cash_movements (
        shift_id, type, amount, reason, authorized_by_name, receipt_no, created_at
      ) VALUES 
      (
        ${shiftId2}, 'SAFE_DROP', 20000.00, 'Mid-day cash drop to secure vault (drawer limit NPR 30k exceeded)', ${supervisorUser.name}, 'SD-2081-042', ${new Date(openTimeShift2.getTime() + 4 * 3600 * 1000)}
      ),
      (
        ${shiftId2}, 'PAID_OUT', 500.00, 'Store cleaning supplies & drinking water jar purchase', ${supervisorUser.name}, 'PV-2081-109', ${new Date(openTimeShift2.getTime() + 2 * 3600 * 1000)}
      ),
      (
        ${shiftId2}, 'PAID_IN', 450.00, 'Customer advance refund settlement returned to till', ${supervisorUser.name}, 'PI-2081-088', ${new Date(openTimeShift2.getTime() + 5 * 3600 * 1000)}
      );
    `;

    // Also populate legacy pos_cash_transactions for compatibility
    await sql`
      INSERT INTO pos_cash_transactions (
        shift_id, type, amount, reason, performed_by_name, created_at
      ) VALUES
      (${shiftId2}, 'SAFE_DROP', 20000.00, 'Mid-day cash drop to secure vault', ${supervisorUser.name}, ${new Date(openTimeShift2.getTime() + 4 * 3600 * 1000)}),
      (${shiftId2}, 'CASH_OUT', 500.00, 'Cleaning supplies & water jar', ${cashierUser.name}, ${new Date(openTimeShift2.getTime() + 2 * 3600 * 1000)}),
      (${shiftId2}, 'CASH_IN', 450.00, 'Customer advance refund return', ${cashierUser.name}, ${new Date(openTimeShift2.getTime() + 5 * 3600 * 1000)});
    `;

    // 6. Tender Reconciliations for Shift 2
    await sql`
      INSERT INTO pos_shift_tender_reconciliations (
        shift_id, tender_type, system_amount, entered_amount, variance, reference_no, batch_number, status, notes
      ) VALUES
      (${shiftId2}, 'card', 48000.00, 48000.00, 0.00, 'NABIL-POS-B09', 'BATCH-8821', 'BALANCED', 'Batch total matches settlement terminal slip perfectly'),
      (${shiftId2}, 'fonepay', 35000.00, 35000.00, 0.00, 'FP-MER-7712', 'SETTLE-20811002', 'AUTO_MATCHED', 'Auto-confirmed via Fonepay Merchant webhook API'),
      (${shiftId2}, 'esewa', 15000.00, 15000.00, 0.00, 'ESEWA-ST-4421', 'TRX-99812', 'AUTO_MATCHED', 'Auto-confirmed via eSewa ePay merchant portal'),
      (${shiftId2}, 'khalti', 10000.00, 10000.00, 0.00, 'KHALTI-M-1102', 'BATCH-0021', 'AUTO_MATCHED', 'Auto-confirmed via Khalti merchant API');
    `;

    // 7. Realistic Transactions for Shift 2 in pos_transactions
    const sampleTxns = [
      {
        inv: 'INV-2081/82-004501',
        amt: 18500.00,
        method: 'cash',
        customer: 'Sita Ram Regmi',
        phone: '9848011223',
        status: 'completed',
        items: [
          { sku: 'MON-LG-24', name: 'LG 24" IPS FHD 100Hz Monitor', quantity: 1, unitPrice: 16500, lineTotal: 16500, serialNumbers: ['LG24-884102'] },
          { sku: 'ACC-LOGI-M170', name: 'Logitech M170 Wireless Mouse', quantity: 1, unitPrice: 2000, lineTotal: 2000 }
        ]
      },
      {
        inv: 'INV-2081/82-004502',
        amt: 48000.00,
        method: 'card',
        customer: 'Apex Engineering Consultancy',
        phone: '9858421099',
        status: 'completed',
        items: [
          { sku: 'LAP-ACER-A315', name: 'Acer Aspire 3 Intel Core i5 12th Gen (16GB/512GB)', quantity: 1, unitPrice: 48000, lineTotal: 48000, serialNumbers: ['NXHSKSI991204'] }
        ]
      },
      {
        inv: 'INV-2081/82-004503',
        amt: 35000.00,
        method: 'fonepay',
        customer: 'Bishnu Prasad Pant',
        phone: '9812765432',
        status: 'completed',
        items: [
          { sku: 'GPU-ASUS-1650', name: 'ASUS TUF GTX 1650 4GB GDDR6', quantity: 1, unitPrice: 24500, lineTotal: 24500, serialNumbers: ['AS-GTX-90114'] },
          { sku: 'RAM-CORSAIR-16', name: 'Corsair Vengeance 16GB DDR4 3200MHz', quantity: 2, unitPrice: 5250, lineTotal: 10500 }
        ]
      },
      {
        inv: 'INV-2081/82-004504',
        amt: 20000.00,
        method: 'cash',
        customer: 'Kailali Polytechnic Institute',
        phone: '091-521440',
        status: 'completed',
        items: [
          { sku: 'SSD-SAMS-980-1TB', name: 'Samsung 980 NVMe SSD 1TB M.2 PCIe 3.0', quantity: 2, unitPrice: 10000, lineTotal: 20000 }
        ]
      },
      {
        inv: 'INV-2081/82-004505',
        amt: 15000.00,
        method: 'esewa',
        customer: 'Manish Bhatta',
        phone: '9868712390',
        status: 'completed',
        items: [
          { sku: 'UPS-PROLINK-1200', name: 'Prolink 1200VA Line Interactive UPS', quantity: 1, unitPrice: 15000, lineTotal: 15000 }
        ]
      },
      {
        inv: 'INV-2081/82-004506',
        amt: 10000.00,
        method: 'khalti',
        customer: 'Rupesh Rawal',
        phone: '9848443322',
        status: 'completed',
        items: [
          { sku: 'HEAD-RAZER-X', name: 'Razer BlackShark V2 X Gaming Headset', quantity: 1, unitPrice: 7500, lineTotal: 7500 },
          { sku: 'KEY-REDRAGON-K552', name: 'Redragon Kumara K552 RGB Mechanical Keyboard', quantity: 1, unitPrice: 2500, lineTotal: 2500 }
        ]
      }
    ];

    for (let i = 0; i < sampleTxns.length; i++) {
      const t = sampleTxns[i];
      const txTime = new Date(openTimeShift2.getTime() + (i + 1) * 45 * 60 * 1000);
      const vatPortion = Math.round((t.amt * 0.13 / 1.13) * 100) / 100;
      const taxablePortion = t.amt - vatPortion;

      await sql`
        INSERT INTO pos_transactions (
          shift_id, cashier_id, cashier_name, terminal_code,
          invoice_number, total_amount, payment_method, payment_breakdown,
          items, customer_name, customer_phone, created_at
        ) VALUES (
          ${shiftId2}, ${cashierUser.id}, 'Aayush Adhikari', 'TERM-01 (Main Counter)',
          ${t.inv}, ${t.amt}, ${t.method},
          ${sql.json({
            method: t.method,
            taxableAmount: taxablePortion,
            vatAmount: vatPortion,
            discountAmount: 0,
            cbmsSynced: true,
            cbmsAck: `CBMS-IRD-2081-${1000 + i}`,
            tenderDetails: { [t.method]: t.amt }
          })},
          ${sql.json(t.items)},
          ${t.customer}, ${t.phone}, ${txTime}
        )
        ON CONFLICT (invoice_number) DO NOTHING;
      `;
    }

    // 8. Hash-Chained Audit Logs for Shift 2
    let prevHash = 'GENESIS_HASH_ICC_POS_2081';
    const auditEvents = [
      { action: 'BOD_SHIFT_OPEN', meta: { shiftNumber: fullShift.shift_number, openingFloat: 10000, denominations: { 1000: 6, 500: 6, 100: 8, 50: 3, 20: 2, 10: 1 } }, time: openTimeShift2 },
      { action: 'CASH_DROP_TO_SAFE', meta: { shiftNumber: fullShift.shift_number, amount: 20000, reason: 'Mid-day safe drop authorized by supervisor', voucher: 'SD-2081-042' }, time: new Date(openTimeShift2.getTime() + 4 * 3600 * 1000) },
      { action: 'PAID_OUT_RECORDED', meta: { shiftNumber: fullShift.shift_number, amount: 500, reason: 'Cleaning supplies & water jar', voucher: 'PV-2081-109' }, time: new Date(openTimeShift2.getTime() + 2 * 3600 * 1000) },
      { action: 'EOD_BLIND_COUNT_SUBMIT', meta: { shiftNumber: fullShift.shift_number, countedCash: 28450, expectedCash: 28500, variance: -50 }, time: closeTimeShift2 },
      { action: 'SUPERVISOR_RECEIVING_VERIFIED', meta: { shiftNumber: fullShift.shift_number, supervisorCount: 28450, cashierCount: 28450, handoverVariance: 0 }, time: new Date(closeTimeShift2.getTime() + 5 * 60 * 1000) },
      { action: 'EOD_SHIFT_CLOSED_APPROVED', meta: { shiftNumber: fullShift.shift_number, status: 'CLOSED', approvedVariance: -50, supervisorName: supervisorUser.name }, time: new Date(closeTimeShift2.getTime() + 6 * 60 * 1000) }
    ];

    for (const evt of auditEvents) {
      const hashContent = `${prevHash}|${evt.action}|${JSON.stringify(evt.meta)}|${evt.time.toISOString()}`;
      const hash = crypto.createHash('sha256').update(hashContent).digest('hex');

      await sql`
        INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id,
          metadata, created_at
        ) VALUES (
          ${cashierUser.id},
          ${evt.action}, 'pos_shift', ${shiftId2},
          ${sql.json({ ...evt.meta, prevHash, hash, terminalCode: 'TERM-01 (Main Counter)', userName: cashierUser.name })},
          ${evt.time}
        );
      `;
      prevHash = hash;
    }

    console.log('✓ Successfully seeded realistic POS shifts, denominations, transactions, and audit trail!');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
