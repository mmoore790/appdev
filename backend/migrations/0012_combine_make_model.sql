-- Combine make and model columns into a single make_model column
-- First, add the new column
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS make_model TEXT;

-- Migrate existing data: combine make and model where they exist
UPDATE equipment
SET make_model = CASE
  WHEN make IS NOT NULL AND make != '' AND model IS NOT NULL AND model != ''
    THEN make || ' ' || model
  WHEN make IS NOT NULL AND make != ''
    THEN make
  WHEN model IS NOT NULL AND model != ''
    THEN model
  ELSE NULL
END;

-- Drop the old columns
ALTER TABLE equipment
  DROP COLUMN IF EXISTS make,
  DROP COLUMN IF EXISTS model;







