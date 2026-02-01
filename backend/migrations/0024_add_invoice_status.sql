-- Migration: Add invoice_status column to jobs table
-- Values: null (not ready), 'ready_to_invoice', 'invoiced'

ALTER TABLE "jobs"
ADD COLUMN IF NOT EXISTS "invoice_status" TEXT;
