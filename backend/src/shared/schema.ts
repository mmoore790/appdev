import { pgTable, text, serial, integer, boolean, timestamp, json, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions (for authentication)
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { mode: 'string' }).notNull(),
}, (table) => {
  return {
    expireIdx: index("IDX_session_expire").on(table.expire),
  };
});

// Businesses (Multi-tenancy)
export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  // Optional website for branding/contact
  website: text("website"),
  // Email "from" settings so emails can be branded per-business
  emailFromName: text("email_from_name"),
  emailFromAddress: text("email_from_address"),
  // Branding / logo
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  // Feature flags
  jobTrackerEnabled: boolean("job_tracker_enabled").notNull().default(true),
  // Hourly labour fee in pence (e.g., 5000 = £50.00 per hour)
  hourlyLabourFee: integer("hourly_labour_fee"),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertBusinessSchema = createInsertSchema(businesses).pick({
  name: true,
  email: true,
  phone: true,
  address: true,
  website: true,
  emailFromName: true,
  emailFromAddress: true,
  logoUrl: true,
  primaryColor: true,
  jobTrackerEnabled: true,
  secondaryColor: true,
  hourlyLabourFee: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businesses.$inferSelect;

// Subscriptions (for marketing site subscription purchases)
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  businessId: integer("business_id"),
  planName: text("plan_name"),
  status: text("status").notNull().default("pending"), // pending, active, cancelled, past_due, trialing
  email: text("email").notNull(),
  currentPeriodStart: timestamp("current_period_start", { mode: 'string' }),
  currentPeriodEnd: timestamp("current_period_end", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  accountCreated: boolean("account_created").notNull().default(false), // Track if account has been created
}, (table) => {
  return {
    emailIdx: index("IDX_subscriptions_email").on(table.email),
    stripeCustomerIdIdx: index("IDX_subscriptions_stripe_customer_id").on(table.stripeCustomerId),
    stripeSubscriptionIdIdx: index("IDX_subscriptions_stripe_subscription_id").on(table.stripeSubscriptionId),
    businessIdIdx: index("IDX_subscriptions_business_id").on(table.businessId),
  };
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  stripeSubscriptionId: true,
  stripeCustomerId: true,
  businessId: true,
  planName: true,
  status: true,
  email: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  accountCreated: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Platform Announcements
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("info"), // info, success, warning, critical
  audience: text("audience").notNull().default("login"), // login, dashboard, public
  ctaText: text("cta_text"),
  ctaUrl: text("cta_url"),
  isActive: boolean("is_active").notNull().default(true),
  displayStart: timestamp("display_start", { mode: 'string' }),
  displayEnd: timestamp("display_end", { mode: 'string' }),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).pick({
  title: true,
  message: true,
  priority: true,
  audience: true,
  ctaText: true,
  ctaUrl: true,
  isActive: true,
  displayStart: true,
  displayEnd: true,
  createdBy: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

// RegistrationRequests
export const registrationRequests = pgTable("registration_requests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Business the user is registering for
  username: text("username").notNull(), // No longer unique globally, unique per business
  email: text("email").notNull(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  requestedRole: text("requested_role").notNull().default("staff"), // admin, staff, mechanic
  department: text("department"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
  notes: text("notes"),
}, (table) => {
  return {
    usernameBusinessIdx: index("IDX_registration_username_business").on(table.username, table.businessId),
  };
});

export const insertRegistrationRequestSchema = createInsertSchema(registrationRequests).pick({
  businessId: true,
  username: true,
  email: true,
  password: true,
  fullName: true,
  requestedRole: true,
  department: true,
  reason: true,
});

export type InsertRegistrationRequest = z.infer<typeof insertRegistrationRequestSchema>;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;

// Job Counter for sequential job IDs (per business)
export const jobCounter = pgTable("job_counter", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().unique(), // One counter per business
  currentNumber: integer("current_number").notNull().default(999), // Start at 999 so first job is WS-1000
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export type JobCounter = typeof jobCounter.$inferSelect;

// Order Counter for sequential unique order numbers (per business)
export const orderCounter = pgTable("order_counter", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().unique(), // One counter per business
  currentNumber: integer("current_number").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export type OrderCounter = typeof orderCounter.$inferSelect;

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // User belongs to a business
  username: text("username").notNull(), // No longer unique globally, unique per business
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("staff"), // admin, staff, mechanic
  email: text("email"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  // Notification preferences
  taskNotifications: boolean("task_notifications").notNull().default(true),
  messageNotifications: boolean("message_notifications").notNull().default(true),
  jobNotifications: boolean("job_notifications").notNull().default(true),
  // Getting Started dismissal
  gettingStartedDismissedAt: timestamp("getting_started_dismissed_at", { mode: 'string' }),
  // Onboarding status tracking
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: 'string' }),
  onboardingWelcomeDismissedAt: timestamp("onboarding_welcome_dismissed_at", { mode: 'string' }),
  onboardingSetupCompletedAt: timestamp("onboarding_setup_completed_at", { mode: 'string' }),
  onboardingChecklist: json("onboarding_checklist").$type<Record<string, boolean>>().default({}),
}, (table) => {
  return {
    usernameBusinessIdx: index("IDX_user_username_business").on(table.username, table.businessId),
  };
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  role: true,
  email: true,
  avatarUrl: true,
  isActive: true,
  taskNotifications: true,
  messageNotifications: true,
  jobNotifications: true,
  businessId: true,
  gettingStartedDismissedAt: true,
  onboardingCompletedAt: true,
  onboardingWelcomeDismissedAt: true,
  onboardingSetupCompletedAt: true,
  onboardingChecklist: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Customer belongs to a business
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
});

// Updated customer schema to make only name required
export const insertCustomerSchema = createInsertSchema(customers, {
  email: z.string().nullish(),
  phone: z.string().nullish(), 
  address: z.string().nullish(),
  notes: z.string().nullish()
}).pick({
  name: true,
  email: true,
  phone: true,
  address: true,
  notes: true,
  businessId: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Email History - Track all emails sent to customers
export const emailHistory = pgTable("email_history", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  customerId: integer("customer_id"), // Nullable - emails can be sent to addresses without customer records
  customerEmail: text("customer_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  emailType: text("email_type").notNull(), // 'system', 'manual', 'job_booked', 'job_accepted', 'payment_request', etc.
  sentBy: integer("sent_by"), // User ID who sent the email (null for system emails)
  sentAt: timestamp("sent_at", { mode: 'string' }).notNull().defaultNow(),
  metadata: json("metadata"), // Additional data like jobId, paymentId, etc.
});

export const insertEmailHistorySchema = createInsertSchema(emailHistory).pick({
  businessId: true,
  customerId: true,
  customerEmail: true,
  subject: true,
  body: true,
  emailType: true,
  sentBy: true,
  metadata: true,
});

export type InsertEmailHistory = z.infer<typeof insertEmailHistorySchema>;
export type EmailHistory = typeof emailHistory.$inferSelect;

// Equipment Types table was dropped

// Equipment (Assets)
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Equipment belongs to a business
  serialNumber: text("serial_number").notNull(),
  typeId: integer("type_id"), // Nullable since equipment types table was dropped
  customerId: integer("customer_id").notNull(),
  makeModel: text("make_model"), // Make and model combined (e.g., "Husqvarna 235", "Stihl MS 271")
  purchaseDate: timestamp("purchase_date", { mode: 'string' }),
  warrantyDurationMonths: integer("warranty_duration_months"), // Warranty duration in months
  warrantyExpiryDate: timestamp("warranty_expiry_date", { mode: 'string' }), // Calculated expiry date
  notes: text("notes"),
}, (table) => {
  return {
    serialNumberBusinessIdx: index("IDX_equipment_serial_business").on(table.serialNumber, table.businessId),
  };
});

export const insertEquipmentSchema = createInsertSchema(equipment).pick({
  serialNumber: true,
  customerId: true,
  makeModel: true,
  purchaseDate: true,
  warrantyDurationMonths: true,
  warrantyExpiryDate: true,
  notes: true,
  businessId: true,
}).extend({
  // Allow warranty duration to be specified as years or months
  warrantyDurationMonths: z.number().int().positive().optional(),
}).partial({
  makeModel: true,
  purchaseDate: true,
  warrantyDurationMonths: true,
  warrantyExpiryDate: true,
  notes: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Jobs
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Job belongs to a business
  jobId: text("job_id").notNull(), // No longer unique globally, unique per business
  equipmentId: integer("equipment_id"),
  equipmentDescription: text("equipment_description"),
  machineType: text("machine_type"), // Ride on Mower, Walk behind mower, chainsaw, strimmer, hedge trimmer, robotic mower, other
  equipmentMake: text("equipment_make"), // Make/brand of equipment
  equipmentModel: text("equipment_model"), // Model of equipment
  equipmentSerial: text("equipment_serial"), // Serial number of equipment
  roboticMowerPinCode: text("robotic_mower_pin_code"), // PIN code for robotic mowers
  customerId: integer("customer_id"),
  customerName: text("customer_name"), // For custom customer entries (name-only mode)
  customerEmail: text("customer_email"), // For storing email when customer profile not saved
  customerPhone: text("customer_phone"), // For storing phone when customer profile not saved
  assignedTo: integer("assigned_to"),
  status: text("status").notNull().default("waiting_assessment"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  taskDetails: text("task_details"),
  customerNotified: boolean("customer_notified").default(false),
  // Payment tracking fields
  paymentStatus: text("payment_status").default("unpaid"), // unpaid, paid, partial, pending_payment_request
  paymentAmount: integer("payment_amount"), // Amount in pence
  invoiceNumber: text("invoice_number"),
  paymentMethod: text("payment_method"), // cash, card, bank_transfer, stripe, etc.
  paymentNotes: text("payment_notes"),
  paidAt: timestamp("paid_at", { mode: 'string' }),
  paymentRecordedBy: integer("payment_recorded_by"), // User who recorded the payment
  linkedPaymentRequestId: integer("linked_payment_request_id"), // Links to payment_requests table
}, (table) => {
  return {
    jobIdBusinessIdx: index("IDX_job_jobid_business").on(table.jobId, table.businessId),
  };
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  jobId: true,
  equipmentId: true,
  equipmentDescription: true,
  machineType: true,
  equipmentMake: true,
  equipmentModel: true,
  equipmentSerial: true,
  roboticMowerPinCode: true,
  customerId: true,
  assignedTo: true,
  status: true,
  description: true,
  taskDetails: true,
  estimatedHours: true,
  paymentStatus: true,
  paymentAmount: true,
  invoiceNumber: true,
  paymentMethod: true,
  paymentNotes: true,
  businessId: true,
}).extend({
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
}).partial({
  customerId: true,
  jobId: true, // Make jobId optional - backend will generate it if not provided
  equipmentId: true,
  equipmentDescription: true,
  machineType: true,
  equipmentMake: true,
  equipmentModel: true,
  equipmentSerial: true,
  roboticMowerPinCode: true,
  assignedTo: true,
  taskDetails: true,
  estimatedHours: true,
  paymentStatus: true,
  paymentAmount: true,
  invoiceNumber: true,
  paymentMethod: true,
  paymentNotes: true,
});

// Schema for manual payment recording
export const recordPaymentSchema = z.object({
  paymentAmount: z.number().positive("Payment amount must be positive"),
  invoiceNumber: z.string().optional(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "cheque", "stripe", "other"]),
  paymentNotes: z.string().optional(),
});

export type RecordPayment = z.infer<typeof recordPaymentSchema>;

// Schema for creating job payment request
export const jobPaymentRequestSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  customerEmail: z.string().email("Valid email required").optional(),
  description: z.string().optional(),
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Services
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Service belongs to a business
  jobId: integer("job_id").notNull(),
  serviceType: text("service_type").default("general"),
  details: text("details"), // Changed from description to details
  performedBy: integer("performed_by"), // Changed from technician to performedBy
  performedAt: timestamp("performed_at", { mode: 'string' }).defaultNow(), // Set default to now
  partsUsed: json("parts_used"), // Changed from text to json type
  cost: integer("cost"), // Added this field
  notes: text("notes"), // Added this field
  laborHours: integer("labor_hours"), // Added labor hours field
});

export const insertServiceSchema = createInsertSchema(services).pick({
  jobId: true,
  serviceType: true,
  details: true,
  performedBy: true,
  performedAt: true,
  partsUsed: true,
  cost: true,
  notes: true,
  laborHours: true,
  businessId: true,
});

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Task belongs to a business
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  assignedTo: integer("assigned_to"),
  dueDate: timestamp("due_date", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  relatedJobId: integer("related_job_id"),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  description: true,
  priority: true,
  status: true,
  assignedTo: true,
  dueDate: true,
  relatedJobId: true,
  businessId: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;





// Callback Requests
export const callbackRequests = pgTable("callback_requests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Callback belongs to a business
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  assignedTo: integer("assigned_to"), // Nullable - allows unassigned callbacks
  relatedTaskId: integer("related_task_id"),
  subject: text("subject").notNull(),
  details: text("details"),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"), // pending, completed, archived, deleted
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  requestedAt: timestamp("requested_at", { mode: 'string' }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  notes: text("notes"),
  deletedAt: timestamp("deleted_at", { mode: 'string' }),
  deleteExpiresAt: timestamp("delete_expires_at", { mode: 'string' }),
});

export const insertCallbackRequestSchema = createInsertSchema(callbackRequests).pick({
  businessId: true,
  customerId: true,
  customerName: true,
  assignedTo: true,
  subject: true,
  details: true,
  phoneNumber: true,
  status: true,
  priority: true,
  notes: true,
});

export type InsertCallbackRequest = z.infer<typeof insertCallbackRequestSchema>;
export type CallbackRequest = typeof callbackRequests.$inferSelect;

// Job updates for tracking progress
export const jobUpdates = pgTable("job_updates", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Job update belongs to a business
  jobId: integer("job_id").notNull(),
  note: text("note").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  isPublic: boolean("is_public").notNull().default(true),
});

export const insertJobUpdateSchema = createInsertSchema(jobUpdates).pick({
  businessId: true,
  jobId: true,
  note: true,
  createdBy: true,
  isPublic: true,
});

export type InsertJobUpdate = z.infer<typeof insertJobUpdateSchema>;
export type JobUpdate = typeof jobUpdates.$inferSelect;

// Workshop Activities
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Activity belongs to a business
  userId: integer("user_id").notNull(),
  activityType: text("activity_type").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  timestamp: timestamp("timestamp", { mode: 'string' }).notNull().defaultNow(),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Work Completed Entries
export const workCompleted = pgTable("work_completed", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Work completed belongs to a business
  jobId: integer("job_id").notNull(),
  workDescription: text("work_description").notNull(),
  category: text("category").notNull(),
  laborHours: integer("labor_hours").notNull(), // Store as minutes for precision
  partsUsed: text("parts_used"),
  partsCost: integer("parts_cost"), // Store in pence for precision
  notes: text("notes"),
  completedBy: integer("completed_by").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertWorkCompletedSchema = createInsertSchema(workCompleted).pick({
  businessId: true,
  jobId: true,
  workDescription: true,
  category: true,
  laborHours: true,
  partsUsed: true,
  partsCost: true,
  notes: true,
  completedBy: true,
});

export type InsertWorkCompleted = z.infer<typeof insertWorkCompletedSchema>;
export type WorkCompleted = typeof workCompleted.$inferSelect;

// Labour Entries (Job Sheet)
export const labourEntries = pgTable("labour_entries", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  jobId: integer("job_id").notNull(),
  technicianId: integer("technician_id").notNull(), // Staff member who did the work
  description: text("description").notNull(), // Description of work performed
  timeSpent: integer("time_spent").notNull(), // Duration in minutes
  cost: integer("cost"), // Cost excluding VAT in pence (deprecated, use costExcludingVat)
  costExcludingVat: integer("cost_excluding_vat"), // Cost excluding VAT in pence
  costIncludingVat: integer("cost_including_vat"), // Cost including VAT in pence
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertLabourEntrySchema = createInsertSchema(labourEntries).pick({
  businessId: true,
  jobId: true,
  technicianId: true,
  description: true,
  timeSpent: true,
  cost: true,
  costExcludingVat: true,
  costIncludingVat: true,
});

export type InsertLabourEntry = z.infer<typeof insertLabourEntrySchema>;
export type LabourEntry = typeof labourEntries.$inferSelect;

// Parts Used (Job Sheet) - separate from parts ordered
export const partsUsed = pgTable("parts_used", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  jobId: integer("job_id").notNull(),
  partName: text("part_name").notNull(),
  sku: text("sku"), // Optional SKU
  quantity: integer("quantity").notNull().default(1),
  cost: integer("cost"), // Cost excluding VAT in pence (deprecated, use costExcludingVat)
  costExcludingVat: integer("cost_excluding_vat"), // Cost excluding VAT in pence
  costIncludingVat: integer("cost_including_vat"), // Cost including VAT in pence
  notes: text("notes"), // Optional notes
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertPartUsedSchema = createInsertSchema(partsUsed).pick({
  businessId: true,
  jobId: true,
  partName: true,
  sku: true,
  quantity: true,
  cost: true,
  costExcludingVat: true,
  costIncludingVat: true,
  notes: true,
});

export type InsertPartUsed = z.infer<typeof insertPartUsedSchema>;
export type PartUsed = typeof partsUsed.$inferSelect;

// Job Notes (Job Sheet)
export const jobNotes = pgTable("job_notes", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  jobId: integer("job_id").notNull().unique(), // One note record per job
  workSummary: text("work_summary"), // Technician notes - shown to customer
  internalNotes: text("internal_notes"), // Internal notes - not shown to customer
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertJobNoteSchema = createInsertSchema(jobNotes).pick({
  businessId: true,
  jobId: true,
  workSummary: true,
  internalNotes: true,
});

export type InsertJobNote = z.infer<typeof insertJobNoteSchema>;
export type JobNote = typeof jobNotes.$inferSelect;

// Job Attachments (Job Sheet)
export const jobAttachments = pgTable("job_attachments", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  jobId: integer("job_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // URL/path to the file
  fileType: text("file_type"), // MIME type or extension
  fileSize: integer("file_size"), // Size in bytes
  uploadedBy: integer("uploaded_by").notNull(), // User who uploaded
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertJobAttachmentSchema = createInsertSchema(jobAttachments).pick({
  businessId: true,
  jobId: true,
  fileName: true,
  fileUrl: true,
  fileType: true,
  fileSize: true,
  uploadedBy: true,
});

export type InsertJobAttachment = z.infer<typeof insertJobAttachmentSchema>;
export type JobAttachment = typeof jobAttachments.$inferSelect;

// Payment Requests
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Payment request belongs to a business
  jobId: integer("job_id"), // Optional link to a job
  customerEmail: text("customer_email").notNull(),
  amount: integer("amount").notNull(), // Store in pence/cents for precision
  currency: text("currency").notNull().default("GBP"), // GBP, EUR, USD, etc.
  description: text("description").notNull(), // What the payment is for
  
  // Payment provider specific fields
  checkoutId: text("checkout_id"), // Stripe session ID or SumUp checkout ID
  checkoutReference: text("checkout_reference").notNull(), // No longer unique globally, unique per business
  paymentLink: text("payment_link"), // Generated payment link
  
  // Status tracking
  status: text("status").notNull().default("pending"), // pending, paid, failed, expired
  
  // Timestamps
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { mode: 'string' }),
  expiresAt: timestamp("expires_at", { mode: 'string' }),
  
  // User who created the request
  createdBy: integer("created_by").notNull(),
  
  // SumUp transaction details (populated after payment)
  transactionId: text("transaction_id"),
  transactionCode: text("transaction_code"),
  authCode: text("auth_code"),
}, (table) => {
  return {
    checkoutReferenceBusinessIdx: index("IDX_payment_checkout_business").on(table.checkoutReference, table.businessId),
  };
});

export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).pick({
  businessId: true,
  jobId: true,
  customerEmail: true,
  amount: true,
  currency: true,
  description: true,
  createdBy: true,
}).extend({
  // Allow optional fields that can be set server-side or from frontend
  checkoutReference: z.string().optional(),
  // Override amount to accept decimal values (will be converted to pence on server)
  amount: z.number().positive(),
  // Ensure customerEmail is required
  customerEmail: z.string().email("Please enter a valid email address"),
}).partial({
  jobId: true,
});

export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequests.$inferSelect;

// Parts on Order
export const partsOnOrder = pgTable("parts_on_order", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Part order belongs to a business
  partName: text("part_name").notNull(),
  partNumber: text("part_number"), // Optional manufacturer part number
  supplier: text("supplier").notNull(),
  
  // Customer information
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone").notNull(),
  
  // Order tracking
  orderDate: timestamp("order_date", { mode: 'string' }).notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date", { mode: 'string' }),
  actualDeliveryDate: timestamp("actual_delivery_date", { mode: 'string' }),
  
  // Status and tracking
  status: text("status").notNull().default("ordered"), // ordered, arrived, collected, cancelled
  isArrived: boolean("is_arrived").notNull().default(false),
  isCustomerNotified: boolean("is_customer_notified").notNull().default(false),
  
  // Additional details
  quantity: integer("quantity").notNull().default(1),
  estimatedCost: integer("estimated_cost"), // Store in pence for precision
  actualCost: integer("actual_cost"), // Store in pence for precision
  notes: text("notes"),
  
  // Tracking who created and managed the order
  createdBy: integer("created_by").notNull(),
  updatedBy: integer("updated_by"),
  
  // Timestamps
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
  
  // Optional link to job if part is for a specific repair
  relatedJobId: integer("related_job_id"),
});

export const insertPartOnOrderSchema = createInsertSchema(partsOnOrder).pick({
  businessId: true,
  partName: true,
  partNumber: true,
  supplier: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  orderDate: true,
  expectedDeliveryDate: true,
  status: true,
  quantity: true,
  estimatedCost: true,
  notes: true,
  createdBy: true,
  relatedJobId: true,
}).extend({
  // Allow optional fields
  createdBy: z.number().optional(),
  estimatedCost: z.number().optional(), // Accept decimal values (converted to pence server-side)
  actualCost: z.number().optional(),
}).partial({
  partNumber: true,
  customerEmail: true,
  expectedDeliveryDate: true,
  relatedJobId: true,
});

export type InsertPartOnOrder = z.infer<typeof insertPartOnOrderSchema>;
export type PartOnOrder = typeof partsOnOrder.$inferSelect;

// Part Order Status Updates - for detailed tracking of all events
export const partOrderUpdates = pgTable("part_order_updates", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Part order update belongs to a business
  partOrderId: integer("part_order_id").notNull(),
  updateType: text("update_type").notNull(), // ordered, status_change, arrived, customer_notified, collected, cancelled
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertPartOrderUpdateSchema = createInsertSchema(partOrderUpdates).pick({
  businessId: true,
  partOrderId: true,
  updateType: true,
  previousStatus: true,
  newStatus: true,
  notes: true,
  createdBy: true,
}).extend({
  createdBy: z.number().optional(),
}).partial({
  previousStatus: true,
  newStatus: true,
  notes: true,
});

export type InsertPartOrderUpdate = z.infer<typeof insertPartOrderUpdateSchema>;
export type PartOrderUpdate = typeof partOrderUpdates.$inferSelect;

// Time Entries (Calendar Events)
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Time entry belongs to a business
  userId: integer("user_id").notNull(), // Staff member
  startTime: timestamp("start_time", { mode: 'string' }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(15), // Duration in minutes (default 15)
  title: text("title").notNull(),
  description: text("description"),
  jobId: integer("job_id"), // Optional link to a job
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
  createdBy: integer("created_by"), // User who created the entry (can be different from userId)
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).pick({
  businessId: true,
  userId: true,
  startTime: true,
  durationMinutes: true,
  title: true,
  description: true,
  jobId: true,
  createdBy: true,
}).extend({
  createdBy: z.number().optional(),
}).partial({
  description: true,
  jobId: true,
});

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

// Messages - Internal messaging system for business members
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Message belongs to a business
  senderId: integer("sender_id").notNull(), // User who sent the message
  recipientId: integer("recipient_id"), // Nullable for group messages (future feature)
  threadId: integer("thread_id"), // For grouping messages in conversations
  content: text("content").notNull(), // Message text content
  isRead: boolean("is_read").notNull().default(false), // Read status
  readAt: timestamp("read_at", { mode: 'string' }), // When message was read
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  deletedAt: timestamp("deleted_at", { mode: 'string' }), // Soft delete
  // Attachments
  attachedJobId: integer("attached_job_id"), // Link to a job
  attachedTaskId: integer("attached_task_id"), // Link to a task
  attachedImageUrls: json("attached_image_urls").$type<string[] | null>(), // Array of image URLs
}, (table) => {
  return {
    businessIdIdx: index("IDX_message_business_id").on(table.businessId),
    senderIdIdx: index("IDX_message_sender_id").on(table.senderId),
    recipientIdIdx: index("IDX_message_recipient_id").on(table.recipientId),
    threadIdIdx: index("IDX_message_thread_id").on(table.threadId),
    createdAtIdx: index("IDX_message_created_at").on(table.createdAt),
  };
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  businessId: true,
  senderId: true,
  recipientId: true,
  threadId: true,
  content: true,
  attachedJobId: true,
  attachedTaskId: true,
  attachedImageUrls: true,
}).extend({
  attachedImageUrls: z.array(z.string().url()).optional(),
}).partial({
  recipientId: true,
  threadId: true,
  attachedJobId: true,
  attachedTaskId: true,
  attachedImageUrls: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Message Threads for Group Conversations
export const messageThreads = pgTable("message_threads", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: text("name"), // Optional group name
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => {
  return {
    businessIdIdx: index("IDX_thread_business_id").on(table.businessId),
  };
});

export const messageThreadParticipants = pgTable("message_thread_participants", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: timestamp("joined_at", { mode: 'string' }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { mode: 'string' }),
}, (table) => {
  return {
    threadIdIdx: index("IDX_thread_participant_thread_id").on(table.threadId),
    userIdIdx: index("IDX_thread_participant_user_id").on(table.userId),
    uniqueThreadUser: index("IDX_thread_participant_unique").on(table.threadId, table.userId),
  };
});

export const insertMessageThreadSchema = createInsertSchema(messageThreads).pick({
  businessId: true,
  name: true,
  createdBy: true,
});

export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type MessageThread = typeof messageThreads.$inferSelect;

// Notification Dismissals - Track which notifications users have dismissed
export const notificationDismissals = pgTable("notification_dismissals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  businessId: integer("business_id").notNull(),
  notificationId: text("notification_id").notNull(),
  notificationType: text("notification_type").notNull(),
  dismissedAt: timestamp("dismissed_at", { mode: 'string' }).notNull().defaultNow(),
}, (table) => {
  return {
    userBusinessIdx: index("IDX_notification_dismissal_user_business").on(table.userId, table.businessId),
    notificationIdIdx: index("IDX_notification_dismissal_notification_id").on(table.notificationId),
    uniqueUserNotification: index("IDX_notification_dismissal_unique").on(table.userId, table.businessId, table.notificationId),
  };
});

export const insertNotificationDismissalSchema = createInsertSchema(notificationDismissals).pick({
  userId: true,
  businessId: true,
  notificationId: true,
  notificationType: true,
});

export type InsertNotificationDismissal = z.infer<typeof insertNotificationDismissalSchema>;
export type NotificationDismissal = typeof notificationDismissals.$inferSelect;

// Notifications - Actual notification records
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userId: integer("user_id").notNull(), // The user who should receive this notification
  type: text("type").notNull(), // job, callback, task, calendar, message
  title: text("title").notNull(),
  description: text("description"),
  entityType: text("entity_type").notNull(), // job, callback, task, time_entry, message
  entityId: integer("entity_id").notNull(),
  link: text("link"), // URL to navigate to the entity
  priority: text("priority").notNull().default("normal"), // normal, high
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
}, (table) => {
  return {
    userIdIdx: index("IDX_notification_user_id").on(table.userId),
    businessIdIdx: index("IDX_notification_business_id").on(table.businessId),
    entityIdx: index("IDX_notification_entity").on(table.entityType, table.entityId),
    unreadIdx: index("IDX_notification_unread").on(table.userId, table.isRead),
  };
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  businessId: true,
  userId: true,
  type: true,
  title: true,
  description: true,
  entityType: true,
  entityId: true,
  link: true,
  priority: true,
  metadata: true,
}).partial({
  description: true,
  link: true,
  priority: true,
  metadata: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Universal Order Management System
// Orders - Main order table (replaces parts_on_order with generic design)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(), // Order belongs to a business
  
  // Order reference/number
  orderNumber: text("order_number").notNull(), // Unique order number per business
  
  // Customer information (can be linked to customer table or standalone)
  customerId: integer("customer_id"), // Optional link to customers table
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address"),
  customerNotes: text("customer_notes"), // Optional notes about customer
  
  // Order metadata
  orderDate: timestamp("order_date", { mode: 'string' }).notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date", { mode: 'string' }),
  actualDeliveryDate: timestamp("actual_delivery_date", { mode: 'string' }),
  
  // Status workflow: not_ordered, ordered, arrived, completed
  status: text("status").notNull().default("not_ordered"),
  
  // Supplier information (optional)
  supplierName: text("supplier_name"),
  supplierNotes: text("supplier_notes"),
  
  // Lead time and tracking
  expectedLeadTime: integer("expected_lead_time"), // Days
  trackingNumber: text("tracking_number"),
  
  // Financial information
  estimatedTotalCost: integer("estimated_total_cost"), // Store in pence for precision
  actualTotalCost: integer("actual_total_cost"), // Store in pence for precision
  depositAmount: integer("deposit_amount"), // Store in pence for precision
  
  // General notes
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Staff-only notes
  
  // Notification preferences
  notifyOnOrderPlaced: boolean("notify_on_order_placed").notNull().default(true),
  notifyOnStatusChange: boolean("notify_on_status_change").notNull().default(true),
  notifyOnArrival: boolean("notify_on_arrival").notNull().default(true),
  notificationMethod: text("notification_method").default("email"), // email, sms, both
  
  // Tracking
  createdBy: integer("created_by").notNull(),
  updatedBy: integer("updated_by"),
  
  // Timestamps
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
  
  // Optional links
  relatedJobId: integer("related_job_id"), // Link to a job if order is for a specific job
}, (table) => {
  return {
    orderNumberBusinessIdx: index("IDX_order_number_business").on(table.orderNumber, table.businessId),
    statusIdx: index("IDX_order_status").on(table.status, table.businessId),
    customerIdx: index("IDX_order_customer").on(table.customerId, table.businessId),
    jobIdx: index("IDX_order_job").on(table.relatedJobId, table.businessId),
  };
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  businessId: true,
  orderNumber: true,
  customerId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  customerAddress: true,
  customerNotes: true,
  orderDate: true,
  expectedDeliveryDate: true,
  status: true,
  supplierName: true,
  supplierNotes: true,
  expectedLeadTime: true,
  trackingNumber: true,
  estimatedTotalCost: true,
  actualTotalCost: true,
  depositAmount: true,
  notes: true,
  internalNotes: true,
  notifyOnOrderPlaced: true,
  notifyOnStatusChange: true,
  notifyOnArrival: true,
  notificationMethod: true,
  createdBy: true,
  relatedJobId: true,
}).extend({
  estimatedTotalCost: z.number().optional(), // Accept decimal values (converted to pence server-side)
  actualTotalCost: z.number().optional(),
  depositAmount: z.number().optional(),
  notificationMethod: z.enum(["email", "sms", "both"]).optional(),
}).partial({
  orderNumber: true, // Auto-generated if not provided
  customerId: true,
  customerEmail: true,
  customerAddress: true,
  customerNotes: true,
  orderDate: true, // Has default value
  expectedDeliveryDate: true,
  status: true, // Has default value
  supplierName: true,
  supplierNotes: true,
  expectedLeadTime: true,
  trackingNumber: true,
  estimatedTotalCost: true,
  actualTotalCost: true,
  depositAmount: true,
  notes: true,
  internalNotes: true,
  relatedJobId: true,
  notifyOnOrderPlaced: true, // Has default value
  notifyOnStatusChange: true, // Has default value
  notifyOnArrival: true, // Has default value
  createdBy: true, // Added server-side
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order Items - Individual items within an order
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  orderId: integer("order_id").notNull(), // Foreign key to orders
  
  // Item details
  itemName: text("item_name").notNull(),
  itemSku: text("item_sku"), // Optional SKU/manufacturer part number
  itemType: text("item_type").notNull(), // part, machine, accessory, service, consumable, other
  isOrdered: boolean("is_ordered").notNull().default(false), // Whether this item has been ordered
  
  // Quantity and pricing
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price"), // Store in pence for precision (deprecated, use priceExcludingVat)
  priceExcludingVat: integer("price_excluding_vat"), // Store in pence for precision
  priceIncludingVat: integer("price_including_vat"), // Store in pence for precision
  totalPrice: integer("total_price"), // Store in pence for precision
  
  // Supplier information (can override order-level supplier)
  supplierName: text("supplier_name"),
  supplierSku: text("supplier_sku"),
  
  // Notes
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
}, (table) => {
  return {
    orderIdIdx: index("IDX_order_item_order_id").on(table.orderId),
    itemTypeIdx: index("IDX_order_item_type").on(table.itemType, table.businessId),
  };
});

export const insertOrderItemSchema = createInsertSchema(orderItems).pick({
  businessId: true,
  orderId: true,
  itemName: true,
  itemSku: true,
  itemType: true,
  quantity: true,
  isOrdered: true,
  unitPrice: true,
  priceExcludingVat: true,
  priceIncludingVat: true,
  totalPrice: true,
  supplierName: true,
  supplierSku: true,
  notes: true,
}).extend({
  unitPrice: z.number().optional(), // Accept decimal values (converted to pence server-side) - deprecated
  priceExcludingVat: z.number().optional(), // Accept decimal values (converted to pence server-side)
  priceIncludingVat: z.number().optional(), // Accept decimal values (converted to pence server-side)
  totalPrice: z.number().optional(),
  itemType: z.enum(["part", "machine", "accessory", "service", "consumable", "other"]),
}).partial({
  businessId: true, // Added server-side
  orderId: true, // Added server-side after order creation
  itemSku: true,
  unitPrice: true,
  priceExcludingVat: true,
  priceIncludingVat: true,
  isOrdered: true,
  totalPrice: true,
  supplierName: true,
  supplierSku: true,
  notes: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Order Status History - Track all status changes
export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  orderId: integer("order_id").notNull(),
  
  // Status change details
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  changeReason: text("change_reason"), // Optional reason for status change
  
  // Metadata
  notes: text("notes"),
  metadata: json("metadata").$type<Record<string, unknown> | null>(), // Additional data (e.g., tracking number, delivery date)
  
  // Who made the change
  changedBy: integer("changed_by").notNull(),
  
  // Timestamp
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
}, (table) => {
  return {
    orderIdIdx: index("IDX_order_status_history_order_id").on(table.orderId),
    createdAtIdx: index("IDX_order_status_history_created_at").on(table.createdAt),
  };
});

export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).pick({
  businessId: true,
  orderId: true,
  previousStatus: true,
  newStatus: true,
  changeReason: true,
  notes: true,
  metadata: true,
  changedBy: true,
}).partial({
  previousStatus: true,
  changeReason: true,
  notes: true,
  metadata: true,
});

export type InsertOrderStatusHistory = z.infer<typeof insertOrderStatusHistorySchema>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;

// Password Reset Codes
export const passwordResetCodes = pgTable("password_reset_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  businessId: integer("business_id").notNull(),
  code: text("code").notNull(), // 6-digit verification code
  email: text("email").notNull(), // Email address the code was sent to
  expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(), // Code expiration time (15 minutes)
  usedAt: timestamp("used_at", { mode: 'string' }), // When the code was used (null if not used)
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
}, (table) => {
  return {
    codeIdx: index("IDX_password_reset_code").on(table.code),
    userIdIdx: index("IDX_password_reset_user_id").on(table.userId),
    emailIdx: index("IDX_password_reset_email").on(table.email),
  };
});

export const insertPasswordResetCodeSchema = createInsertSchema(passwordResetCodes).pick({
  userId: true,
  businessId: true,
  code: true,
  email: true,
  expiresAt: true,
});

export type InsertPasswordResetCode = z.infer<typeof insertPasswordResetCodeSchema>;
export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;
