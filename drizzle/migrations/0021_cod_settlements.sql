-- 0021_cod_settlements.sql
--
-- COD driver cash settlements, plus the two things they need:
--   * a transit account to clear the cash out of
--   * an attachment column on journal_entries for the deposit slip
--
-- Prerequisite: 0015_double_entry_accounting.sql. That file existed but had never
-- been applied, so `accounts`, `journal_entries` and `journal_lines` were missing
-- from the database entirely and GET /api/accounting failed with 42P01 — which the
-- console surfaced as "Unable to load accounting ledger".

ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "attachment_url" varchar(500);

-- ------------------------------------------------------------------ accounts
-- 1250 is the clearing account COD settlement moves money out of: cash is
-- recognised against it at delivery, and this settlement debits the bank and
-- credits 1250 back down to zero. Without it the double entry has nowhere to go.
INSERT INTO "accounts" ("code", "name", "type") VALUES
  ('1250', 'Cash in Transit (Driver)', 'asset'),
  ('1020', 'Bank - Nabil Primary',     'asset'),
  ('1030', 'Bank - Global IME',        'asset'),
  ('1040', 'Shop Vault Cash',          'asset')
ON CONFLICT ("code") DO NOTHING;

-- --------------------------------------------------------- settlement numbers
CREATE SEQUENCE IF NOT EXISTS "cod_settlement_number_seq" AS bigint START 1;

-- ---------------------------------------------------------- cod_settlements
CREATE TABLE IF NOT EXISTS "cod_settlements" (
  "id" serial PRIMARY KEY NOT NULL,
  "settlement_number" varchar(40) NOT NULL
    DEFAULT 'COD-' || to_char(now(), 'YYYY') || '-' ||
            lpad(nextval('cod_settlement_number_seq')::text, 6, '0'),
  "driver_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "driver_name" varchar(150) NOT NULL,
  "order_reference" varchar(60),
  "collected_amount" numeric(14, 2) NOT NULL CHECK ("collected_amount" > 0),
  "deposit_account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  "bank_reference" varchar(80),
  "attachment_url" varchar(500),
  -- RESTRICT: a settlement must never outlive the journal entry that records it,
  -- or the books would show banked cash with no ledger effect.
  "journal_entry_id" integer NOT NULL REFERENCES "journal_entries"("id") ON DELETE RESTRICT,
  "notes" text,
  "settled_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "settled_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "cod_settlements_number_idx"
  ON "cod_settlements" ("settlement_number");
CREATE INDEX IF NOT EXISTS "cod_settlements_driver_idx"
  ON "cod_settlements" ("driver_user_id");
CREATE INDEX IF NOT EXISTS "cod_settlements_settled_idx"
  ON "cod_settlements" ("settled_at");
