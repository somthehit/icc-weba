# Requirements Document

## Introduction

The icc-eweb Next.js 15 application currently has two conflicting Drizzle ORM database client files — `lib/db.ts` (using `drizzle-orm/postgres-js` + the minimal `drizzle/schema.ts`) and `db/index.ts` (using `drizzle-orm/node-postgres` + the full `schema/catalog.ts`). The `drizzle.config.ts` migration tool only points at the minimal schema, meaning catalog tables are never migrated. This consolidation removes the split by designating a single authoritative client, a single canonical schema location, and ensuring every file in the app imports from them. Firebase authentication is unaffected and must not be changed.

## Glossary

- **DB_Client**: The single, authoritative Drizzle ORM database client exported from `db/index.ts`.
- **Catalog_Schema**: The full product-catalog schema defined in `schema/catalog.ts`, containing brands, categories, products, productImages, attributes, productAttributeValues, tags, productTags, offers, offerProducts, offerCategories, offerBrands, and coupons.
- **Legacy_Client**: The obsolete `lib/db.ts` file that uses `drizzle-orm/postgres-js` and the minimal `drizzle/schema.ts`.
- **Minimal_Schema**: The `drizzle/schema.ts` file containing only the `users` table.
- **Drizzle_Config**: The `drizzle.config.ts` file used by `drizzle-kit` for migrations and schema introspection.
- **Supabase**: The hosted PostgreSQL database (project ref: enqarkwsxzdhskzpllpr, AWS ap-southeast-2, transaction-mode pooler on port 6543).
- **Transaction_Pool**: The Supabase connection pooler running in transaction mode, which does not support prepared statements.
- **offerService**: `services/offerService.ts` — the primary service layer that queries offers, offerProducts, and products tables.
- **offerUtils**: `lib/offers/offerUtils.ts` — utility functions consumed by offerService.
- **Offers_API**: The Next.js API route at `app/api/offers/route.ts`.

---

## Requirements

### Requirement 1: Single Authoritative Database Client

**User Story:** As a developer, I want a single database client file to be the one source of truth, so that there is no ambiguity about which client or schema is active at runtime.

#### Acceptance Criteria

1. THE DB_Client SHALL be exported exclusively from `db/index.ts`.
2. THE DB_Client SHALL be initialised using `drizzle-orm/node-postgres` and the `pg` package.
3. THE DB_Client SHALL be instantiated with the `Catalog_Schema` passed as the schema option so that Drizzle's relational query API is available.
4. WHEN `DATABASE_URL` is not defined in the environment, THE DB_Client SHALL throw a descriptive startup error that prevents the application from starting, rather than silently returning a mock object.
5. THE Legacy_Client file `lib/db.ts` SHALL be removed from the repository.

---

### Requirement 2: Supabase Transaction-Pool Compatibility

**User Story:** As a developer, I want the database client configured correctly for Supabase's transaction-mode pooler, so that connections succeed and queries run without prepared-statement errors.

#### Acceptance Criteria

1. WHEN connecting to Supabase via the transaction-mode pooler on port 6543, THE DB_Client SHALL disable prepared statements (`prepare: false` equivalent for `node-postgres`) regardless of whether the connection attempt succeeds.
2. THE DB_Client SHALL read the connection string exclusively from the `DATABASE_URL` environment variable.
3. IF `DATABASE_URL` is absent at module load time, THEN THE DB_Client SHALL throw an `Error` with the message `"DATABASE_URL environment variable is not set"`.

---

### Requirement 3: Canonical Schema Location

**User Story:** As a developer, I want a single canonical schema file, so that all tables are defined in one place and migrations cover the full catalog.

#### Acceptance Criteria

1. THE Catalog_Schema file `schema/catalog.ts` SHALL be the sole schema source used by the DB_Client.
2. THE Minimal_Schema file `drizzle/schema.ts` SHALL be removed from the repository after any `users` table definitions it contains are evaluated for migration into the Catalog_Schema or deprecated.
3. THE Catalog_Schema SHALL export all tables required by offerService: `offers`, `offerProducts`, `products`, `brands`, `categories`, `coupons`, `offerCategories`, and `offerBrands`.

---

### Requirement 4: Drizzle Config Points at Catalog Schema

**User Story:** As a developer, I want `drizzle.config.ts` to reference the full catalog schema, so that `drizzle-kit generate` and `drizzle-kit migrate` produce migrations that include all catalog tables.

#### Acceptance Criteria

1. THE Drizzle_Config SHALL set the `schema` field to `"./schema/catalog.ts"`.
2. THE Drizzle_Config SHALL set the `out` field to `"./drizzle/migrations"` so generated migration files are preserved in the existing output directory.
3. THE Drizzle_Config SHALL set `dialect` to `"postgresql"` and `dbCredentials.url` to `process.env.DATABASE_URL`.
4. WHEN `drizzle-kit generate` is executed after the config change, THE Drizzle_Config SHALL produce migration SQL that includes DDL for all tables defined in Catalog_Schema.

---

### Requirement 5: Unified Import Path Across the Application

**User Story:** As a developer, I want every file in the application to import the database client from the same path, so that refactoring one file does not silently leave stale imports.

#### Acceptance Criteria

1. THE offerService SHALL import `db` from `"../db"` (i.e. `db/index.ts`).
2. WHEN database interaction is needed, THE Offers_API SHALL interact with the database exclusively through offerService functions and SHALL NOT import any database client directly.
3. THE offerUtils SHALL import `db` from `"../../db"` if it requires direct database access, otherwise it SHALL remain a pure utility module with no database import.
4. WHEN any view component in the `views/` directory requires catalog data, THE view component SHALL import `db` from `"@/db"` and Catalog_Schema tables from `"@/schema/catalog"`.
5. THE codebase SHALL contain zero import statements referencing `"../lib/db"`, `"@/lib/db"`, or `"../../lib/db"` after consolidation.

---

### Requirement 6: Preserve Firebase Authentication Setup

**User Story:** As a developer, I want the Firebase authentication configuration left completely unchanged, so that user sign-in and session management continue to work without any disruption.

#### Acceptance Criteria

1. THE system SHALL NOT modify `lib/firebase.ts` or any Firebase-related configuration files (`firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`).
2. THE system SHALL NOT modify any component or context file that imports from `lib/firebase.ts` (e.g. `components/AuthModal.tsx`, `context/StoreContext.tsx`).
3. WHILE Firebase authentication is active, THE DB_Client SHALL coexist with the Firebase client without namespace conflicts or shared environment variable collisions, regardless of whether technical conflicts exist.

---

### Requirement 7: No Mock Fallback in Production Code

**User Story:** As a developer, I want the database client to fail fast when misconfigured, so that missing environment variables are caught at startup rather than producing silent data failures at runtime.

#### Acceptance Criteria

1. THE DB_Client SHALL NOT contain any mock or stub fallback object that silently returns empty results when `DATABASE_URL` is absent.
2. IF `DATABASE_URL` is absent, THEN THE DB_Client SHALL fail at module initialisation time with a thrown `Error` that prevents the entire application from starting.
3. THE system SHALL support a `.env.example` file that documents the required `DATABASE_URL` variable format for Supabase transaction-pool connections (`postgresql://user:password@host:6543/database?pgbouncer=true`).

---

### Requirement 8: Type-Safe Schema Exports

**User Story:** As a developer, I want the Catalog_Schema to export inferred TypeScript types alongside table definitions, so that service and API layers benefit from compile-time type checking.

#### Acceptance Criteria

1. THE Catalog_Schema SHALL export inferred insert and select types for `products`, `offers`, `offerProducts`, `brands`, `categories`, and `coupons` using Drizzle's `InferInsertModel` and `InferSelectModel` (or equivalent `$inferInsert` / `$inferSelect`).
2. WHEN a service function inserts a row into `offers`, THE TypeScript compiler SHALL enforce that all `notNull` columns without defaults are provided.
3. THE Catalog_Schema SHALL define all enum types (`productStatusEnum`, `stockStatusEnum`, `discountTypeEnum`, `offerScopeEnum`, `attributeTypeEnum`) before the tables that reference them, preserving the existing declaration order.
