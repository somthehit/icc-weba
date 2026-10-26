import 'dotenv/config';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function check() {
  const userRows = await db.execute(sql`SELECT id, email, role FROM users LIMIT 5;`);
  console.log('User rows:', (userRows as any).rows);

  const colTypes = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name IN ('id', 'role');
  `);
  console.log('User column types:', (colTypes as any).rows);
}

check().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
