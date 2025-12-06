-- Update Order Management Schema
-- This migration simplifies the order management system:
-- 1. Adds supplier_notes, removes supplier_contact/email/phone
-- 2. Adds is_ordered field to order_items
-- 3. Removes item_category from order_items
-- 4. Updates default status from 'draft' to 'not_ordered'

-- Add supplier_notes column to orders table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'supplier_notes'
    ) THEN
        ALTER TABLE "orders" ADD COLUMN "supplier_notes" text;
    END IF;
END $$;

-- Remove supplier_contact, supplier_email, supplier_phone columns
DO $$ 
BEGIN
    -- Remove supplier_contact
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'supplier_contact'
    ) THEN
        ALTER TABLE "orders" DROP COLUMN "supplier_contact";
    END IF;

    -- Remove supplier_email
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'supplier_email'
    ) THEN
        ALTER TABLE "orders" DROP COLUMN "supplier_email";
    END IF;

    -- Remove supplier_phone
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'supplier_phone'
    ) THEN
        ALTER TABLE "orders" DROP COLUMN "supplier_phone";
    END IF;
END $$;

-- Add is_ordered column to order_items table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'is_ordered'
    ) THEN
        ALTER TABLE "order_items" ADD COLUMN "is_ordered" boolean DEFAULT false NOT NULL;
    END IF;
END $$;

-- Remove item_category column from order_items table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'item_category'
    ) THEN
        ALTER TABLE "order_items" DROP COLUMN "item_category";
    END IF;
END $$;

-- Update default status from 'draft' to 'not_ordered'
DO $$ 
BEGIN
    -- Update the default value for status column
    ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'not_ordered';
    
    -- Update existing records with status 'draft' to 'not_ordered'
    UPDATE "orders" SET "status" = 'not_ordered' WHERE "status" = 'draft';
END $$;

