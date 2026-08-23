// db/apply-migration.ts
//
// Applies a single hand-written migration file directly.
//
// Why not `drizzle-kit migrate`? This database was originally bootstrapped with
// `drizzle-kit push`, so there is no trustworthy __drizzle_migrations ledger —
// running the official migrator would try to replay 0000/0001 against a schema
// that already has those objects. Every migration from 0001 onwards is therefore
// written with `IF NOT EXISTS` guards and applied through this runner instead.
//
// Usage:  npm run db:apply -- drizzle/migrations/0003_organic_drax.sql

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run db:apply -- <path-to-sql>');
  process.exit(1);
}

async function main() {
  const statements = readFileSync(file, 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    // Drop chunks that are only SQL comments (the file header, mostly).
    .map((s) => (s.replace(/^\s*--[^\n]*\n?/gm, '').trim() ? s : ''))
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} statement(s) from ${file}`);
  for (const [i, stmt] of statements.entries()) {
    await db.execute(sql.raw(stmt));
    const label = stmt.replace(/^\s*--[^\n]*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 90);
    console.log(`  ✓ [${i + 1}/${statements.length}] ${label}`);
  }
  console.log('✅ Migration applied.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
