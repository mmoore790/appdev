-- Add password_reset_codes table for password reset functionality

CREATE TABLE IF NOT EXISTS "password_reset_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "business_id" integer NOT NULL,
  "code" text NOT NULL,
  "email" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "IDX_password_reset_code" ON "password_reset_codes" ("code");
CREATE INDEX IF NOT EXISTS "IDX_password_reset_user_id" ON "password_reset_codes" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_password_reset_email" ON "password_reset_codes" ("email");

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'password_reset_codes_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "password_reset_codes" 
    ADD CONSTRAINT "password_reset_codes_user_id_users_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'password_reset_codes_business_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "password_reset_codes" 
    ADD CONSTRAINT "password_reset_codes_business_id_businesses_id_fk" 
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
  END IF;
END $$;


