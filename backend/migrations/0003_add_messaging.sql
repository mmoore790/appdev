-- Migration: Add Messaging System
-- This migration adds messages table for internal business communication

CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL,
  "sender_id" integer NOT NULL,
  "recipient_id" integer,
  "thread_id" integer,
  "content" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  "deleted_at" timestamp,
  "attached_job_id" integer,
  "attached_task_id" integer,
  "attached_image_urls" json
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_message_business_id" ON "messages" ("business_id");
CREATE INDEX IF NOT EXISTS "IDX_message_sender_id" ON "messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "IDX_message_recipient_id" ON "messages" ("recipient_id");
CREATE INDEX IF NOT EXISTS "IDX_message_thread_id" ON "messages" ("thread_id");
CREATE INDEX IF NOT EXISTS "IDX_message_created_at" ON "messages" ("created_at");

-- Add foreign key constraints (optional, but good practice)
-- Note: We're not adding foreign keys to jobs/tasks to allow flexibility
-- but we ensure business_id matches for all related entities

