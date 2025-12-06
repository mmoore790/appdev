-- Add customer_name, customer_email and customer_phone columns to jobs table
-- These fields allow storing contact info with jobs even when customer profile is not saved

DO $$ 
BEGIN
  -- Add customer_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN "customer_name" text;
  END IF;

  -- Add customer_email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN "customer_email" text;
  END IF;

  -- Add customer_phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN "customer_phone" text;
  END IF;
END $$;

