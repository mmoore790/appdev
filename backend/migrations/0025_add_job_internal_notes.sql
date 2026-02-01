-- Internal job notes - multiple timestamped notes per job with author
CREATE TABLE IF NOT EXISTS "job_internal_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL,
  "job_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "note_text" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_job_internal_notes_job_id" ON "job_internal_notes" ("job_id", "business_id");
