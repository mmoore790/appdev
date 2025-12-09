-- Add VAT cost fields to labour_entries and parts_used tables

-- Add cost fields to labour_entries
ALTER TABLE "labour_entries" ADD COLUMN IF NOT EXISTS "cost_excluding_vat" integer;
ALTER TABLE "labour_entries" ADD COLUMN IF NOT EXISTS "cost_including_vat" integer;

-- Migrate existing cost data to cost_excluding_vat
UPDATE "labour_entries" 
SET "cost_excluding_vat" = "cost" 
WHERE "cost" IS NOT NULL AND "cost_excluding_vat" IS NULL;

-- Add cost fields to parts_used
ALTER TABLE "parts_used" ADD COLUMN IF NOT EXISTS "cost_excluding_vat" integer;
ALTER TABLE "parts_used" ADD COLUMN IF NOT EXISTS "cost_including_vat" integer;

-- Migrate existing cost data to cost_excluding_vat
UPDATE "parts_used" 
SET "cost_excluding_vat" = "cost" 
WHERE "cost" IS NOT NULL AND "cost_excluding_vat" IS NULL;

