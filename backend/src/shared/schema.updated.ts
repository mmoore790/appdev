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
  lastLogin: timestamp("last_login", { mode: 'string' }),
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

// Equipment Types
export const equipmentTypes = pgTable("equipment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  model: text("model"),
  description: text("description"),
});

export const insertEquipmentTypeSchema = createInsertSchema(equipmentTypes).pick({
  name: true,
  brand: true,
  model: true,
  description: true,
});

export type InsertEquipmentType = z.infer<typeof insertEquipmentTypeSchema>;
export type EquipmentType = typeof equipmentTypes.$inferSelect;

// Equipment
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  typeId: integer("type_id"),
  serialNumber: text("serial_number"),
  purchaseDate: timestamp("purchase_date", { mode: 'string' }),
  warrantyExpiration: timestamp("warranty_expiration", { mode: 'string' }),
  lastServiced: timestamp("last_serviced", { mode: 'string' }),
  notes: text("notes"),
});

export const insertEquipmentSchema = createInsertSchema(equipment).pick({
  customerId: true,
  typeId: true,
  serialNumber: true,
  purchaseDate: true,
  warrantyExpiration: true,
  lastServiced: true,
  notes: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Jobs
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  customerId: integer("customer_id"),
  equipmentId: integer("equipment_id"),
  equipmentDescription: text("equipment_description"),
  assignedTo: integer("assigned_to"),
  status: text("status").notNull().default("waiting_assessment"),
  description: text("description").notNull(),
  taskDetails: text("task_details"),
  estimatedHours: integer("estimated_hours"),
  customerName: text("customer_name"), // For custom customer entries
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  customerNotified: boolean("customer_notified").notNull().default(false),
});

export const insertJobSchema = createInsertSchema(jobs, {
  equipmentId: z.number().nullable().optional(),
  equipmentDescription: z.string().nullable().optional(),
  assignedTo: z.number().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  customerName: z.string().nullable().optional(),
}).pick({
  jobId: true,
  customerId: true,
  equipmentId: true,
  equipmentDescription: true,
  assignedTo: true,
  status: true,
  description: true,
  taskDetails: true,
  estimatedHours: true,
  customerName: true,
  customerNotified: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Services
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  serviceType: text("service_type").notNull(),
  technician: integer("technician"),
  description: text("description").notNull(),
  hoursSpent: integer("hours_spent"),
  partsUsed: text("parts_used"),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(services).pick({
  jobId: true,
  serviceType: true,
  technician: true,
  description: true,
  hoursSpent: true,
  partsUsed: true,
});

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by").notNull(),
  dueDate: timestamp("due_date", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  relatedEntityType: text("related_entity_type"), // job, customer, equipment
  relatedEntityId: integer("related_entity_id"),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  description: true,
  status: true,
  priority: true,
  assignedTo: true,
  createdBy: true,
  dueDate: true,
  relatedEntityType: true,
  relatedEntityId: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Activity Logs
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  activityType: text("activity_type").notNull(), // login, job_created, job_updated, task_created, task_completed
  description: text("description").notNull(),
  timestamp: timestamp("timestamp", { mode: 'string' }).notNull().defaultNow(),
  entityType: text("entity_type"), // user, job, task, etc.
  entityId: integer("entity_id"),
});

export const insertActivitySchema = createInsertSchema(activities).pick({
  userId: true,
  activityType: true,
  description: true,
  entityType: true,
  entityId: true,
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  recipientId: integer("recipient_id").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at", { mode: 'string' }).notNull().defaultNow(),
  readAt: timestamp("read_at", { mode: 'string' }),
  attachmentUrl: text("attachment_url"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { mode: 'string' }),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  senderId: true,
  recipientId: true,
  subject: true,
  content: true,
  attachmentUrl: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Customer Callbacks
export const callbacks = pgTable("callbacks", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, completed, cancelled
  notes: text("notes"),
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  relatedTaskId: integer("related_task_id"),
});

export const insertCallbackSchema = createInsertSchema(callbacks).pick({
  customerName: true,
  phone: true,
  email: true,
  reason: true,
  status: true,
  notes: true,
  assignedTo: true,
  createdBy: true,
  relatedTaskId: true,
});

export type InsertCallback = z.infer<typeof insertCallbackSchema>;
export type Callback = typeof callbacks.$inferSelect;