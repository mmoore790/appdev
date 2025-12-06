CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "callback_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"assigned_to" integer,
	"related_task_id" integer,
	"subject" text NOT NULL,
	"details" text,
	"phone_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"deleted_at" timestamp,
	"delete_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"serial_number" text NOT NULL,
	"type_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"purchase_date" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "job_counter" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_number" integer DEFAULT 999 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"equipment_id" integer,
	"equipment_description" text,
	"customer_id" integer,
	"assigned_to" integer,
	"status" text DEFAULT 'waiting_assessment' NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"task_details" text,
	"customer_notified" boolean DEFAULT false,
	"payment_status" text DEFAULT 'unpaid',
	"payment_amount" integer,
	"invoice_number" text,
	"payment_method" text,
	"payment_notes" text,
	"paid_at" timestamp,
	"payment_recorded_by" integer,
	"linked_payment_request_id" integer,
	CONSTRAINT "jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "part_order_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_order_id" integer NOT NULL,
	"update_type" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts_on_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_name" text NOT NULL,
	"part_number" text,
	"supplier" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"status" text DEFAULT 'ordered' NOT NULL,
	"is_arrived" boolean DEFAULT false NOT NULL,
	"is_customer_notified" boolean DEFAULT false NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"estimated_cost" integer,
	"actual_cost" integer,
	"notes" text,
	"created_by" integer NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"related_job_id" integer
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"customer_email" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"description" text NOT NULL,
	"checkout_id" text,
	"checkout_reference" text NOT NULL,
	"payment_link" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"created_by" integer NOT NULL,
	"transaction_id" text,
	"transaction_code" text,
	"auth_code" text,
	CONSTRAINT "payment_requests_checkout_reference_unique" UNIQUE("checkout_reference")
);
--> statement-breakpoint
CREATE TABLE "registration_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_role" text DEFAULT 'staff' NOT NULL,
	"department" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"notes" text,
	CONSTRAINT "registration_requests_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"service_type" text DEFAULT 'general',
	"details" text,
	"performed_by" integer,
	"performed_at" timestamp DEFAULT now(),
	"parts_used" json,
	"cost" integer,
	"notes" text,
	"labor_hours" integer
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" integer,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"related_job_id" integer
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 15 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"job_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"email" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"task_notifications" boolean DEFAULT true NOT NULL,
	"message_notifications" boolean DEFAULT true NOT NULL,
	"job_notifications" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "work_completed" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"work_description" text NOT NULL,
	"category" text NOT NULL,
	"labor_hours" integer NOT NULL,
	"parts_used" text,
	"parts_cost" integer,
	"notes" text,
	"completed_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");