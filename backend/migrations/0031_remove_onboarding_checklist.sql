-- Remove legacy onboarding checklist state (no longer used by frontend/backend)
ALTER TABLE "users" DROP COLUMN IF EXISTS "onboarding_checklist";
