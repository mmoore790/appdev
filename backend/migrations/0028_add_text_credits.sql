-- Add text credits to businesses table (set by master when creating/editing business)

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS text_credits integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN businesses.text_credits IS 'Number of text/SMS credits allocated to the business. Default 0.';
