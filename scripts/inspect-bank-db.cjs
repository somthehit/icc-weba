const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const accs = await sql`SELECT * FROM bank_accounts`;
  console.log('Bank Accounts in DB count:', accs.length);
  console.log('Bank Accounts in DB:', accs.map(a => ({
    id: a.id,
    bankName: a.bank_name,
    accountNumber: a.account_number,
    accountType: a.account_type,
    openingBalance: a.opening_balance,
    currentBalance: a.current_balance,
    chartAccountId: a.chart_account_id
  })));

  const stmts = await sql`SELECT count(*) FROM bank_statements`;
  console.log('Total bank statements:', stmts[0].count);

  const coa = await sql`SELECT id, code, name, type FROM accounts WHERE type = 'asset' OR code LIKE '10%' LIMIT 20`;
  console.log('COA Bank/Cash accounts in DB:', coa);

  await sql.end();
}
check().catch(console.error);
