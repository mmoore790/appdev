-- Add subscriptions table for tracking subscription purchases

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "stripe_subscription_id" text,
  "stripe_customer_id" text,
  "business_id" integer,
  "plan_name" text,
  "status" text NOT NULL DEFAULT 'pending',
  "email" text NOT NULL,
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  "account_created" boolean DEFAULT false NOT NULL
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "IDX_subscriptions_email" ON "subscriptions" ("email");
CREATE INDEX IF NOT EXISTS "IDX_subscriptions_stripe_customer_id" ON "subscriptions" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "IDX_subscriptions_stripe_subscription_id" ON "subscriptions" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "IDX_subscriptions_business_id" ON "subscriptions" ("business_id");

-- Add foreign key constraint for business_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'subscriptions_business_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "subscriptions" 
    ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" 
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL;
  END IF;
END $$;
