import 'dotenv/config';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function check() {
  const tablesResult = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const tables = (tablesResult as any).rows.map((r: any) => r.table_name);
  console.log(`Checking ${tables.length} tables for row counts...`);

  const nonEmpty: Record<string, number> = {};
  for (const table of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT count(*) FROM "${table}";`));
      const count = parseInt((res as any).rows[0].count, 10);
      if (count > 0) {
        nonEmpty[table] = count;
      }
    } catch (e: any) {
      console.log(`Error checking ${table}:`, e.message);
    }
  }
  console.log('Non-empty tables:', nonEmpty);
}

check().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
