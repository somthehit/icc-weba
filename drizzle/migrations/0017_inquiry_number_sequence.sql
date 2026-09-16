-- 0002_inquiry_number_sequence.sql
--
-- Makes `contact_inquiries.inquiry_number` self-generating and collision-free.
--
-- It was built in application code as:
--   `INQ-${year}-${String(Date.now()).slice(-3)}`
-- A 3-digit suffix against the UNIQUE index `contact_inquiries_number_idx` gives
-- only 1000 possible values per year, so by the birthday bound two inquiries
-- collide with ~50% probability after roughly 40 submissions. A collision raises
-- 23505, and because the route had no error handling that surfaced as an
-- empty-bodied 500 — the same symptom as the missing table.
--
-- Moving generation into a column DEFAULT backed by a sequence makes it atomic:
-- concurrent inserts cannot receive the same value, and the app no longer has to
-- think about it.

CREATE SEQUENCE IF NOT EXISTS "contact_inquiry_number_seq" AS bigint START 1;

-- Keep the sequence ahead of anything already stored, so enabling this on a
-- table that already has rows cannot immediately collide with them.
SELECT setval(
  'contact_inquiry_number_seq',
  GREATEST(
    (SELECT COALESCE(MAX(id), 0) FROM "contact_inquiries"),
    (SELECT last_value FROM "contact_inquiry_number_seq")
  )
);

ALTER TABLE "contact_inquiries"
  ALTER COLUMN "inquiry_number"
  SET DEFAULT 'INQ-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('contact_inquiry_number_seq')::text, 6, '0');
