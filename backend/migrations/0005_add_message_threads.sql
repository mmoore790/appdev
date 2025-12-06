-- Migration: Add Message Threads for Group Conversations
-- This migration adds support for group conversations

-- Create message_threads table to track group conversations
CREATE TABLE IF NOT EXISTS "message_threads" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL,
  "name" text,
  "created_by" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp
);

-- Create message_thread_participants table to track who's in each thread
CREATE TABLE IF NOT EXISTS "message_thread_participants" (
  "id" serial PRIMARY KEY NOT NULL,
  "thread_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "left_at" timestamp,
  UNIQUE("thread_id", "user_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IDX_thread_business_id" ON "message_threads" ("business_id");
CREATE INDEX IF NOT EXISTS "IDX_thread_participant_thread_id" ON "message_thread_participants" ("thread_id");
CREATE INDEX IF NOT EXISTS "IDX_thread_participant_user_id" ON "message_thread_participants" ("user_id");

