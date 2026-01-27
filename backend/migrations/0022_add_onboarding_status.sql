-- Migration: Add Onboarding Status Tracking
-- This migration adds fields to track user onboarding progress

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_welcome_dismissed_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_setup_completed_at" timestamp;

-- Add onboarding checklist progress (stored as JSON)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_checklist" jsonb DEFAULT '{}'::jsonb;

