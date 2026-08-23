# ICE Computers & Electronics — Drizzle Schema

14 files, organized by domain. Drop this folder into your project (e.g. `src/db/schema/`)
and import everything through `index.ts`.

## Install

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit
```

## drizzle.config.ts (place at project root)

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Generate & run migrations

```bash
npx drizzle-kit generate   # writes SQL migration files from the schema
npx drizzle-kit migrate    # applies them to your Postgres database
```

## db client (example)

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

## What still needs app-layer logic (schema can't enforce this alone)

- **Nepali phone format** — validate `98XXXXXXXX` / `97XXXXXXXX` pattern with Zod before insert.
- **Rating range** — `reviews.rating` is a plain integer; clamp 1–5 in your Zod schema.
- **Inventory reservation** — increment `quantity_reserved` when an order is placed with
  `pending`/`confirmed` status, release it back on cancellation, and decrement
  `quantity_on_hand` only once `status = 'delivered'` or payment is confirmed for COD.
- **Low-stock alerts** — a scheduled job or DB trigger comparing `quantity_on_hand <=
  low_stock_threshold` per row, firing into `notification_preferences`.
- **Secret encryption** — `payment_method_settings.secret_key_encrypted` expects an
  already-encrypted string (e.g. via `pgcrypto` or app-layer AES) — never store eSewa/Khalti
  secrets in plaintext.
- **Single-row tables** — `store_profile` is designed to hold exactly one row; enforce that
  in your seed script / application logic (a partial unique index on a constant expression
  also works if you want the DB to enforce it).

## Suggested next steps

1. `drizzle-zod` — auto-generate Zod validation schemas from these tables for your
   Express/Next.js API routes.
2. A seed script for `warehouses` (e.g. "Kathmandu Warehouse"), `delivery_zones`
   (Kathmandu Valley / Terai / Hill), and `payment_method_settings` rows (cod, esewa,
   khalti, bank_transfer — all starting `is_enabled: false` until configured).
3. Wire `order_status_history` inserts into whatever service transitions `orders.status`,
   so the admin console's audit trail is never manually maintained.
