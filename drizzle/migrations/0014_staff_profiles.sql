DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delivery_driver';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('SUPER_ADMIN', 'STORE_MANAGER', 'SALES_AGENT', 'SERVICE_TECHNICIAN', 'DELIVERY_DRIVER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shift_status AS ENUM ('ON_DUTY', 'ON_TRANSIT', 'OFF_DUTY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff_profiles (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  staff_role staff_role NOT NULL,
  department varchar(120),
  skills text[] NOT NULL DEFAULT '{}',
  specialization varchar(180),
  vehicle_number varchar(40),
  driving_license_no varchar(60),
  shift_status shift_status NOT NULL DEFAULT 'OFF_DUTY',
  assigned_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_profiles_role_idx ON staff_profiles(staff_role);
