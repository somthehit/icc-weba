// scripts/schema-audit.ts
//
// Authoritative comparison of `db/schema/` against the live database.
//
// Reads the Drizzle table objects through `getTableConfig` rather than parsing the
// source, because a regex over the TS missed three whole tables (`accounts`,
// `journal_entries`, `journal_lines`) and reported "0 drifted" while
// `GET /api/accounting` was failing with 42P01. Anything that compiles is visible
// here, so the audit cannot silently skip a declaration style it does not expect.
//
// Run: npx tsx scripts/schema-audit.ts

import 'dotenv/config';
import postgres from 'postgres';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

import * as schema from '../db/schema';

interface Drift {
  table: string;
  missingTable: boolean;
  missingColumns: string[];
}

async function main() {
  const declared = new Map<string, Set<string>>();

  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    const config = getTableConfig(value as PgTable);
    declared.set(config.name, new Set(config.columns.map((c) => c.name)));
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const sql = postgres(url, { max: 1, connect_timeout: 25, prepare: false });

  try {
    const rows = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    `;

    const live = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!live.has(row.table_name)) live.set(row.table_name, new Set());
      live.get(row.table_name)!.add(row.column_name);
    }

    const drift: Drift[] = [];

    for (const [table, columns] of [...declared].sort(([a], [b]) => a.localeCompare(b))) {
      const have = live.get(table);
      if (!have) {
        drift.push({ table, missingTable: true, missingColumns: [...columns] });
        continue;
      }
      const missingColumns = [...columns].filter((c) => !have.has(c));
      if (missingColumns.length) drift.push({ table, missingTable: false, missingColumns });
    }

    console.log(`declared tables: ${declared.size}   live tables: ${live.size}`);

    if (drift.length === 0) {
      console.log('\nNo drift: every declared table and column exists.');
    } else {
      console.log(`\nDRIFT (${drift.length} table${drift.length === 1 ? '' : 's'}):\n`);
      for (const d of drift) {
        if (d.missingTable) {
          console.log(`  [TABLE MISSING] ${d.table}  (${d.missingColumns.length} columns)`);
        } else {
          console.log(`  [COLUMNS]       ${d.table}: ${d.missingColumns.join(', ')}`);
        }
      }
    }

    // Tables in the database that nothing declares. Not an error — Supabase's own
    // schemas live elsewhere, but a stray leftover here is worth noticing.
    const orphans = [...live.keys()].filter((t) => !declared.has(t)).sort();
    if (orphans.length) console.log(`\nundeclared tables in db: ${orphans.join(', ')}`);

    process.exitCode = drift.length ? 1 : 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
