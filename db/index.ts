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

// Passing the connection string lets node-postgres manage its own pool.
export const db = drizzle(connectionString, { schema });

export type Database = typeof db;
