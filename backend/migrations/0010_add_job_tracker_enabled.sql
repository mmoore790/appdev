-- Add job_tracker_enabled feature flag to businesses table
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS job_tracker_enabled BOOLEAN NOT NULL DEFAULT true;
