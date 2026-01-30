-- Migration: Add equipment_serial column to jobs table

ALTER TABLE "jobs" 
ADD COLUMN "equipment_serial" TEXT;







