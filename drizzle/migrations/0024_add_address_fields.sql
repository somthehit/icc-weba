-- Migration: Add extended address fields for Nepal delivery addresses
-- Adds tole, house_number, postal_code, delivery_instructions, and lat/lng for future map integration

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS tole varchar(255);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS house_number varchar(50);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS postal_code varchar(10);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS delivery_instructions text;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude numeric(9, 6);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude numeric(9, 6);
