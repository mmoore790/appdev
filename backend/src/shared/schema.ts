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

// RegistrationRequests
export const registrationRequests = pgTable("registration_requests", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
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
});

export const insertRegistrationRequestSchema = createInsertSchema(registrationRequests).pick({
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

// Job Counter for sequential job IDs
export const jobCounter = pgTable("job_counter", {
  id: serial("id").primaryKey(),
  currentNumber: integer("current_number").notNull().default(999), // Start at 999 so first job is WS-1000
  updatedAt: timestamp("updated_at", { mode: 'string' }).notNull().defaultNow(),
});

export type JobCounter = typeof jobCounter.$inferSelect;

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
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
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
});

// Updated customer schema to make only name required
export const insertCustomerSchema = createInsertSchema(customers, {
  email: z.string().optional(),
  phone: z.string().optional(), 
  address: z.string().optional(),
  notes: z.string().optional()
}).pick({
  name: true,
  email: true,
  phone: true,
  address: true,
  notes: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Equipment Types table was dropped

// Equipment
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").notNull(),
  typeId: integer("type_id").notNull(),
  customerId: integer("customer_id").notNull(),
  purchaseDate: timestamp("purchase_date", { mode: 'string' }),
  notes: text("notes"),
});

export const insertEquipmentSchema = createInsertSchema(equipment).pick({
  serialNumber: true,
  typeId: true,
  customerId: true,
  purchaseDate: true,
  notes: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Jobs
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  equipmentId: integer("equipment_id"),
  equipmentDescription: text("equipment_description"),
  customerId: integer("customer_id"),
  assignedTo: integer("assigned_to"),
  status: text("status").notNull().default("waiting_assessment"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
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
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  jobId: true,
  equipmentId: true,
  equipmentDescription: true,
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
}).extend({
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
}).partial({
  customerId: true,
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
});

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
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
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;





// Callback Requests
export const callbackRequests = pgTable("callback_requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  assignedTo: integer("assigned_to").notNull(),
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

export const insertCallbackRequestSchema = createInsertSchema(callbackRequests).omit({
  id: true,
  relatedTaskId: true,
  requestedAt: true,
  completedAt: true
});

export type InsertCallbackRequest = z.infer<typeof insertCallbackRequestSchema>;
export type CallbackRequest = typeof callbackRequests.$inferSelect;

// Job updates for tracking progress
export const jobUpdates = pgTable("job_updates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  note: text("note").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  isPublic: boolean("is_public").notNull().default(true),
});

export const insertJobUpdateSchema = createInsertSchema(jobUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertJobUpdate = z.infer<typeof insertJobUpdateSchema>;
export type JobUpdate = typeof jobUpdates.$inferSelect;

// Workshop Activities
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
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

export const insertWorkCompletedSchema = createInsertSchema(workCompleted).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkCompleted = z.infer<typeof insertWorkCompletedSchema>;
export type WorkCompleted = typeof workCompleted.$inferSelect;

// Payment Requests
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id"), // Optional link to a job
  customerEmail: text("customer_email").notNull(),
  amount: integer("amount").notNull(), // Store in pence/cents for precision
  currency: text("currency").notNull().default("GBP"), // GBP, EUR, USD, etc.
  description: text("description").notNull(), // What the payment is for
  
  // Payment provider specific fields
  checkoutId: text("checkout_id"), // Stripe session ID or SumUp checkout ID
  checkoutReference: text("checkout_reference").notNull().unique(), // Our unique reference
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
});

export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  checkoutId: true,
  paymentLink: true,
  status: true,
  paidAt: true,
  expiresAt: true,
  transactionId: true,
  transactionCode: true,
  authCode: true,
}).extend({
  // Allow optional fields that can be set server-side or from frontend
  checkoutReference: z.string().optional(),
  createdBy: z.number().optional(),
  // Override amount to accept decimal values (will be converted to pence on server)
  amount: z.number().positive(),
  // Ensure customerEmail is required
  customerEmail: z.string().email("Please enter a valid email address"),
});

export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequests.$inferSelect;

// Parts on Order
export const partsOnOrder = pgTable("parts_on_order", {
  id: serial("id").primaryKey(),
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

export const insertPartOnOrderSchema = createInsertSchema(partsOnOrder).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: true,
}).extend({
  // Allow optional fields
  createdBy: z.number().optional(),
  estimatedCost: z.number().optional(), // Accept decimal values (converted to pence server-side)
  actualCost: z.number().optional(),
});

export type InsertPartOnOrder = z.infer<typeof insertPartOnOrderSchema>;
export type PartOnOrder = typeof partsOnOrder.$inferSelect;

// Part Order Status Updates - for detailed tracking of all events
export const partOrderUpdates = pgTable("part_order_updates", {
  id: serial("id").primaryKey(),
  partOrderId: integer("part_order_id").notNull(),
  updateType: text("update_type").notNull(), // ordered, status_change, arrived, customer_notified, collected, cancelled
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertPartOrderUpdateSchema = createInsertSchema(partOrderUpdates).omit({
  id: true,
  createdAt: true,
}).extend({
  createdBy: z.number().optional(),
});

export type InsertPartOrderUpdate = z.infer<typeof insertPartOrderUpdateSchema>;
export type PartOrderUpdate = typeof partOrderUpdates.$inferSelect;
