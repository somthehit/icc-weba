// db/index.ts
// Drizzle database client (PostgreSQL via node-postgres / `pg`).

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your .env file (see .env.example) before starting the app.',
  );
}

/**
 * One pool per process, cached on `globalThis`.
 *
 * `drizzle(connectionString)` builds its own `pg.Pool`, and this module sits at
 * the bottom of nearly every server module graph. In `next dev` each HMR reload
 * re-evaluates the module and, without this cache, leaks another pool that is
 * never drained — after a dozen edits the process is holding far more server-side
 * connections than it is using. `DATABASE_URL` here points at Supabase's
 * transaction pooler, which has a hard client limit, so the leak surfaces as
 * `Connection terminated due to connection timeout` on unrelated queries.
 *
 * Production evaluates the module once, so the cache is a no-op there.
 */
const globalForDb = globalThis as unknown as {
  __iceDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

export const db =
  globalForDb.__iceDrizzle ?? drizzle(connectionString, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__iceDrizzle = db;
}

export type Database = typeof db;
