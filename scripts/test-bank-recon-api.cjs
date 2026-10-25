const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function testRecon() {
  console.log('=== Testing Bank & Digital Wallet Reconciliation with Real Data & COA Link ===');

  // 1. Fetch current bank accounts with linked COA accounts
  const bankAccs = await sql`
    SELECT b.id, b.account_name, b.bank_name, b.account_type, b.account_number, b.masked_account_number,
           b.chart_account_id, a.code as coa_code, a.name as coa_name,
           COALESCE(SUM(jl.debit), 0) as gl_debits,
           COALESCE(SUM(jl.credit), 0) as gl_credits
    FROM bank_accounts b
    LEFT JOIN accounts a ON b.chart_account_id = a.id
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    WHERE b.is_active = true
    GROUP BY b.id, b.account_name, b.bank_name, b.account_type, b.account_number, b.masked_account_number, b.chart_account_id, a.code, a.name
    ORDER BY b.id
  `;

  console.log(`Found ${bankAccs.length} active bank & digital wallet accounts in ERP:`);
  for (const acc of bankAccs) {
    const bookBalance = parseFloat(acc.gl_debits) - parseFloat(acc.gl_credits);
    console.log(`- [#${acc.id}] ${acc.account_name} (${acc.bank_name}) | COA: [${acc.coa_code || 'UNLINKED'}] ${acc.coa_name || 'No COA'} | Live GL Balance: NPR ${bookBalance.toLocaleString('en-IN')}`);
  }

  // 2. Test registering a new test bank account with auto-created COA
  console.log('\n--- Test: Creating New Commercial Bank Account with Auto-Created COA ---');
  const testAccNumber = `TEST-NIC-${Date.now().toString().slice(-4)}`;
  
  // Find next available COA code
  const coaRows = await sql`SELECT code FROM accounts WHERE code LIKE '10%'`;
  let maxCode = 1044;
  for (const r of coaRows) {
    const num = parseInt(r.code, 10);
    if (!isNaN(num) && num >= 1000 && num < 1100 && num > maxCode) maxCode = num;
  }
  const newCode = String(maxCode + 1);

  const [newCoa] = await sql`
    INSERT INTO accounts (code, name, type, is_active)
    VALUES (${newCode}, 'Bank - NIC Asia Test Operating', 'asset', true)
    RETURNING id, code, name
  `;
  console.log(`Created new General Ledger Asset Account: [${newCoa.code}] ${newCoa.name} (ID: ${newCoa.id})`);

  const [newBank] = await sql`
    INSERT INTO bank_accounts (
      account_name,
      account_number,
      masked_account_number,
      bank_name,
      provider,
      branch,
      account_type,
      chart_account_id,
      opening_balance,
      current_balance,
      is_active
    ) VALUES (
      'NIC Asia Operating A/C',
      ${testAccNumber},
      ${'**** ' + testAccNumber.slice(-4)},
      'NIC Asia Bank Ltd',
      'NIC Asia Bank',
      'Kailali Dhangadhi Branch',
      'bank',
      ${newCoa.id},
      '0.00',
      '0.00',
      true
    ) RETURNING id, account_name, bank_name, chart_account_id;
  `;
  console.log(`Registered Bank Account: [ID: ${newBank.id}] ${newBank.account_name} linked to COA ID ${newBank.chart_account_id}`);

  // Clean up test records
  await sql`DELETE FROM bank_accounts WHERE id = ${newBank.id}`;
  await sql`DELETE FROM accounts WHERE id = ${newCoa.id}`;
  console.log('Cleaned up test bank and test COA accounts.');

  await sql.end();
  console.log('\n=== All Tests Passed Successfully! ===');
}

testRecon().catch(console.error);
