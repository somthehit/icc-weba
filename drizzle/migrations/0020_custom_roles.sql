-- 0005_custom_roles.sql
--
-- Dynamic access roles plus their staff assignments.
--
-- The five `is_system = true` rows mirror the `staff_role` enum. They are seeded
-- so the Roles tab shows a complete picture rather than an empty grid, and their
-- matrices are written to match what `middleware.ts` and the `withRole` guards
-- actually grant today. The API refuses to edit or delete them, because their real
-- behaviour is compiled into the middleware — an editable row would only be able
-- to disagree with it.

CREATE TABLE IF NOT EXISTS "custom_roles" (
  "id" serial PRIMARY KEY NOT NULL,
  "role_name" varchar(80) NOT NULL,
  "role_slug" varchar(60) NOT NULL,
  "description" text,
  "icon" varchar(16) DEFAULT '🛡️' NOT NULL,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_roles_slug_idx" ON "custom_roles" ("role_slug");
CREATE INDEX IF NOT EXISTS "custom_roles_system_idx" ON "custom_roles" ("is_system");

CREATE TABLE IF NOT EXISTS "staff_role_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- RESTRICT, not CASCADE: removing a role must not silently strip access from
  -- whoever holds it. The API checks this first and returns a clear 409.
  "custom_role_id" integer NOT NULL REFERENCES "custom_roles"("id") ON DELETE RESTRICT,
  "assigned_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_role_assignments_user_idx"
  ON "staff_role_assignments" ("user_id");
CREATE INDEX IF NOT EXISTS "staff_role_assignments_role_idx"
  ON "staff_role_assignments" ("custom_role_id");

-- ------------------------------------------------------------- system roles
-- ON CONFLICT keeps this re-runnable without clobbering an operator's edits to
-- the description/icon of a system row.
INSERT INTO "custom_roles" ("role_name", "role_slug", "description", "icon", "is_system", "permissions")
VALUES
  (
    'Super Admin', 'super-admin',
    'Unrestricted access to every module, including staff and role management.',
    '🛡️', true,
    '{"catalog":{"read":true,"write":true,"delete":true},
      "orders":{"read":true,"write":true,"delete":true},
      "inquiries":{"read":true,"write":true,"delete":true},
      "services":{"read":true,"write":true,"delete":true},
      "content":{"read":true,"write":true,"delete":true},
      "users":{"read":true,"write":true,"delete":true}}'::jsonb
  ),
  (
    'Store Manager', 'store-manager',
    'Runs day-to-day operations across catalogue, orders and inventory.',
    '💼', true,
    '{"catalog":{"read":true,"write":true,"delete":false},
      "orders":{"read":true,"write":true,"delete":false},
      "inquiries":{"read":true,"write":true,"delete":false},
      "services":{"read":true,"write":true,"delete":false},
      "content":{"read":true,"write":false,"delete":false},
      "users":{"read":true,"write":false,"delete":false}}'::jsonb
  ),
  (
    'Sales Agent', 'sales-agent',
    'Handles customer orders, quotations and inbound inquiries.',
    '🧾', true,
    '{"catalog":{"read":true,"write":true,"delete":false},
      "orders":{"read":true,"write":true,"delete":false},
      "inquiries":{"read":true,"write":true,"delete":false},
      "services":{"read":true,"write":false,"delete":false},
      "content":{"read":false,"write":false,"delete":false},
      "users":{"read":false,"write":false,"delete":false}}'::jsonb
  ),
  (
    'Service Technician', 'service-technician',
    'Works repair and diagnostic tickets through to resolution.',
    '🛠️', true,
    '{"catalog":{"read":true,"write":false,"delete":false},
      "orders":{"read":true,"write":false,"delete":false},
      "inquiries":{"read":true,"write":false,"delete":false},
      "services":{"read":true,"write":true,"delete":false},
      "content":{"read":false,"write":false,"delete":false},
      "users":{"read":false,"write":false,"delete":false}}'::jsonb
  ),
  (
    'Delivery Driver', 'delivery-driver',
    'Sees assigned deliveries and updates shipment status on the road.',
    '🚚', true,
    '{"catalog":{"read":false,"write":false,"delete":false},
      "orders":{"read":true,"write":true,"delete":false},
      "inquiries":{"read":false,"write":false,"delete":false},
      "services":{"read":false,"write":false,"delete":false},
      "content":{"read":false,"write":false,"delete":false},
      "users":{"read":false,"write":false,"delete":false}}'::jsonb
  )
ON CONFLICT ("role_slug") DO NOTHING;
