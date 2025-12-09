-- Universal Order Management System
-- This migration creates tables for a flexible order management system
-- that can handle any type of item (parts, machines, accessories, services, consumables, etc.)

-- Orders table - Main order table
CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text NOT NULL,
	"customer_address" text,
	"customer_notes" text,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"supplier_name" text,
	"supplier_contact" text,
	"supplier_email" text,
	"supplier_phone" text,
	"expected_lead_time" integer,
	"tracking_number" text,
	"estimated_total_cost" integer,
	"actual_total_cost" integer,
	"deposit_amount" integer,
	"notes" text,
	"internal_notes" text,
	"notify_on_order_placed" boolean DEFAULT true NOT NULL,
	"notify_on_status_change" boolean DEFAULT true NOT NULL,
	"notify_on_arrival" boolean DEFAULT true NOT NULL,
	"notification_method" text DEFAULT 'email',
	"created_by" integer NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"related_job_id" integer
);

-- Order Items table - Individual items within an order
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"item_sku" text,
	"item_type" text NOT NULL,
	"item_category" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer,
	"total_price" integer,
	"supplier_name" text,
	"supplier_sku" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Order Status History table - Track all status changes
CREATE TABLE IF NOT EXISTS "order_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"change_reason" text,
	"notes" text,
	"metadata" json,
	"changed_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "IDX_order_number_business" ON "orders" ("order_number", "business_id");
CREATE INDEX IF NOT EXISTS "IDX_order_status" ON "orders" ("status", "business_id");
CREATE INDEX IF NOT EXISTS "IDX_order_customer" ON "orders" ("customer_id", "business_id");
CREATE INDEX IF NOT EXISTS "IDX_order_job" ON "orders" ("related_job_id", "business_id");
CREATE INDEX IF NOT EXISTS "IDX_order_item_order_id" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "IDX_order_item_type" ON "order_items" ("item_type", "business_id");
CREATE INDEX IF NOT EXISTS "IDX_order_status_history_order_id" ON "order_status_history" ("order_id");
CREATE INDEX IF NOT EXISTS "IDX_order_status_history_created_at" ON "order_status_history" ("created_at");

-- Add foreign key constraints
DO $$ 
BEGIN
	-- Add foreign key from order_items to orders if it doesn't exist
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints 
		WHERE constraint_name = 'order_items_order_id_orders_id_fk'
	) THEN
		ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" 
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
	END IF;

	-- Add foreign key from order_status_history to orders if it doesn't exist
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints 
		WHERE constraint_name = 'order_status_history_order_id_orders_id_fk'
	) THEN
		ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" 
		FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
	END IF;

	-- Add foreign key from orders to customers if it doesn't exist
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints 
		WHERE constraint_name = 'orders_customer_id_customers_id_fk'
	) THEN
		ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" 
		FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL;
	END IF;

	-- Add foreign key from orders to jobs if it doesn't exist
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints 
		WHERE constraint_name = 'orders_related_job_id_jobs_id_fk'
	) THEN
		ALTER TABLE "orders" ADD CONSTRAINT "orders_related_job_id_jobs_id_fk" 
		FOREIGN KEY ("related_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL;
	END IF;
END $$;



