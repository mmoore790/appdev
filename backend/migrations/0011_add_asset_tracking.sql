-- Add asset tracking fields to equipment table
-- Add make and model fields
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS make TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS warranty_duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_expiry_date TIMESTAMP;

-- Make type_id nullable since equipment types table was dropped
ALTER TABLE equipment
  ALTER COLUMN type_id DROP NOT NULL;

-- Create unique index on serial_number per business (serial numbers must be unique within a business)
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_serial_business 
  ON equipment(serial_number, business_id);
