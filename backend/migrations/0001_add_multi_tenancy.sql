-- Migration: Add Multi-Tenancy Support
-- This migration adds businesses table and businessId columns to all relevant tables

-- Step 1: Create businesses table
CREATE TABLE IF NOT EXISTS "businesses" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "address" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  "is_active" boolean DEFAULT true NOT NULL
);

-- Step 2: Create a default business for existing data
INSERT INTO "businesses" ("name", "email", "is_active", "created_at")
VALUES ('Default Business', NULL, true, now())
ON CONFLICT DO NOTHING;

-- Get the default business ID (assuming it's 1, but we'll query it)
DO $$
DECLARE
  default_business_id INTEGER;
BEGIN
  SELECT id INTO default_business_id FROM "businesses" WHERE "name" = 'Default Business' LIMIT 1;
  
  IF default_business_id IS NULL THEN
    INSERT INTO "businesses" ("name", "email", "is_active", "created_at")
    VALUES ('Default Business', NULL, true, now())
    RETURNING id INTO default_business_id;
  END IF;

  -- Step 3: Add businessId columns to all tables (if they don't exist)
  
  -- Add to job_counter
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_counter' AND column_name = 'business_id') THEN
    ALTER TABLE "job_counter" ADD COLUMN "business_id" integer;
    UPDATE "job_counter" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "job_counter" ALTER COLUMN "business_id" SET NOT NULL;
    ALTER TABLE "job_counter" ADD CONSTRAINT "job_counter_business_id_unique" UNIQUE("business_id");
  END IF;

  -- Add to users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'business_id') THEN
    ALTER TABLE "users" ADD COLUMN "business_id" integer;
    UPDATE "users" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "users" ALTER COLUMN "business_id" SET NOT NULL;
    CREATE INDEX IF NOT EXISTS "IDX_user_username_business" ON "users"("username", "business_id");
  END IF;

  -- Add to customers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'business_id') THEN
    ALTER TABLE "customers" ADD COLUMN "business_id" integer;
    UPDATE "customers" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "customers" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to equipment
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment' AND column_name = 'business_id') THEN
    ALTER TABLE "equipment" ADD COLUMN "business_id" integer;
    UPDATE "equipment" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "equipment" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to jobs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'business_id') THEN
    ALTER TABLE "jobs" ADD COLUMN "business_id" integer;
    UPDATE "jobs" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "jobs" ALTER COLUMN "business_id" SET NOT NULL;
    CREATE INDEX IF NOT EXISTS "IDX_job_jobid_business" ON "jobs"("job_id", "business_id");
  END IF;

  -- Add to services
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'business_id') THEN
    ALTER TABLE "services" ADD COLUMN "business_id" integer;
    UPDATE "services" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "services" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to tasks
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'business_id') THEN
    ALTER TABLE "tasks" ADD COLUMN "business_id" integer;
    UPDATE "tasks" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "tasks" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to callback_requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'callback_requests' AND column_name = 'business_id') THEN
    ALTER TABLE "callback_requests" ADD COLUMN "business_id" integer;
    UPDATE "callback_requests" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "callback_requests" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to job_updates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_updates' AND column_name = 'business_id') THEN
    ALTER TABLE "job_updates" ADD COLUMN "business_id" integer;
    UPDATE "job_updates" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "job_updates" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to activities
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'business_id') THEN
    ALTER TABLE "activities" ADD COLUMN "business_id" integer;
    UPDATE "activities" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "activities" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to work_completed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_completed' AND column_name = 'business_id') THEN
    ALTER TABLE "work_completed" ADD COLUMN "business_id" integer;
    UPDATE "work_completed" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "work_completed" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to payment_requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'business_id') THEN
    ALTER TABLE "payment_requests" ADD COLUMN "business_id" integer;
    UPDATE "payment_requests" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "payment_requests" ALTER COLUMN "business_id" SET NOT NULL;
    CREATE INDEX IF NOT EXISTS "IDX_payment_checkout_business" ON "payment_requests"("checkout_reference", "business_id");
  END IF;

  -- Add to parts_on_order
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parts_on_order' AND column_name = 'business_id') THEN
    ALTER TABLE "parts_on_order" ADD COLUMN "business_id" integer;
    UPDATE "parts_on_order" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "parts_on_order" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to part_order_updates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'part_order_updates' AND column_name = 'business_id') THEN
    ALTER TABLE "part_order_updates" ADD COLUMN "business_id" integer;
    UPDATE "part_order_updates" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "part_order_updates" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to time_entries
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'business_id') THEN
    ALTER TABLE "time_entries" ADD COLUMN "business_id" integer;
    UPDATE "time_entries" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
    ALTER TABLE "time_entries" ALTER COLUMN "business_id" SET NOT NULL;
  END IF;

  -- Add to registration_requests (if it exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'registration_requests') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registration_requests' AND column_name = 'business_id') THEN
      ALTER TABLE "registration_requests" ADD COLUMN "business_id" integer;
      UPDATE "registration_requests" SET "business_id" = default_business_id WHERE "business_id" IS NULL;
      ALTER TABLE "registration_requests" ALTER COLUMN "business_id" SET NOT NULL;
      CREATE INDEX IF NOT EXISTS "IDX_registration_username_business" ON "registration_requests"("username", "business_id");
    END IF;
  END IF;

END $$;

-- Step 4: Add foreign key constraints (optional, but recommended for data integrity)
-- Note: These are commented out as they may fail if there are orphaned records
-- Uncomment and run separately if you want to enforce referential integrity

-- ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "equipment" ADD CONSTRAINT "equipment_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "jobs" ADD CONSTRAINT "jobs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "tasks" ADD CONSTRAINT "tasks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "job_updates" ADD CONSTRAINT "job_updates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "activities" ADD CONSTRAINT "activities_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "work_completed" ADD CONSTRAINT "work_completed_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "parts_on_order" ADD CONSTRAINT "parts_on_order_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "part_order_updates" ADD CONSTRAINT "part_order_updates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "job_counter" ADD CONSTRAINT "job_counter_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

