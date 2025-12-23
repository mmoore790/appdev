-- Add job sheet tables for structured work completed tracking

-- Labour Entries table
CREATE TABLE IF NOT EXISTS "labour_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"technician_id" integer NOT NULL,
	"description" text NOT NULL,
	"time_spent" integer NOT NULL,
	"cost" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Parts Used table
CREATE TABLE IF NOT EXISTS "parts_used" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"part_name" text NOT NULL,
	"sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"cost" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Job Notes table
CREATE TABLE IF NOT EXISTS "job_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"job_id" integer NOT NULL UNIQUE,
	"work_summary" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Job Attachments table
CREATE TABLE IF NOT EXISTS "job_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"file_size" integer,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_labour_entries_job_id" ON "labour_entries" ("job_id", "business_id");
CREATE INDEX IF NOT EXISTS "idx_parts_used_job_id" ON "parts_used" ("job_id", "business_id");
CREATE INDEX IF NOT EXISTS "idx_job_notes_job_id" ON "job_notes" ("job_id", "business_id");
CREATE INDEX IF NOT EXISTS "idx_job_attachments_job_id" ON "job_attachments" ("job_id", "business_id");







