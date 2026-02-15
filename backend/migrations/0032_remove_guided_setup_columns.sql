-- Remove legacy guided setup popup state columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "onboarding_welcome_dismissed_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "onboarding_setup_completed_at";
