-- Add VAT price fields to order_items table

-- Add price fields to order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "price_excluding_vat" integer;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "price_including_vat" integer;

-- Migrate existing unit_price data to price_excluding_vat
UPDATE "order_items" 
SET "price_excluding_vat" = "unit_price" 
WHERE "unit_price" IS NOT NULL AND "price_excluding_vat" IS NULL;

-- Calculate price_including_vat from price_excluding_vat (20% VAT)
UPDATE "order_items" 
SET "price_including_vat" = ROUND("price_excluding_vat" * 1.20)
WHERE "price_excluding_vat" IS NOT NULL AND "price_including_vat" IS NULL;
