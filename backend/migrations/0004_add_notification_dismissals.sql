-- Migration: Add Notification Dismissals
-- This migration adds a table to track which notifications users have dismissed

CREATE TABLE IF NOT EXISTS "notification_dismissals" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "business_id" integer NOT NULL,
  "notification_id" text NOT NULL,
  "notification_type" text NOT NULL,
  "dismissed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_dismissals_user_business_notification_unique" UNIQUE("user_id", "business_id", "notification_id")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_notification_dismissal_user_business" ON "notification_dismissals" ("user_id", "business_id");
CREATE INDEX IF NOT EXISTS "IDX_notification_dismissal_notification_id" ON "notification_dismissals" ("notification_id");

