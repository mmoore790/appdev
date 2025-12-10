-- Migration: Add machine type, equipment make/model, and robotic mower pin code fields to jobs table

ALTER TABLE "jobs" 
ADD COLUMN "machine_type" TEXT,
ADD COLUMN "equipment_make" TEXT,
ADD COLUMN "equipment_model" TEXT,
ADD COLUMN "robotic_mower_pin_code" TEXT;
