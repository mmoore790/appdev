-- Migration: Make customer_id nullable in email_history table
-- This allows logging emails sent to addresses that don't have customer records yet

ALTER TABLE "email_history" 
ALTER COLUMN "customer_id" DROP NOT NULL;
