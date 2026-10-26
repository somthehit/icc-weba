import 'dotenv/config';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const connectionString = (process.env.DATABASE_URL || '').replace(':6543/', ':5432/');
if (!connectionString) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

async function main() {
  console.log('🔄 Step 1: Resetting public schema to apply clean UUID architecture...');
  const initSql = postgres(connectionString, { max: 1 });
  await initSql.unsafe(`DROP SCHEMA IF EXISTS public CASCADE;`);
  await initSql.unsafe(`CREATE SCHEMA public;`);
  await initSql.unsafe(`GRANT ALL ON SCHEMA public TO postgres;`);
  await initSql.unsafe(`GRANT ALL ON SCHEMA public TO public;`);
  try {
    await initSql.unsafe(`GRANT ALL ON SCHEMA public TO anon;`);
    await initSql.unsafe(`GRANT ALL ON SCHEMA public TO authenticated;`);
    await initSql.unsafe(`GRANT ALL ON SCHEMA public TO service_role;`);
  } catch (e: any) {
    console.log('Role grant notice:', e.message);
  }
  await initSql.end();
  console.log('✅ Schema public reset successfully.');

  console.log('🔄 Step 2: Connecting with fresh search_path session...');
  const sql = postgres(connectionString, { max: 1 });
  await sql.unsafe(`SET search_path TO public;`);

  console.log('🔢 Step 3: Creating prerequisite sequences...');
  await sql.unsafe(`CREATE SEQUENCE IF NOT EXISTS "cod_settlement_number_seq" AS bigint START 1;`);
  await sql.unsafe(`CREATE SEQUENCE IF NOT EXISTS "contact_inquiry_number_seq" AS bigint START 1;`);
  console.log('✅ Sequences created.');

  const migrationPath = 'drizzle/fresh-migrations/0000_calm_terrax.sql';
  console.log(`📄 Step 4: Reading migration from ${migrationPath}...`);
  const rawSql = readFileSync(migrationPath, 'utf8');

  const statements = rawSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .map((s) => (s.replace(/^\s*--[^\n]*\n?/gm, '').trim() ? s : ''))
    .filter((s) => s.length > 0);

  console.log(`🚀 Step 5: Applying ${statements.length} schema statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await sql.unsafe(stmt);
      if ((i + 1) % 50 === 0 || i === statements.length - 1) {
        console.log(`  ✓ Progress: ${i + 1}/${statements.length} statements applied`);
      }
    } catch (err: any) {
      console.error(`❌ Error on statement ${i + 1}:`, stmt.slice(0, 140));
      console.error(err);
      await sql.end();
      throw err;
    }
  }

  console.log('🛡️ Step 6: Creating append-only trigger for inventory movements...');
  await sql.unsafe(`
    CREATE OR REPLACE FUNCTION "inventory_movements_append_only"() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION
        'inventory_movements is append-only; % is not permitted. Write a compensating movement with reverses_movement_id instead.',
        TG_OP;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS "inventory_movements_no_mutate" ON "inventory_movements";
    CREATE TRIGGER "inventory_movements_no_mutate"
      BEFORE UPDATE OR DELETE ON "inventory_movements"
      FOR EACH ROW EXECUTE FUNCTION "inventory_movements_append_only"();
  `);

  await sql.end();
  console.log('🎉 All UUID schema tables, constraints, enums, triggers and indexes created!');
}

main()
  .then(() => {
    console.log('✅ UUID schema application finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
