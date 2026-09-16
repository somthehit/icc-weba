-- 0007: Catalog reference data — the registries every product row depends on.
--
-- A product cannot carry a real category, brand, spec or filter unless those things
-- exist as records first. Three of the four admin "reference data" tabs were backed
-- by nothing at all: the Attributes tab rendered four hardcoded <div>s and the
-- Faceted Filter Tags tab rendered a literal array of nine strings. This migration
-- is what makes those tabs editable rather than decorative.
--
-- The design decision worth naming: specs are currently free text. `product_specs`
-- lets anyone type "Processor", "processor", "CPU" or "Proccesor" on four different
-- products, which is why faceted filtering has never been possible — there is no
-- vocabulary to group by. So:
--
--   attributes              defines a spec ONCE, with a data type and a unit
--   attribute_options       the allowed values, for select-type attributes only
--   attribute_categories    which categories an attribute applies to
--   product_attribute_values  what a given product's value actually is
--
-- `product_specs` is deliberately left in place and untouched. It holds the display
-- spec sheet the storefront PDP already renders, and 146 seeded rows depend on it;
-- ripping it out would be a storefront rewrite dressed up as a migration. The two
-- coexist: `product_specs` is prose for humans, `product_attribute_values` is
-- structured data for filtering.
--
-- Filter tags are kept separate from attributes on purpose. "16GB RAM" is a property
-- of the hardware; "Student Pick" is a merchandising decision someone makes on a
-- Tuesday and reverses on Friday. Same-shaped UI, different data, different
-- lifecycle — folding them into one table would mean every marketing label pretends
-- to be a hardware fact.
--
-- Guarded with IF NOT EXISTS to match 0001-0006: this DB was bootstrapped via
-- `drizzle-kit push`, so migrations are applied directly and must re-run safely.

-- CREATE TYPE has no IF NOT EXISTS in any PostgreSQL version, so the enum gets the
-- same DO-block treatment 0006 gave its foreign keys.
DO $$ BEGIN
  CREATE TYPE "public"."attribute_data_type" AS ENUM('text', 'number', 'boolean', 'select');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- A spec defined once and reused. `unit` is separate from the value so "16" GB and
-- "16" inches are not the same string, and so a numeric filter can compare them.
CREATE TABLE IF NOT EXISTS "attributes" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "slug" varchar(140) NOT NULL,
  "description" varchar(300),
  "data_type" "attribute_data_type" DEFAULT 'text' NOT NULL,
  -- e.g. "GB", "GHz", "MP", "inch". Meaningful for number types; null otherwise.
  "unit" varchar(20),
  -- Whether this attribute is offered as a storefront facet. Not every spec is
  -- worth filtering on — "Box Contents" is a spec nobody browses by.
  "is_filterable" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "attributes_slug_idx" ON "attributes" ("slug");
--> statement-breakpoint

-- The allowed values for a select-type attribute (SSD / HDD / Hybrid). Only
-- select-type attributes have rows here; the API refuses options on the others
-- rather than storing values that can never be chosen.
CREATE TABLE IF NOT EXISTS "attribute_options" (
  "id" serial PRIMARY KEY NOT NULL,
  "attribute_id" integer NOT NULL,
  "value" varchar(120) NOT NULL,
  "slug" varchar(140) NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

-- Unique per attribute, not globally: "Black" is a legitimate option for both
-- Chassis Colour and Keyboard Colour.
CREATE UNIQUE INDEX IF NOT EXISTS "attribute_options_attribute_slug_idx"
  ON "attribute_options" ("attribute_id", "slug");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attribute_options_attribute_idx"
  ON "attribute_options" ("attribute_id");
--> statement-breakpoint

-- Which categories an attribute applies to. A join table rather than a jsonb array
-- of slugs (the shape `brands.category_slugs` uses) because this one is queried in
-- the other direction — "which attributes should the Laptops filter sidebar show?"
-- — and a jsonb containment scan cannot use an index the way this can.
--
-- No rows for an attribute means it applies everywhere, which is the right default
-- for something like "Warranty Type".
CREATE TABLE IF NOT EXISTS "attribute_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "attribute_id" integer NOT NULL,
  "category_id" integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "attribute_categories_pair_idx"
  ON "attribute_categories" ("attribute_id", "category_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attribute_categories_category_idx"
  ON "attribute_categories" ("category_id");
--> statement-breakpoint

-- What a specific product's value for an attribute actually is.
--
-- Two value columns, not one: a select-type value is a foreign key to
-- attribute_options (so renaming "SSD" to "Solid State" updates every product at
-- once, and a typo cannot create a phantom facet), while text/number/boolean values
-- are free-form and live in value_text. The API enforces which one is used based on
-- the attribute's data_type.
CREATE TABLE IF NOT EXISTS "product_attribute_values" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "attribute_id" integer NOT NULL,
  "option_id" integer,
  "value_text" varchar(200)
);
--> statement-breakpoint

-- One value per attribute per product. A laptop has one RAM figure; two rows here
-- would make the facet count that laptop twice.
CREATE UNIQUE INDEX IF NOT EXISTS "product_attribute_values_pair_idx"
  ON "product_attribute_values" ("product_id", "attribute_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_attribute_values_attribute_idx"
  ON "product_attribute_values" ("attribute_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_attribute_values_option_idx"
  ON "product_attribute_values" ("option_id");
--> statement-breakpoint

-- Merchandising labels that cut across categories: "Student Pick", "Hot Deal",
-- "Gaming". Not a hardware property — see the header note on why these are not
-- attributes.
CREATE TABLE IF NOT EXISTS "filter_tags" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(80) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "description" varchar(300),
  -- Tailwind-ish badge tone chosen in the admin UI, so a tag looks the same
  -- everywhere it is rendered instead of each surface picking its own colour.
  "color" varchar(20) DEFAULT 'blue' NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "filter_tags_slug_idx" ON "filter_tags" ("slug");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_filter_tags" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "filter_tag_id" integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "product_filter_tags_pair_idx"
  ON "product_filter_tags" ("product_id", "filter_tag_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_filter_tags_tag_idx"
  ON "product_filter_tags" ("filter_tag_id");
--> statement-breakpoint

-- Foreign keys, added separately and idempotently for the reason 0006 documents:
-- ADD CONSTRAINT has no IF NOT EXISTS, so each is wrapped in a DO block that
-- swallows only the duplicate-object error.

-- cascade: an option belongs to its attribute and has no meaning without it.
DO $$ BEGIN
  ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_fk"
    FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "attribute_categories" ADD CONSTRAINT "attribute_categories_attribute_id_fk"
    FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- cascade: scoping rows are derived data. Deleting a category should drop its
-- scoping links, not block the delete.
DO $$ BEGIN
  ALTER TABLE "attribute_categories" ADD CONSTRAINT "attribute_categories_category_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- cascade: retiring an attribute removes the values recorded against it. Unlike an
-- order line, a spec value is not evidence of anything that happened — it is a
-- current description of a product, and a value whose attribute no longer exists
-- cannot be displayed or filtered on.
DO $$ BEGIN
  ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_fk"
    FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- cascade: deleting an option must not leave products pointing at a value that is
-- gone. The API warns how many products are affected before allowing it.
DO $$ BEGIN
  ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_option_id_fk"
    FOREIGN KEY ("option_id") REFERENCES "attribute_options"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "product_filter_tags" ADD CONSTRAINT "product_filter_tags_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "product_filter_tags" ADD CONSTRAINT "product_filter_tags_filter_tag_id_fk"
    FOREIGN KEY ("filter_tag_id") REFERENCES "filter_tags"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- A select-type value points at an option; every other type puts its value in
-- value_text. Enforced in the database as well as the API, because a row that
-- carries both is ambiguous about which one the storefront should render, and a row
-- carrying neither is an attribute assigned to a product with no value at all.
DO $$ BEGIN
  ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_one_value"
    CHECK (("option_id" IS NULL) <> ("value_text" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- The brands grid wants a curated "featured" set, distinct from is_partner.
-- is_partner is a commercial fact (an authorized dealership); is_featured is a
-- merchandising choice about who appears on the homepage strip. Conflating them
-- meant the admin UI had no way to promote a brand without also claiming a
-- dealership the shop may not hold.
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
