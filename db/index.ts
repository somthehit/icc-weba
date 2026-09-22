// db/index.ts
// Drizzle database client (PostgreSQL via node-postgres / `pg`).

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

/**
 * One pool per process, cached on `globalThis`.
 *
 * `drizzle(connectionString)` builds its own `pg.Pool`, and this module sits at
 * the bottom of nearly every server module graph. In `next dev` each HMR reload
 * re-evaluates the module and, without this cache, leaks another pool that is
 * never drained.
 */
const globalForDb = globalThis as unknown as {
  __iceDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

function getDb(): ReturnType<typeof drizzle<typeof schema>> | null {
  if (globalForDb.__iceDrizzle) return globalForDb.__iceDrizzle;
  if (!connectionString) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('DATABASE_URL is not set. Database operations will fail gracefully.');
    }
    return null;
  }
  try {
    const client = drizzle(connectionString, { schema });
    if (process.env.NODE_ENV !== 'production') {
      globalForDb.__iceDrizzle = client;
    }
    return client;
  } catch (err) {
    console.error('Failed to initialize Drizzle database client:', err);
    return null;
  }
}

export const isDbConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const client = getDb();
    if (!client) {
      throw new Error(
        'DATABASE_URL is not configured or reachable. Please verify your environment variables.',
      );
    }
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;

