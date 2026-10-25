const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"\r\n]+)"/);
const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function check() {
  const jl = await sql`
    SELECT jl.account_id, a.code, a.name, SUM(jl.debit) as debits, SUM(jl.credit) as credits, count(*) as count
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    GROUP BY jl.account_id, a.code, a.name
    ORDER BY jl.account_id
  `;
  console.log('Journal Lines by account:', jl);

  const stmts = await sql`SELECT id, bank_account_id, statement_date, description, reference_no, debit_amount, credit_amount, balance_after, is_reconciled FROM bank_statements`;
  console.log('Bank Statements in DB:', stmts);

  // Check actual orders / POS sales payment methods
  const orders = await sql`
    SELECT payment_method, payment_status, count(*), sum(total_amount) as total
    FROM orders
    GROUP BY payment_method, payment_status
  `;
  console.log('Orders summary:', orders);

  await sql.end();
}

check().catch(console.error);
