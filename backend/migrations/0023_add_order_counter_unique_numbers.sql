-- Order counter table for generating unique sequential order numbers per business
CREATE TABLE IF NOT EXISTS "order_counter" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL UNIQUE,
  "current_number" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Fix any existing duplicate order numbers before adding unique constraint
-- For duplicates, append the order id to make them unique (e.g. ORD-123 becomes ORD-123-456 for order id 456)
WITH duplicates AS (
  SELECT id, business_id, order_number,
    ROW_NUMBER() OVER (PARTITION BY business_id, order_number ORDER BY id) as rn
  FROM orders
)
UPDATE orders o
SET order_number = o.order_number || '-' || o.id
FROM duplicates d
WHERE o.id = d.id AND d.rn > 1;

-- Add unique constraint to prevent duplicate order numbers per business
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_business_order_number_unique" 
  ON "orders" ("business_id", "order_number");
