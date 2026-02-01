-- Add subscription tier and user limit to businesses table (set during master onboarding)

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_tier text,
  ADD COLUMN IF NOT EXISTS user_limit integer;

COMMENT ON COLUMN businesses.subscription_tier IS 'Plan name: Starter, Pro, or Pro Plus';
COMMENT ON COLUMN businesses.user_limit IS 'Maximum number of users allowed on the account';
