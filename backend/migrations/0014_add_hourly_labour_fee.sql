-- Add hourly labour fee field to businesses table

ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "hourly_labour_fee" integer;







