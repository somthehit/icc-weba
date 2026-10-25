const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function run() {
  console.log('--- Cleaning mock bank reconciliation data and connecting real COA ---');

  // 1. Delete mock statements with fake reference numbers
  const deletedStmts = await sql`
    DELETE FROM bank_statements 
    WHERE reference_no IN ('TXN-NABIL-901', 'TXN-NABIL-902', 'CHQ-009844', 'IPS-776612')
    RETURNING id, reference_no
  `;
  console.log('Deleted mock statements:', deletedStmts);

  // Also clean up any orphan matches for those statements
  await sql`DELETE FROM reconciliation_matches WHERE statement_id NOT IN (SELECT id FROM bank_statements)`;

  // 2. Add Global IME Bank to bank_accounts if not exists
  const existingGime = await sql`SELECT id FROM bank_accounts WHERE account_number = '0401010008899' OR bank_name ILIKE '%Global IME%'`;
  if (existingGime.length === 0) {
    const insertedGime = await sql`
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
        'Global IME Operating Account',
        '0401010008899',
        '**** **** **** 8899',
        'Global IME Bank Ltd',
        'Global IME Bank',
        'Dhangadhi Main Branch, Kailali',
        'bank',
        14,
        '0.00',
        '0.00',
        true
      ) RETURNING id, account_name;
    `;
    console.log('Added Global IME Bank:', insertedGime);
  } else {
    console.log('Global IME Bank already exists with ID:', existingGime[0].id);
  }

  // 3. Reset mock opening_balance and current_balance on bank_accounts to 0.00 (clean real baseline)
  await sql`
    UPDATE bank_accounts
    SET opening_balance = '0.00',
        current_balance = '0.00',
        updated_at = NOW()
  `;
  console.log('Reset all bank accounts opening and current balances to clean 0.00 baseline.');

  // 4. Print current accounts and their GL balances
  const allAccs = await sql`
    SELECT b.id, b.account_name, b.bank_name, b.account_type, b.account_number, b.chart_account_id,
           a.code as coa_code, a.name as coa_name,
           COALESCE(SUM(jl.debit), 0) as gl_debits,
           COALESCE(SUM(jl.credit), 0) as gl_credits
    FROM bank_accounts b
    LEFT JOIN accounts a ON b.chart_account_id = a.id
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    GROUP BY b.id, b.account_name, b.bank_name, b.account_type, b.account_number, b.chart_account_id, a.code, a.name
    ORDER BY b.id
  `;
  console.log('Current Bank Accounts and Live GL balances:', allAccs);

  await sql.end();
}

run().catch(console.error);
