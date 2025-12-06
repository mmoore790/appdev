-- Migration: Add Getting Started Dismissal
-- This migration adds support for tracking when users dismiss the getting started page

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "getting_started_dismissed_at" timestamp;

