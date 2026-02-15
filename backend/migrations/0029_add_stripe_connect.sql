-- Stripe Connect (optional per-business): store Express connected account id and status
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_account_id" text;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_account_status" text;
