-- Add machine image URL to jobs table (for photos taken/uploaded when booking)

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS machine_image_url text;

COMMENT ON COLUMN jobs.machine_image_url IS 'URL of machine/equipment photo taken or uploaded when booking the job';
