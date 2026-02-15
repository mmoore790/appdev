-- Job payments: multiple transactions per job (e.g. deposit via Stripe, balance via Cash)
-- balance_remaining = job total cost (from labour + parts) - sum(payments.amount); computed in API
CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY,
  "business_id" integer NOT NULL,
  "job_id" integer NOT NULL,
  "amount" integer NOT NULL,
  "payment_method" text NOT NULL,
  "stripe_receipt_url" text,
  "stripe_payment_intent_id" text,
  "payment_request_id" integer,
  "recorded_by" integer,
  "paid_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_payments_job_id" ON "payments"("job_id");
CREATE INDEX IF NOT EXISTS "IDX_payments_business_id" ON "payments"("business_id");
