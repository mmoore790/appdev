import { 
  users, User, InsertUser,
  customers, Customer, InsertCustomer,
  equipment, Equipment, InsertEquipment,
  jobs, Job, InsertJob,
  services, Service, InsertService,
  tasks, Task, InsertTask,
  registrationRequests, RegistrationRequest, InsertRegistrationRequest,
  callbackRequests, CallbackRequest, InsertCallbackRequest,
  jobUpdates, JobUpdate, InsertJobUpdate,
  activities, Activity, InsertActivity,
  workCompleted, WorkCompleted, InsertWorkCompleted,
  labourEntries, LabourEntry, InsertLabourEntry,
  partsUsed, PartUsed, InsertPartUsed,
  jobNotes, JobNote, InsertJobNote,
  jobInternalNotes, JobInternalNote, InsertJobInternalNote,
  jobAttachments, JobAttachment, InsertJobAttachment,
  paymentRequests, PaymentRequest, InsertPaymentRequest,
  jobCounter, JobCounter,
  orderCounter, OrderCounter,
  partsOnOrder, PartOnOrder, InsertPartOnOrder,
  partOrderUpdates, PartOrderUpdate, InsertPartOrderUpdate,
  timeEntries, TimeEntry, InsertTimeEntry,
  businesses, Business, InsertBusiness,
  announcements, Announcement, InsertAnnouncement,
  messages, Message, InsertMessage,
  messageThreads, MessageThread, InsertMessageThread,
  messageThreadParticipants,
  emailHistory, EmailHistory, InsertEmailHistory,
  notifications, Notification, InsertNotification,
  notificationDismissals, NotificationDismissal,
  orders, Order, InsertOrder,
  orderItems, OrderItem, InsertOrderItem,
  orderStatusHistory, OrderStatusHistory, InsertOrderStatusHistory,
  passwordResetCodes, PasswordResetCode, InsertPasswordResetCode
} from "@shared/schema";

import { formatDistanceToNow } from "date-fns";
import { db, pool } from "./db";
import { and, desc, eq, ne, lt, gte, lte, isNull, isNotNull, or, sql, inArray } from "drizzle-orm";

/**
 * Normalize phone number by removing all non-digit characters
 * This allows matching phone numbers regardless of formatting (spaces, dashes, parentheses, etc.)
 */
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

// Interface for storage operations
export interface IStorage {
  // Business operations
  getBusiness(id: number): Promise<Business | undefined>;
  getBusinessByName(name: string): Promise<Business | undefined>;
  createBusiness(business: InsertBusiness): Promise<Business>;
  updateBusiness(id: number, businessData: Partial<InsertBusiness>): Promise<Business | undefined>;
  getAllBusinesses(): Promise<Business[]>;
  getAllBusinessesIncludingInactive(): Promise<Business[]>;
  deleteBusiness(id: number): Promise<boolean>;
  permanentlyDeleteBusiness(id: number): Promise<boolean>;
  
  // User operations
  getUser(id: number, businessId: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>; // Get any user by ID (for cross-business e.g. BoltDown support)
  getUserByUsername(username: string, businessId: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>; // Find user by email (email should be unique)
  getUserByUsernameAcrossAllBusinesses(username: string): Promise<User | undefined>; // Find user by username across all businesses (for login)
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(businessId: number): Promise<User[]>;
  getAllUsersAcrossAllBusinesses(): Promise<User[]>; // Master dashboard only
  getUsersByRole(role: string, businessId: number): Promise<User[]>;
  deactivateUser(id: number): Promise<boolean>;
  
  // Workshop activity operations
  getAllActivities(businessId: number, limit?: number): Promise<Activity[]>;
  getActivityByUser(userId: number, businessId: number, limit?: number): Promise<Activity[]>;
  getActivityByEntity(entityType: string, entityId: number, businessId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  cleanupOldActivities(keepCount: number): Promise<void>;
  
  // Registration operations
  createRegistrationRequest(request: InsertRegistrationRequest): Promise<RegistrationRequest>;
  getRegistrationRequest(id: number): Promise<RegistrationRequest | undefined>;
  getAllRegistrationRequests(businessId: number): Promise<RegistrationRequest[]>;
  getPendingRegistrationRequests(businessId: number): Promise<RegistrationRequest[]>;
  updateRegistrationRequestStatus(id: number, status: string, reviewedBy: number, notes?: string): Promise<RegistrationRequest | undefined>;

  // Customer operations
  getCustomer(id: number, businessId: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string, businessId: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>, businessId: number): Promise<Customer | undefined>;
  deleteCustomer(id: number, businessId: number): Promise<boolean>;
  getAllCustomers(businessId: number, limit?: number, offset?: number): Promise<Customer[]>;
  countAllCustomers(businessId: number): Promise<number>;
  
  // Email history operations
  createEmailHistory(emailHistory: InsertEmailHistory): Promise<EmailHistory>;
  getEmailHistoryByCustomer(customerId: number, businessId: number): Promise<EmailHistory[]>;
  getEmailHistoryByEmail(email: string, businessId: number): Promise<EmailHistory[]>;

  // Equipment type operations removed - table was dropped

  // Equipment operations
  getEquipment(id: number, businessId: number): Promise<Equipment | undefined>;
  getEquipmentByCustomer(customerId: number, businessId: number): Promise<Equipment[]>;
  getEquipmentBySerialNumber(serialNumber: string, businessId: number): Promise<Equipment | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, equipment: InsertEquipment, businessId: number): Promise<Equipment>;
  deleteEquipment(id: number, businessId: number): Promise<boolean>;
  getAllEquipment(businessId: number): Promise<Equipment[]>;

  // Job operations
  generateNextJobId(businessId: number): Promise<string>;
  getJob(id: number, businessId: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<Job>, businessId: number): Promise<Job | undefined>;
  deleteJob(id: number, businessId: number): Promise<boolean>;
  getAllJobs(businessId: number): Promise<Job[]>;
  getActiveJobs(businessId: number): Promise<Job[]>;
  getJobsByCustomerPhone(phone: string, businessId: number): Promise<Job[]>;
  getJobsByCustomerEmail(email: string, businessId: number): Promise<Job[]>;
  
  // Job payment operations
  recordJobPayment(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined>;
  createJobPaymentRequest(jobId: number, requestData: any, createdBy: number): Promise<PaymentRequest>;
  markJobAsPaid(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined>;
  getJobPaymentStatus(jobId: number): Promise<any>;
  completeJobPaymentFromStripe(paymentRequestId: number): Promise<Job | undefined>;

  // Service operations
  getService(id: number, businessId: number): Promise<Service | undefined>;
  getServicesByJob(jobId: number, businessId: number): Promise<Service[]>;
  getServicesByEquipment(equipmentId: number, businessId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: InsertService, businessId: number): Promise<Service>;
  getAllServices(businessId: number): Promise<Service[]>;

  // Task operations
  getTask(id: number, businessId: number): Promise<Task | undefined>;
  getTasksByAssignee(assignedTo: number, businessId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<Task>, businessId: number): Promise<Task | undefined>;
  completeTask(id: number, businessId: number): Promise<Task | undefined>;
  getAllTasks(businessId: number): Promise<Task[]>;
  getPendingTasks(businessId: number): Promise<Task[]>;

  // Job Update operations
  getJobUpdates(jobId: number, businessId: number): Promise<JobUpdate[]>;
  getPublicJobUpdates(jobId: number, businessId: number): Promise<JobUpdate[]>;
  createJobUpdate(updateData: InsertJobUpdate): Promise<JobUpdate>;

  // Callback Request operations
  getCallbackRequest(id: number, businessId: number): Promise<CallbackRequest | undefined>;
  getCallbackRequestsByCustomer(customerId: number, businessId: number): Promise<CallbackRequest[]>;
  getCallbackRequestsByPhone(phoneNumber: string, businessId: number): Promise<CallbackRequest[]>;
  getCallbackRequestsByAssignee(assignedTo: number, businessId: number): Promise<CallbackRequest[]>;
  getPendingCallbackRequests(businessId: number): Promise<CallbackRequest[]>;
  getCompletedCallbackRequests(businessId: number): Promise<CallbackRequest[]>;
  getAllCallbackRequests(businessId: number): Promise<CallbackRequest[]>;
  getDeletedCallbackRequests(businessId: number): Promise<CallbackRequest[]>;
  createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest>;
  updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>, businessId: number): Promise<CallbackRequest | undefined>;
  completeCallbackRequest(id: number, businessId: number, notes?: string): Promise<CallbackRequest | undefined>;
  markCallbackAsDeleted(id: number, businessId: number): Promise<CallbackRequest | undefined>;
  restoreDeletedCallback(id: number, businessId: number): Promise<CallbackRequest | undefined>;
  permanentlyDeleteCallback(id: number, businessId: number): Promise<boolean>;
  purgeExpiredDeletedCallbacks(businessId: number): Promise<number>;

  // Work Completed operations
  getWorkCompletedByJobId(jobId: number, businessId: number): Promise<WorkCompleted[]>;
  createWorkCompleted(workData: InsertWorkCompleted): Promise<WorkCompleted>;
  updateWorkCompleted(id: number, workData: Partial<InsertWorkCompleted>, businessId: number): Promise<WorkCompleted | undefined>;
  deleteWorkCompleted(id: number, businessId: number): Promise<boolean>;

  // Job Sheet operations - Labour Entries
  getLabourEntriesByJobId(jobId: number, businessId: number): Promise<LabourEntry[]>;
  createLabourEntry(labourData: InsertLabourEntry): Promise<LabourEntry>;
  updateLabourEntry(id: number, labourData: Partial<InsertLabourEntry>, businessId: number): Promise<LabourEntry | undefined>;
  deleteLabourEntry(id: number, businessId: number): Promise<boolean>;

  // Job Sheet operations - Parts Used
  getPartsUsedByJobId(jobId: number, businessId: number): Promise<PartUsed[]>;
  createPartUsed(partData: InsertPartUsed): Promise<PartUsed>;
  updatePartUsed(id: number, partData: Partial<InsertPartUsed>, businessId: number): Promise<PartUsed | undefined>;
  deletePartUsed(id: number, businessId: number): Promise<boolean>;

  // Job Sheet operations - Job Notes
  getJobNoteByJobId(jobId: number, businessId: number): Promise<JobNote | undefined>;
  createOrUpdateJobNote(noteData: InsertJobNote): Promise<JobNote>;
  deleteJobNote(jobId: number, businessId: number): Promise<boolean>;

  // Job Sheet operations - Job Internal Notes (multiple timestamped notes per job)
  getJobInternalNotes(jobId: number, businessId: number): Promise<(JobInternalNote & { userName?: string })[]>;
  createJobInternalNote(noteData: InsertJobInternalNote): Promise<JobInternalNote>;
  getInternalNotesCountByJobIds(jobIds: number[], businessId: number): Promise<Record<number, number>>;

  // Job Sheet operations - Job Attachments
  getJobAttachmentsByJobId(jobId: number, businessId: number): Promise<JobAttachment[]>;
  createJobAttachment(attachmentData: InsertJobAttachment): Promise<JobAttachment>;
  deleteJobAttachment(id: number, businessId: number): Promise<boolean>;

  // Payment Request operations
  getPaymentRequest(id: number, businessId: number): Promise<PaymentRequest | undefined>;
  getPaymentRequestByReference(reference: string, businessId: number): Promise<PaymentRequest | undefined>;
  getPaymentRequestsByJob(jobId: number, businessId: number): Promise<PaymentRequest[]>;
  getAllPaymentRequests(businessId: number): Promise<PaymentRequest[]>;
  createPaymentRequest(paymentData: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequest(id: number, paymentData: Partial<PaymentRequest>, businessId: number): Promise<PaymentRequest | undefined>;
  updatePaymentStatus(id: number, status: string, businessId: number, transactionData?: any): Promise<PaymentRequest | undefined>;
 
  // Parts on Order operations
  getPartOnOrder(id: number, businessId: number): Promise<PartOnOrder | undefined>;
  getAllPartsOnOrder(businessId: number): Promise<PartOnOrder[]>;
  getPartsOnOrderByStatus(status: string, businessId: number): Promise<PartOnOrder[]>;
  getOverduePartsOnOrder(businessId: number, daysSinceOrder?: number): Promise<PartOnOrder[]>;
  getPartsOnOrderByJob(jobId: number, businessId: number): Promise<PartOnOrder[]>;
  createPartOnOrder(partData: InsertPartOnOrder): Promise<PartOnOrder>;
  updatePartOnOrder(id: number, partData: Partial<PartOnOrder>, businessId: number): Promise<PartOnOrder | undefined>;
  markPartAsArrived(id: number, updatedBy: number, businessId: number, actualDeliveryDate?: string, actualCost?: number, notes?: string): Promise<PartOnOrder | undefined>;
  markPartAsCollected(id: number, updatedBy: number, businessId: number): Promise<PartOnOrder | undefined>;
  notifyCustomerPartReady(id: number, updatedBy: number, businessId: number): Promise<boolean>;
  
  // Part Order Update operations
  getPartOrderUpdates(partOrderId: number, businessId: number): Promise<PartOrderUpdate[]>;
  createPartOrderUpdate(updateData: InsertPartOrderUpdate): Promise<PartOrderUpdate>;
  
  // Universal Order Management operations
  generateNextOrderNumber(businessId: number): Promise<string>;
  getOrder(id: number, businessId: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string, businessId: number): Promise<Order | undefined>;
  getAllOrders(businessId: number, limit?: number, offset?: number): Promise<Order[]>;
  countAllOrders(businessId: number): Promise<number>;
  getOrdersByStatus(status: string, businessId: number): Promise<Order[]>;
  getOrdersByCustomer(customerId: number, businessId: number): Promise<Order[]>;
  getOrdersByJob(jobId: number, businessId: number): Promise<Order[]>;
  searchOrders(businessId: number, query: string): Promise<Order[]>;
  createOrder(orderData: InsertOrder): Promise<Order>;
  updateOrder(id: number, orderData: Partial<Order>, businessId: number): Promise<Order | undefined>;
  updateOrderStatus(id: number, newStatus: string, changedBy: number, businessId: number, changeReason?: string, notes?: string, metadata?: Record<string, unknown>): Promise<Order | undefined>;
  deleteOrder(id: number, businessId: number): Promise<boolean>;
  
  // Order Items operations
  getOrderItems(orderId: number, businessId: number): Promise<OrderItem[]>;
  getOrderItemsByOrderIds(orderIds: number[], businessId: number): Promise<OrderItem[]>;
  getOrderItem(id: number, businessId: number): Promise<OrderItem | undefined>;
  createOrderItem(itemData: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(id: number, itemData: Partial<OrderItem>, businessId: number): Promise<OrderItem | undefined>;
  deleteOrderItem(id: number, businessId: number): Promise<boolean>;
  deleteOrderItemsByOrder(orderId: number, businessId: number): Promise<boolean>;
  
  // Order Status History operations
  getOrderStatusHistory(orderId: number, businessId: number): Promise<OrderStatusHistory[]>;
  createOrderStatusHistory(historyData: InsertOrderStatusHistory): Promise<OrderStatusHistory>;
  
  // Time Entry operations
  getTimeEntry(id: number, businessId: number): Promise<TimeEntry | undefined>;
  getTimeEntriesByUser(userId: number, businessId: number, startDate?: string, endDate?: string): Promise<TimeEntry[]>;
  getTimeEntriesByJob(jobId: number, businessId: number): Promise<TimeEntry[]>;
  getAllTimeEntries(businessId: number, startDate?: string, endDate?: string): Promise<TimeEntry[]>;
  createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, timeEntry: Partial<InsertTimeEntry>, businessId: number): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number, businessId: number): Promise<boolean>;

  // Announcement operations
  getAnnouncements(includeInactive?: boolean): Promise<Announcement[]>;
  getActiveAnnouncements(audience?: string): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: number): Promise<boolean>;

  // Message operations
  getMessage(id: number, businessId: number): Promise<Message | undefined>;
  getMessagesByUser(userId: number, businessId: number): Promise<Message[]>;
  getConversation(userId1: number, userId2: number, businessId: number): Promise<Message[]>;
  getSupportConversation(masterUserId: number, otherUserId: number): Promise<Message[]>;
  getGroupConversation(threadId: number, userId: number, businessId: number): Promise<Message[]>;
  getAllConversations(userId: number, businessId: number): Promise<Array<{ otherUser: User; lastMessage: Message; unreadCount: number }>>;
  getSupportConversations(masterUserId: number): Promise<Array<{ otherUser: User; lastMessage: Message; unreadCount: number }>>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number, userId: number, businessId: number): Promise<Message | undefined>;
  markConversationAsRead(userId: number, otherUserId: number, businessId: number): Promise<number>;
  markGroupConversationAsRead(threadId: number, userId: number, businessId: number): Promise<number>;
  deleteMessage(id: number, userId: number, businessId: number): Promise<boolean>;
  deleteOldMessages(monthsOld: number): Promise<number>;
  // Thread/Group operations
  createThread(thread: InsertMessageThread, participantIds: number[]): Promise<MessageThread>;
  getThread(threadId: number, businessId: number): Promise<MessageThread | undefined>;
  updateThread(threadId: number, businessId: number, data: Partial<InsertMessageThread>): Promise<MessageThread | undefined>;
  getThreadParticipants(threadId: number, businessId: number): Promise<User[]>;
  getUserThreads(userId: number, businessId: number): Promise<Array<{ thread: MessageThread; participants: User[]; lastMessage: Message; unreadCount: number }>>;
  
  // Password Reset Code operations
  createPasswordResetCode(resetData: InsertPasswordResetCode): Promise<PasswordResetCode>;
  getPasswordResetCode(code: string): Promise<PasswordResetCode | undefined>;
  markPasswordResetCodeAsUsed(code: string): Promise<boolean>;
  deleteExpiredPasswordResetCodes(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Business operations
  async getBusiness(id: number): Promise<Business | undefined> {
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
    return business;
  }

  async getBusinessByName(name: string): Promise<Business | undefined> {
    const [business] = await db.select().from(businesses).where(eq(businesses.name, name));
    return business;
  }

  async createBusiness(businessData: InsertBusiness): Promise<Business> {
    const [business] = await db.insert(businesses).values({
      ...businessData,
      createdAt: new Date().toISOString(),
      isActive: true
    }).returning();
    return business;
  }

  async updateBusiness(id: number, businessData: Partial<InsertBusiness>): Promise<Business | undefined> {
    const [business] = await db
      .update(businesses)
      .set({
        ...businessData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(businesses.id, id))
      .returning();
    return business;
  }

  async getAllBusinesses(): Promise<Business[]> {
    return await db.select().from(businesses).where(eq(businesses.isActive, true));
  }

  async getAllBusinessesIncludingInactive(): Promise<Business[]> {
    return await db.select().from(businesses).orderBy(desc(businesses.createdAt));
  }

  async deleteBusiness(id: number): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [business] = await db
      .update(businesses)
      .set({ 
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(businesses.id, id))
      .returning();
    return !!business;
  }

  async permanentlyDeleteBusiness(id: number): Promise<boolean> {
    // Hard delete - remove all associated data and the business itself
    // Delete in order to respect foreign key constraints
    // Wrap everything in a transaction for atomicity
    
    // First, check which tables exist in the database to avoid transaction abort errors
    const checkTableExists = async (tableName: string): Promise<boolean> => {
      try {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [tableName]
        );
        return result.rows[0]?.exists === true;
      } catch {
        return false;
      }
    };
    
    // Check which optional tables exist
    const tablesExist = await Promise.all([
      checkTableExists('message_threads'),
      checkTableExists('message_thread_participants'),
      checkTableExists('messages'),
      checkTableExists('notification_dismissals'),
      checkTableExists('notifications'),
      checkTableExists('email_history'),
    ]);
    
    const [
      messageThreadsExists,
      messageThreadParticipantsExists,
      messagesExists,
      notificationDismissalsExists,
      notificationsExists,
      emailHistoryExists,
    ] = tablesExist;
    
    return await db.transaction(async (tx) => {
      try {
      // Get all users for this business first (needed for deleting related records)
      const businessUsers = await tx.select().from(users).where(eq(users.businessId, id));
      const userIds = businessUsers.map(u => u.id);
      
      // Get all message threads for this business (if table exists)
      let threadIds: number[] = [];
      if (messageThreadsExists) {
        const businessThreads = await tx.select().from(messageThreads).where(eq(messageThreads.businessId, id));
        threadIds = businessThreads.map(t => t.id);
      }
      
      // Delete child records first (in reverse dependency order)
      // Delete message thread participants (via threadId)
      if (threadIds.length > 0 && messageThreadParticipantsExists) {
        await tx.delete(messageThreadParticipants).where(inArray(messageThreadParticipants.threadId, threadIds));
      }
      
      // Delete messages
      if (messagesExists) {
        await tx.delete(messages).where(eq(messages.businessId, id));
      }
      
      // Delete message threads
      if (messageThreadsExists) {
        await tx.delete(messageThreads).where(eq(messageThreads.businessId, id));
      }
      
      // Delete notification dismissals (by businessId)
      if (notificationDismissalsExists) {
        await tx.delete(notificationDismissals).where(eq(notificationDismissals.businessId, id));
      }
      
      // Delete notifications
      if (notificationsExists) {
        await tx.delete(notifications).where(eq(notifications.businessId, id));
      }
      
      // Delete email history
      if (emailHistoryExists) {
        await tx.delete(emailHistory).where(eq(emailHistory.businessId, id));
      }
      
      // Get parts on order IDs first (needed for deleting part order updates that reference them)
      const partsOnOrderRecords = await tx.select({ id: partsOnOrder.id }).from(partsOnOrder).where(eq(partsOnOrder.businessId, id));
      const partOrderIds = partsOnOrderRecords.map(p => p.id);
      
      // Delete part order updates (by partOrderId to respect foreign key relationships)
      if (partOrderIds.length > 0) {
        await tx.delete(partOrderUpdates).where(inArray(partOrderUpdates.partOrderId, partOrderIds));
      }
      // Also delete any remaining part order updates by businessId (in case there are orphaned records)
      await tx.delete(partOrderUpdates).where(eq(partOrderUpdates.businessId, id));
      
      // Delete parts on order
      await tx.delete(partsOnOrder).where(eq(partsOnOrder.businessId, id));
      
      // Delete time entries
      await tx.delete(timeEntries).where(eq(timeEntries.businessId, id));
      
      // Delete payment requests
      await tx.delete(paymentRequests).where(eq(paymentRequests.businessId, id));
      
      // Delete work completed
      await tx.delete(workCompleted).where(eq(workCompleted.businessId, id));
      
      // Delete activities
      await tx.delete(activities).where(eq(activities.businessId, id));
      
      // Delete job updates
      await tx.delete(jobUpdates).where(eq(jobUpdates.businessId, id));
      
      // Delete callback requests
      await tx.delete(callbackRequests).where(eq(callbackRequests.businessId, id));
      
      // Delete tasks
      await tx.delete(tasks).where(eq(tasks.businessId, id));
      
      // Delete services
      await tx.delete(services).where(eq(services.businessId, id));
      
      // Delete jobs
      await tx.delete(jobs).where(eq(jobs.businessId, id));
      
      // Delete equipment
      await tx.delete(equipment).where(eq(equipment.businessId, id));
      
      // Delete customers
      await tx.delete(customers).where(eq(customers.businessId, id));
      
      // Delete registration requests
      await tx.delete(registrationRequests).where(eq(registrationRequests.businessId, id));
      
      // Delete users
      await tx.delete(users).where(eq(users.businessId, id));
      
      // Delete job counter
      await tx.delete(jobCounter).where(eq(jobCounter.businessId, id));
      
      // Delete orders (order_items and order_status_history have FKs to orders)
      const businessOrderIds = (await tx.select({ id: orders.id }).from(orders).where(eq(orders.businessId, id))).map(r => r.id);
      if (businessOrderIds.length > 0) {
        await tx.delete(orderItems).where(inArray(orderItems.orderId, businessOrderIds));
        await tx.delete(orderStatusHistory).where(inArray(orderStatusHistory.orderId, businessOrderIds));
      }
      await tx.delete(orders).where(eq(orders.businessId, id));
      
      // Delete order counter
      await tx.delete(orderCounter).where(eq(orderCounter.businessId, id));
      
      // Finally, delete the business itself
      const [deleted] = await tx.delete(businesses).where(eq(businesses.id, id)).returning();
      return !!deleted;
      } catch (error: any) {
        console.error("Error in permanentlyDeleteBusiness transaction:", error);
        console.error("Error message:", error?.message);
        console.error("Error code:", error?.code);
        console.error("Error detail:", error?.detail);
        throw error;
      }
    });
  }

  // User operations
  async getUser(id: number, businessId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.id, id), eq(users.businessId, businessId))
    );
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? undefined;
  }

  async getUserByUsername(username: string, businessId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.businessId, businessId))
    );
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Find user by email - email should be unique across all businesses
    // If email exists in multiple businesses, return the first active one
    const [user] = await db.select().from(users).where(
      and(eq(users.email, email), eq(users.isActive, true))
    ).limit(1);
    return user;
  }

  async getUserByUsernameAcrossAllBusinesses(username: string): Promise<User | undefined> {
    // Find user by username across all businesses (for login purposes)
    // Usernames are unique per business, but we need to search all businesses at login time
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.isActive, true))
    ).limit(1);
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    }).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(businessId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.businessId, businessId),
        eq(users.isActive, true)
      )
    );
  }

  async getAllUsersAcrossAllBusinesses(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByRole(role: string, businessId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.role, role),
        eq(users.businessId, businessId),
        eq(users.isActive, true)
      )
    );
  }

  async deactivateUser(id: number): Promise<boolean> {
    // Never allow master users to be deactivated at the storage layer
    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      return false;
    }
    if (existing.role === "master") {
      // Silently refuse at this layer – controllers add user-facing messaging
      return false;
    }

    const [user] = await db
      .update(users)
      .set({ 
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, id))
      .returning();
    return !!user;
  }

  // Registration operations
  async createRegistrationRequest(requestData: InsertRegistrationRequest): Promise<RegistrationRequest> {
    const [request] = await db.insert(registrationRequests).values({
      ...requestData,
      status: 'pending'
    }).returning();
    return request;
  }

  async getRegistrationRequest(id: number): Promise<RegistrationRequest | undefined> {
    const [request] = await db.select().from(registrationRequests).where(eq(registrationRequests.id, id));
    return request;
  }

  async getAllRegistrationRequests(businessId: number): Promise<RegistrationRequest[]> {
    return await db.select().from(registrationRequests)
      .where(eq(registrationRequests.businessId, businessId))
      .orderBy(desc(registrationRequests.createdAt));
  }

  async getPendingRegistrationRequests(businessId: number): Promise<RegistrationRequest[]> {
    return await db.select().from(registrationRequests)
      .where(
        and(
          eq(registrationRequests.status, 'pending'),
          eq(registrationRequests.businessId, businessId)
        )
      )
      .orderBy(desc(registrationRequests.createdAt));
  }

  async updateRegistrationRequestStatus(id: number, status: string, reviewedBy: number, notes?: string): Promise<RegistrationRequest | undefined> {
    const [request] = await db
      .update(registrationRequests)
      .set({
        status,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        notes: notes || null
      })
      .where(eq(registrationRequests.id, id))
      .returning();
    return request;
  }

  // Customer operations
  async getCustomer(id: number, businessId: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(
      and(eq(customers.id, id), eq(customers.businessId, businessId))
    );
    return customer;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>, businessId: number): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set(customerData)
      .where(
        and(eq(customers.id, id), eq(customers.businessId, businessId))
      )
      .returning();
    return customer;
  }

  async deleteCustomer(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(customers)
      .where(
        and(eq(customers.id, id), eq(customers.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  async getAllCustomers(businessId: number, limit?: number, offset?: number): Promise<Customer[]> {
    const baseQuery = db.select().from(customers).where(eq(customers.businessId, businessId));
    
    if (offset !== undefined && limit !== undefined) {
      return await baseQuery.offset(offset).limit(limit);
    } else if (limit !== undefined) {
      return await baseQuery.limit(limit);
    } else if (offset !== undefined) {
      return await baseQuery.offset(offset);
    }
    
    return await baseQuery;
  }

  async countAllCustomers(businessId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(eq(customers.businessId, businessId));
    
    return result[0]?.count ?? 0;
  }

  async getCustomerByEmail(email: string, businessId: number): Promise<Customer | undefined> {
    // Use case-insensitive matching for email
    const [customer] = await db.select().from(customers).where(
      and(
        sql`LOWER(${customers.email}) = LOWER(${email})`,
        eq(customers.businessId, businessId)
      )
    );
    return customer;
  }

  // Email history operations
  async createEmailHistory(emailHistoryData: InsertEmailHistory): Promise<EmailHistory> {
    const [history] = await db.insert(emailHistory).values(emailHistoryData).returning();
    return history;
  }

  async getEmailHistoryByCustomer(customerId: number, businessId: number): Promise<EmailHistory[]> {
    return await db.select().from(emailHistory)
      .where(and(eq(emailHistory.customerId, customerId), eq(emailHistory.businessId, businessId)))
      .orderBy(desc(emailHistory.sentAt));
  }

  async getEmailHistoryByEmail(email: string, businessId: number): Promise<EmailHistory[]> {
    // Use case-insensitive matching for email
    return await db.select().from(emailHistory)
      .where(and(
        sql`LOWER(${emailHistory.customerEmail}) = LOWER(${email})`,
        eq(emailHistory.businessId, businessId)
      ))
      .orderBy(desc(emailHistory.sentAt));
  }

  // Equipment type operations removed - table was dropped

  // Equipment operations
  async getEquipment(id: number, businessId: number): Promise<Equipment | undefined> {
    const [equipmentItem] = await db.select().from(equipment).where(
      and(eq(equipment.id, id), eq(equipment.businessId, businessId))
    );
    return equipmentItem;
  }

  async getEquipmentByCustomer(customerId: number, businessId: number): Promise<Equipment[]> {
    return await db.select().from(equipment).where(
      and(eq(equipment.customerId, customerId), eq(equipment.businessId, businessId))
    );
  }

  async getEquipmentBySerialNumber(serialNumber: string, businessId: number): Promise<Equipment | undefined> {
    const [equipmentItem] = await db.select().from(equipment).where(
      and(eq(equipment.serialNumber, serialNumber), eq(equipment.businessId, businessId))
    );
    return equipmentItem;
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: InsertEquipment, businessId: number): Promise<Equipment> {
    const [updatedEquipment] = await db
      .update(equipment)
      .set(equipmentData)
      .where(
        and(eq(equipment.id, id), eq(equipment.businessId, businessId))
      )
      .returning();
    return updatedEquipment;
  }

  async deleteEquipment(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(equipment)
      .where(
        and(eq(equipment.id, id), eq(equipment.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  async getAllEquipment(businessId: number): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.businessId, businessId));
  }

  // Job operations
  async generateNextJobId(businessId: number): Promise<string> {
    try {
      // Use a transaction to ensure atomic increment
      const result = await db.transaction(async (tx) => {
        // Get current counter for this business or create one if it doesn't exist
        let [counter] = await tx.select().from(jobCounter).where(eq(jobCounter.businessId, businessId));
        
        if (!counter) {
          // Initialize counter if it doesn't exist
          [counter] = await tx.insert(jobCounter).values({
            businessId: businessId,
            currentNumber: 999,
            updatedAt: new Date().toISOString()
          }).returning();
        }
        
        // Increment the counter
        const newNumber = counter.currentNumber + 1;
        
        // Update the counter
        await tx.update(jobCounter)
          .set({
            currentNumber: newNumber,
            updatedAt: new Date().toISOString()
          })
          .where(eq(jobCounter.id, counter.id));
        
        // Include business ID prefix to differentiate between businesses
        // Format: B{businessId}-WS-{number}
        return `B${businessId}-WS-${newNumber}`;
      });
      
      return result;
    } catch (error) {
      console.error("Error generating job ID:", error);
      // Fallback to timestamp-based ID if database operation fails
      // Still include business ID prefix even in fallback
      const timestamp = Date.now().toString().slice(-4);
      return `B${businessId}-WS-1${timestamp}`;
    }
  }

  async getJob(id: number, businessId: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(
      and(eq(jobs.id, id), eq(jobs.businessId, businessId))
    );
    
    if (job) {
      if (job.customerId) {
        // Fetch customer data to include in the job response
        const customer = await this.getCustomer(job.customerId, businessId);
        if (customer) {
          // Add customer data to the job object
          (job as any).customerName = customer.name;
          (job as any).customerEmail = customer.email || "";
          (job as any).customerPhone = customer.phone || "";
          (job as any).customerAddress = customer.address || "";
        }
      } else if ((job as any).customerName) {
        // Name-only mode: customer data is stored directly on the job
        // Ensure customerEmail, customerPhone, and customerAddress are included (they may be null)
        (job as any).customerEmail = (job as any).customerEmail || "";
        (job as any).customerPhone = (job as any).customerPhone || "";
        (job as any).customerAddress = (job as any).customerAddress || "";
      }
    }
    
    return job;
  }
  
    async createJob(jobData: InsertJob): Promise<Job> {
      console.log(`[Storage] createJob - Received jobData:`, JSON.stringify(jobData, null, 2));
      const businessId = (jobData as any).businessId;
      console.log(`[Storage] createJob - businessId: ${businessId}, type: ${typeof businessId}`);
      
      if (!businessId) {
        throw new Error("businessId is required when creating a job");
      }

      // Ensure jobId is generated if not provided, or validate uniqueness if provided
      let finalJobId = jobData.jobId;
      if (!finalJobId) {
        // Generate a new job ID
        finalJobId = await this.generateNextJobId(businessId);
      } else {
        // Validate that the provided jobId doesn't already exist for this business
        const existingJob = await db.select().from(jobs).where(
          and(eq(jobs.jobId, finalJobId), eq(jobs.businessId, businessId))
        ).limit(1);
        
        if (existingJob.length > 0) {
          // If duplicate found, generate a new one
          console.warn(`[Storage] createJob - Duplicate jobId ${finalJobId} detected for business ${businessId}, generating new ID`);
          finalJobId = await this.generateNextJobId(businessId);
        } else {
          // If a custom jobId is provided, ensure the counter is at least as high
          // Extract the number from the jobId format: B{businessId}-WS-{number}
          const jobIdMatch = finalJobId.match(/^B(\d+)-WS-(\d+)$/);
          if (jobIdMatch) {
            const jobIdBusinessId = parseInt(jobIdMatch[1], 10);
            const providedNumber = parseInt(jobIdMatch[2], 10);
            
            // Validate that the businessId in the jobId matches the current business
            if (jobIdBusinessId !== businessId) {
              console.warn(`[Storage] createJob - JobId businessId (${jobIdBusinessId}) doesn't match current businessId (${businessId}), generating new ID`);
              finalJobId = await this.generateNextJobId(businessId);
            } else {
              // Update counter if the provided number is higher than current counter
              // This ensures sequential IDs even if a custom jobId is provided
              await db.transaction(async (tx) => {
                let [counter] = await tx.select().from(jobCounter).where(eq(jobCounter.businessId, businessId));
                
                if (!counter) {
                  [counter] = await tx.insert(jobCounter).values({
                    businessId: businessId,
                    currentNumber: providedNumber,
                    updatedAt: new Date().toISOString()
                  }).returning();
                } else if (counter.currentNumber < providedNumber) {
                  // Update counter to match or exceed the provided number
                  // This keeps the counter in sync for sequential generation
                  await tx.update(jobCounter)
                    .set({
                      currentNumber: providedNumber,
                      updatedAt: new Date().toISOString()
                    })
                    .where(eq(jobCounter.id, counter.id));
                }
              });
            }
          }
        }
      }

      let finalCustomerId = jobData.customerId;

      // Only auto-create customer if we have customerName but no customerId AND we're not in name-only mode
      // Name-only mode is indicated by having customerName + customerEmail + customerPhone but no customerId
      // If email/phone are provided without customerId, assume name-only mode (don't create customer)
      const isNameOnlyMode = !finalCustomerId && jobData.customerName && 
                             (jobData.customerEmail || jobData.customerPhone);
      
      if (!finalCustomerId && jobData.customerName && !isNameOnlyMode) {
        // Get businessId from jobData (should be set by caller)
        const jobBusinessId = (jobData as any).businessId;
        if (!jobBusinessId) {
          throw new Error("businessId is required when creating a job");
        }

        const existingCustomers = await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.name, jobData.customerName),
              eq(customers.businessId, jobBusinessId)
            )
          );

        if (existingCustomers.length > 0) {
          finalCustomerId = existingCustomers[0].id;
        } else {
          // Create new customer with provided email/phone/address
          const newCustomer = await this.createCustomer({
            businessId: jobBusinessId,
            name: jobData.customerName,
            email: jobData.customerEmail || undefined,
            phone: jobData.customerPhone || undefined,
            address: (jobData as any).customerAddress || undefined,
          });
          finalCustomerId = newCustomer.id;
        }
      }

      const jobInsertData = {
        ...jobData,
        jobId: finalJobId, // Use the validated/generated jobId
        customerId: finalCustomerId || null,
        status: jobData.status || (jobData.assignedTo ? "in_progress" : "waiting_assessment"),
      };

      const cleanJobData = Object.fromEntries(
        Object.entries(jobInsertData).filter(([_, value]) => value !== undefined)
      );

      console.log(`[Storage] createJob - cleanJobData before insert:`, JSON.stringify(cleanJobData, null, 2));
      console.log(`[Storage] createJob - businessId in cleanJobData: ${(cleanJobData as any).businessId}`);

      // Double-check uniqueness before inserting to prevent race conditions
      // This is an additional safety check beyond the database constraint
      let attempts = 0;
      const maxAttempts = 3;
      let currentJobId = finalJobId;
      
      while (attempts < maxAttempts) {
        // Check if this jobId already exists for this business
        const existingJob = await db.select().from(jobs).where(
          and(eq(jobs.jobId, currentJobId), eq(jobs.businessId, businessId))
        ).limit(1);
        
        if (existingJob.length > 0) {
          // Job ID already exists, generate a new one
          console.warn(`[Storage] createJob - JobId ${currentJobId} already exists for business ${businessId}, generating new ID (attempt ${attempts + 1})`);
          currentJobId = await this.generateNextJobId(businessId);
          attempts++;
          continue;
        }
        
        // Job ID is unique, proceed with insert
        try {
          const insertData = { ...cleanJobData, jobId: currentJobId };
          const [job] = await db.insert(jobs).values(insertData as any).returning();
          console.log(`[Storage] createJob - Created job with id: ${job.id}, jobId: ${job.jobId}, businessId: ${job.businessId}`);
          
          // Enhance job with customer data before returning (similar to getJob)
          if (job.customerId) {
            try {
              const customer = await this.getCustomer(job.customerId, businessId);
              if (customer) {
                (job as any).customerName = customer.name;
                (job as any).customerEmail = customer.email || "";
                (job as any).customerPhone = customer.phone || "";
                (job as any).customerAddress = customer.address || "";
              }
            } catch (error) {
              console.error(`[Storage] createJob - Error fetching customer ${job.customerId} for job ${job.id}:`, error);
              // Continue without customer data if fetch fails
            }
          } else if ((job as any).customerName) {
            // Name-only mode: customer data is stored directly on the job
            // Ensure customerEmail, customerPhone, and customerAddress are included (they may be null)
            (job as any).customerEmail = (job as any).customerEmail || "";
            (job as any).customerPhone = (job as any).customerPhone || "";
            (job as any).customerAddress = (job as any).customerAddress || "";
          }
          
          return job;
        } catch (error: any) {
          // Handle unique constraint violation (database-level check)
          if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('duplicate')) {
            console.warn(`[Storage] createJob - Unique constraint violation for jobId ${currentJobId}, generating new ID and retrying (attempt ${attempts + 1})`);
            currentJobId = await this.generateNextJobId(businessId);
            attempts++;
            continue;
          }
          throw error;
        }
      }
      
      // If we've exhausted all attempts, throw an error
      throw new Error(`Failed to create job after ${maxAttempts} attempts due to duplicate job IDs`);
    }

  async updateJob(id: number, jobData: Partial<Job>, businessId: number): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({
        ...jobData,
        updatedAt: jobData.updatedAt || new Date().toISOString(),
      })
      .where(
        and(eq(jobs.id, id), eq(jobs.businessId, businessId))
      )
      .returning();
    
    if (job) {
      // Enhance job with customer data before returning (similar to getJob)
      if (job.customerId) {
        try {
          const customer = await this.getCustomer(job.customerId, businessId);
          if (customer) {
            (job as any).customerName = customer.name;
            (job as any).customerEmail = customer.email || "";
            (job as any).customerPhone = customer.phone || "";
            (job as any).customerAddress = customer.address || "";
          }
        } catch (error) {
          console.error(`[Storage] updateJob - Error fetching customer ${job.customerId} for job ${job.id}:`, error);
          // Continue without customer data if fetch fails
        }
      } else if ((job as any).customerName) {
        // Name-only mode: customer data is stored directly on the job
        // Ensure customerEmail, customerPhone, and customerAddress are included (they may be null)
        (job as any).customerEmail = (job as any).customerEmail || "";
        (job as any).customerPhone = (job as any).customerPhone || "";
        (job as any).customerAddress = (job as any).customerAddress || "";
      }
    }
    
    return job;
  }

  async deleteJob(id: number, businessId: number): Promise<boolean> {
    try {
      // First delete related services
      await db.delete(services).where(
        and(eq(services.jobId, id), eq(services.businessId, businessId))
      );
      
      // Then delete related payment requests
      await db.delete(paymentRequests).where(
        and(eq(paymentRequests.jobId, id), eq(paymentRequests.businessId, businessId))
      );
      
      // Delete related work completed records
      await db.delete(workCompleted).where(
        and(eq(workCompleted.jobId, id), eq(workCompleted.businessId, businessId))
      );
      
      // Delete related activities
      await db.delete(activities).where(
        and(
          eq(activities.entityType, 'job'),
          eq(activities.entityId, id),
          eq(activities.businessId, businessId)
        )
      );
      
      // Finally delete the job itself
      const deletedJobs = await db.delete(jobs).where(
        and(eq(jobs.id, id), eq(jobs.businessId, businessId))
      ).returning();
      
      return deletedJobs.length > 0;
    } catch (error) {
      console.error("Error deleting job:", error);
      throw error;
    }
  }

  async getAllJobs(businessId: number): Promise<Job[]> {
    console.log(`[Storage] getAllJobs - Fetching jobs for businessId: ${businessId}, type: ${typeof businessId}`);
    const allJobs = await db.select().from(jobs)
      .where(eq(jobs.businessId, businessId))
      .orderBy(desc(jobs.createdAt));
    
    console.log(`[Storage] getAllJobs - Found ${allJobs.length} jobs for businessId: ${businessId}`);
    if (allJobs.length > 0) {
      console.log(`[Storage] getAllJobs - Sample job IDs:`, allJobs.slice(0, 3).map(j => ({ id: j.id, jobId: j.jobId, businessId: j.businessId })));
    }
    
    // Enhance each job with customer data
    const enhancedJobs = await Promise.all(allJobs.map(async (job) => {
      if (job.customerId) {
        try {
          const customer = await this.getCustomer(job.customerId, businessId);
          if (customer) {
            (job as any).customerName = customer.name;
            (job as any).customerEmail = customer.email || "";
            (job as any).customerPhone = customer.phone || "";
            (job as any).customerAddress = customer.address || "";
          }
        } catch (error) {
          console.error(`[Storage] getAllJobs - Error fetching customer ${job.customerId} for job ${job.id}:`, error);
          // Continue without customer data if fetch fails
        }
      } else if ((job as any).customerName) {
        // Name-only mode: customer data is stored directly on the job
        // Ensure customerEmail, customerPhone, and customerAddress are included (they may be null)
        (job as any).customerEmail = (job as any).customerEmail || "";
        (job as any).customerPhone = (job as any).customerPhone || "";
        (job as any).customerAddress = (job as any).customerAddress || "";
      }
      return job;
    }));
    
    return enhancedJobs;
  }

  async getActiveJobs(businessId: number): Promise<Job[]> {
    return await db.select().from(jobs).where(
      and(
        eq(jobs.businessId, businessId),
        ne(jobs.status, 'completed'),
        ne(jobs.status, 'cancelled')
      )
    );
  }

  async getJobsByCustomerPhone(phone: string, businessId: number): Promise<Job[]> {
    // Normalize the input phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return [];
    }
    
    // Get all customers with this phone number (using normalized comparison)
    // We need to normalize phone numbers in the database for comparison
    const allCustomers = await db.select().from(customers).where(
      eq(customers.businessId, businessId)
    );
    
    // Filter customers by normalized phone number
    const customersWithPhone = allCustomers.filter(c => 
      normalizePhoneNumber(c.phone) === normalizedPhone
    );
    
    if (customersWithPhone.length === 0) {
      return [];
    }
    
    const customerIds = customersWithPhone.map(c => c.id);
    
    // Get all jobs for these customers
    return await db.select().from(jobs).where(
      and(
        eq(jobs.businessId, businessId),
        inArray(jobs.customerId, customerIds)
      )
    ).orderBy(desc(jobs.createdAt));
  }

  async getJobsByCustomerEmail(email: string, businessId: number): Promise<Job[]> {
    // Get all customers with this email
    const customersWithEmail = await db.select().from(customers).where(
      and(eq(customers.businessId, businessId), eq(customers.email, email))
    );
    
    if (customersWithEmail.length === 0) {
      return [];
    }
    
    const customerIds = customersWithEmail.map(c => c.id);
    
    // Get all jobs for these customers
    return await db.select().from(jobs).where(
      and(
        eq(jobs.businessId, businessId),
        inArray(jobs.customerId, customerIds)
      )
    ).orderBy(desc(jobs.createdAt));
  }

  // Service operations
  async getService(id: number, businessId: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(
      and(eq(services.id, id), eq(services.businessId, businessId))
    );
    return service;
  }

  async getServicesByJob(jobId: number, businessId: number): Promise<Service[]> {
    return await db.select().from(services).where(
      and(eq(services.jobId, jobId), eq(services.businessId, businessId))
    );
  }

  async getServicesByEquipment(equipmentId: number, businessId: number): Promise<Service[]> {
    // First get all jobs for this equipment in this business
    const equipmentJobs = await db.select().from(jobs).where(
      and(eq(jobs.equipmentId, equipmentId), eq(jobs.businessId, businessId))
    );
    const jobIds = equipmentJobs.map(job => job.id);
    
    if (jobIds.length === 0) return [];
    
    return await db.select().from(services).where(
      and(
        sql`${services.jobId} IN (${jobIds.join(',')})`,
        eq(services.businessId, businessId)
      )
    );
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values({
      ...serviceData,
      performedAt: serviceData.performedAt || new Date().toISOString()
    }).returning();
    
    return service;
  }

  async updateService(id: number, serviceData: InsertService, businessId: number): Promise<Service> {
    const [service] = await db
      .update(services)
      .set(serviceData)
      .where(
        and(eq(services.id, id), eq(services.businessId, businessId))
      )
      .returning();
    return service;
  }

  async getAllServices(businessId: number): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.businessId, businessId));
  }

  // Task operations
  async getTask(id: number, businessId: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(
      and(eq(tasks.id, id), eq(tasks.businessId, businessId))
    );
    return task;
  }

  async getTasksByAssignee(assignedTo: number, businessId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(eq(tasks.assignedTo, assignedTo), eq(tasks.businessId, businessId))
    );
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    console.log("[Storage] createTask - Input data:", JSON.stringify(taskData, null, 2));
    
    const result = await db.insert(tasks).values({
      ...taskData,
      createdAt: new Date().toISOString()
    }).returning();
    
    console.log("[Storage] createTask - Insert result:", result ? `${result.length} row(s) returned` : "null result");
    
    if (!result || result.length === 0) {
      console.error("[Storage] createTask - Failed: database insert returned no rows");
      throw new Error("Failed to create task: database insert returned no rows");
    }
    
    const task = result[0];
    if (!task) {
      console.error("[Storage] createTask - Failed: database insert returned undefined");
      throw new Error("Failed to create task: database insert returned undefined");
    }
    
    console.log("[Storage] createTask - Success: Created task with ID:", task.id);
    return task;
  }

  async updateTask(id: number, taskData: Partial<Task>, businessId: number): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set(taskData)
      .where(
        and(eq(tasks.id, id), eq(tasks.businessId, businessId))
      )
      .returning();
    return task;
  }

  async completeTask(id: number, businessId: number): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      .where(
        and(eq(tasks.id, id), eq(tasks.businessId, businessId))
      )
      .returning();
    return task;
  }

  async getAllTasks(businessId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.businessId, businessId));
  }

  async getPendingTasks(businessId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(
        eq(tasks.businessId, businessId),
        ne(tasks.status, 'completed'),
        isNotNull(tasks.assignedTo)
      )
    );
  }

  // Activity operations
  async getAllActivities(businessId: number, limit: number = 50): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.businessId, businessId))
      .orderBy(desc(activities.timestamp))
      .limit(limit);
  }

  async getActivityByUser(userId: number, businessId: number, limit: number = 50): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(
        and(eq(activities.userId, userId), eq(activities.businessId, businessId))
      )
      .orderBy(desc(activities.timestamp))
      .limit(limit);
  }

  async getActivityByEntity(entityType: string, entityId: number, businessId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.entityType, entityType),
          eq(activities.entityId, entityId),
          eq(activities.businessId, businessId)
        )
      )
      .orderBy(desc(activities.timestamp));
  }

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const { metadata, ...rest } = activityData;
    const normalisedMetadata =
      metadata == null
        ? null
        : typeof metadata === 'object'
          ? metadata as Record<string, unknown>
          : { value: metadata };
    const [activity] = await db.insert(activities).values({
      ...rest,
      metadata: normalisedMetadata,
      timestamp: new Date().toISOString()
    }).returning();
    return activity;
  }

  async cleanupOldActivities(keepCount: number): Promise<void> {
    try {
      // Get all activities ordered by timestamp desc to find the cutoff ID
      const allActivities = await db
        .select({ id: activities.id })
        .from(activities)
        .orderBy(desc(activities.timestamp));
      
      // If we have more activities than we want to keep, delete the old ones
      if (allActivities.length > keepCount) {
        const cutoffId = allActivities[keepCount - 1].id;
        
        // Delete activities older than the cutoff
        await db
          .delete(activities)
          .where(lt(activities.id, cutoffId));
        
        console.log(`Cleaned up old activities, keeping ${keepCount} most recent`);
      }
    } catch (error) {
      console.error("Error cleaning up old activities:", error);
    }
  }

  // Job Update operations
  async getJobUpdates(jobId: number, businessId: number): Promise<JobUpdate[]> {
    try {
      return await db
        .select()
        .from(jobUpdates)
        .where(
          and(eq(jobUpdates.jobId, jobId), eq(jobUpdates.businessId, businessId))
        )
        .orderBy(desc(jobUpdates.createdAt));
    } catch (error) {
      console.error("Error getting job updates:", error);
      return [];
    }
  }

  async getPublicJobUpdates(jobId: number, businessId: number): Promise<JobUpdate[]> {
    try {
      return await db
        .select()
        .from(jobUpdates)
        .where(and(
          eq(jobUpdates.jobId, jobId),
          eq(jobUpdates.businessId, businessId),
          eq(jobUpdates.isPublic, true)
        ))
        .orderBy(desc(jobUpdates.createdAt));
    } catch (error) {
      console.error("Error getting public job updates:", error);
      return [];
    }
  }

  async createJobUpdate(updateData: InsertJobUpdate): Promise<JobUpdate> {
    try {
      const [jobUpdate] = await db
        .insert(jobUpdates)
        .values({
          ...updateData,
          createdAt: new Date().toISOString()
        })
        .returning();
      
      return jobUpdate;
    } catch (error) {
      console.error("Error creating job update:", error);
      throw error;
    }
  }

  // Callback Request operations
  async getCallbackRequest(id: number, businessId: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db.select().from(callbackRequests).where(
      and(eq(callbackRequests.id, id), eq(callbackRequests.businessId, businessId))
    );
    return callback;
  }

  async getCallbackRequestsByCustomer(customerId: number, businessId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(
        and(eq(callbackRequests.customerId, customerId), eq(callbackRequests.businessId, businessId))
      )
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getCallbackRequestsByPhone(phoneNumber: string, businessId: number): Promise<CallbackRequest[]> {
    // Normalize the input phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      return [];
    }
    
    // Get all callbacks for this business
    const allCallbacks = await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.businessId, businessId));
    
    // Filter callbacks by normalized phone number
    const matchingCallbacks = allCallbacks.filter(cb =>
      normalizePhoneNumber(cb.phoneNumber) === normalizedPhone
    );
    
    // Sort by requestedAt descending
    return matchingCallbacks.sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  async getCallbackRequestsByAssignee(assignedTo: number, businessId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(
        and(eq(callbackRequests.assignedTo, assignedTo), eq(callbackRequests.businessId, businessId))
      )
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getPendingCallbackRequests(businessId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(
        and(eq(callbackRequests.status, 'pending'), eq(callbackRequests.businessId, businessId))
      )
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getCompletedCallbackRequests(businessId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(
        and(eq(callbackRequests.status, 'completed'), eq(callbackRequests.businessId, businessId))
      )
      .orderBy(desc(callbackRequests.completedAt));
  }

  async getAllCallbackRequests(businessId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(
        and(ne(callbackRequests.status, 'deleted'), eq(callbackRequests.businessId, businessId))
      )
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getDeletedCallbackRequests(businessId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(
        and(eq(callbackRequests.status, 'deleted'), eq(callbackRequests.businessId, businessId))
      )
      .orderBy(desc(callbackRequests.deletedAt));
  }

  async createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest> {
    // Try to find existing customer by phone number (normalized)
    let customerId: number | null = callbackData.customerId ?? null;
    
    if (!customerId && callbackData.phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(callbackData.phoneNumber);
      if (normalizedPhone) {
        // Get all customers for this business
        const allCustomers = await db.select().from(customers).where(
          eq(customers.businessId, callbackData.businessId)
        );
        
        // Find customer by normalized phone number
        const matchingCustomer = allCustomers.find(c => 
          normalizePhoneNumber(c.phone) === normalizedPhone
        );
        
        if (matchingCustomer) {
          customerId = matchingCustomer.id;
        }
      }
    }
    
    const [callback] = await db.insert(callbackRequests).values({
      ...callbackData,
      customerId: customerId ?? null,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    }).returning();
    return callback;
  }

  async updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>, businessId: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set(callbackData)
      .where(
        and(eq(callbackRequests.id, id), eq(callbackRequests.businessId, businessId))
      )
      .returning();
    return callback;
  }

  async completeCallbackRequest(id: number, businessId: number, notes?: string): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        notes: notes || null
      })
      .where(
        and(eq(callbackRequests.id, id), eq(callbackRequests.businessId, businessId))
      )
      .returning();
    return callback;
  }

  async markCallbackAsDeleted(id: number, businessId: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set({
        status: 'deleted',
        deletedAt: new Date().toISOString()
      })
      .where(
        and(eq(callbackRequests.id, id), eq(callbackRequests.businessId, businessId))
      )
      .returning();
    return callback;
  }

  async restoreDeletedCallback(id: number, businessId: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set({
        status: 'pending',
        deletedAt: null
      })
      .where(
        and(eq(callbackRequests.id, id), eq(callbackRequests.businessId, businessId))
      )
      .returning();
    return callback;
  }

  async permanentlyDeleteCallback(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(callbackRequests)
      .where(
        and(eq(callbackRequests.id, id), eq(callbackRequests.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  async purgeExpiredDeletedCallbacks(businessId: number): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();
    
    const result = await db
      .delete(callbackRequests)
      .where(
        and(
          eq(callbackRequests.status, 'deleted'),
          eq(callbackRequests.businessId, businessId),
          lt(callbackRequests.deletedAt, cutoffDate)
        )
      );
    
    return result.rowCount || 0;
  }

  // Work Completed operations
  async getWorkCompletedByJobId(jobId: number, businessId: number): Promise<WorkCompleted[]> {
    const workEntries = await db
      .select()
      .from(workCompleted)
      .where(
        and(eq(workCompleted.jobId, jobId), eq(workCompleted.businessId, businessId))
      )
      .orderBy(desc(workCompleted.createdAt));
    
    // Convert minutes back to hours and pence back to pounds for display
    return workEntries.map(entry => ({
      ...entry,
      laborHours: entry.laborHours ? entry.laborHours / 60 : 0,
      partsCost: entry.partsCost ? entry.partsCost / 100 : null
    }));
  }

  async createWorkCompleted(workData: InsertWorkCompleted): Promise<WorkCompleted> {
    const [workEntry] = await db
      .insert(workCompleted)
      .values({
        ...workData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning();
    
    // Convert minutes back to hours and pence back to pounds for display
    return {
      ...workEntry,
      laborHours: workEntry.laborHours ? workEntry.laborHours / 60 : 0,
      partsCost: workEntry.partsCost ? workEntry.partsCost / 100 : null
    };
  }

  async updateWorkCompleted(id: number, workData: Partial<InsertWorkCompleted>, businessId: number): Promise<WorkCompleted | undefined> {
    const [workEntry] = await db
      .update(workCompleted)
      .set({
        ...workData,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(workCompleted.id, id), eq(workCompleted.businessId, businessId))
      )
      .returning();
    
    if (!workEntry) return undefined;
    
    // Convert minutes back to hours and pence back to pounds for display
    return {
      ...workEntry,
      laborHours: workEntry.laborHours ? workEntry.laborHours / 60 : 0,
      partsCost: workEntry.partsCost ? workEntry.partsCost / 100 : null
    };
  }

  async deleteWorkCompleted(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(workCompleted)
      .where(
        and(eq(workCompleted.id, id), eq(workCompleted.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  // Job Sheet operations - Labour Entries
  async getLabourEntriesByJobId(jobId: number, businessId: number): Promise<LabourEntry[]> {
    return await db
      .select()
      .from(labourEntries)
      .where(
        and(eq(labourEntries.jobId, jobId), eq(labourEntries.businessId, businessId))
      )
      .orderBy(desc(labourEntries.createdAt));
  }

  async createLabourEntry(labourData: InsertLabourEntry): Promise<LabourEntry> {
    const [entry] = await db
      .insert(labourEntries)
      .values({
        ...labourData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning();
    return entry;
  }

  async updateLabourEntry(id: number, labourData: Partial<InsertLabourEntry>, businessId: number): Promise<LabourEntry | undefined> {
    const [entry] = await db
      .update(labourEntries)
      .set({
        ...labourData,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(labourEntries.id, id), eq(labourEntries.businessId, businessId))
      )
      .returning();
    return entry;
  }

  async deleteLabourEntry(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(labourEntries)
      .where(
        and(eq(labourEntries.id, id), eq(labourEntries.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  // Job Sheet operations - Parts Used
  async getPartsUsedByJobId(jobId: number, businessId: number): Promise<PartUsed[]> {
    return await db
      .select()
      .from(partsUsed)
      .where(
        and(eq(partsUsed.jobId, jobId), eq(partsUsed.businessId, businessId))
      )
      .orderBy(desc(partsUsed.createdAt));
  }

  async createPartUsed(partData: InsertPartUsed): Promise<PartUsed> {
    const [part] = await db
      .insert(partsUsed)
      .values({
        ...partData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning();
    return part;
  }

  async updatePartUsed(id: number, partData: Partial<InsertPartUsed>, businessId: number): Promise<PartUsed | undefined> {
    const [part] = await db
      .update(partsUsed)
      .set({
        ...partData,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(partsUsed.id, id), eq(partsUsed.businessId, businessId))
      )
      .returning();
    return part;
  }

  async deletePartUsed(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(partsUsed)
      .where(
        and(eq(partsUsed.id, id), eq(partsUsed.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  // Job Sheet operations - Job Notes
  async getJobNoteByJobId(jobId: number, businessId: number): Promise<JobNote | undefined> {
    const [note] = await db
      .select()
      .from(jobNotes)
      .where(
        and(eq(jobNotes.jobId, jobId), eq(jobNotes.businessId, businessId))
      )
      .limit(1);
    return note;
  }

  async createOrUpdateJobNote(noteData: InsertJobNote): Promise<JobNote> {
    // Check if note exists
    const existing = await this.getJobNoteByJobId(noteData.jobId, noteData.businessId);
    
    if (existing) {
      // Update existing note
      const [updated] = await db
        .update(jobNotes)
        .set({
          ...noteData,
          updatedAt: new Date().toISOString()
        })
        .where(
          and(eq(jobNotes.jobId, noteData.jobId), eq(jobNotes.businessId, noteData.businessId))
        )
        .returning();
      return updated;
    } else {
      // Create new note
      const [created] = await db
        .insert(jobNotes)
        .values({
          ...noteData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning();
      return created;
    }
  }

  async deleteJobNote(jobId: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(jobNotes)
      .where(
        and(eq(jobNotes.jobId, jobId), eq(jobNotes.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  // Job Sheet operations - Job Internal Notes
  async getJobInternalNotes(jobId: number, businessId: number): Promise<(JobInternalNote & { userName?: string })[]> {
    const notes = await db
      .select()
      .from(jobInternalNotes)
      .where(
        and(eq(jobInternalNotes.jobId, jobId), eq(jobInternalNotes.businessId, businessId))
      )
      .orderBy(desc(jobInternalNotes.createdAt));

    // Enrich with user names
    const enriched = await Promise.all(
      notes.map(async (note) => {
        const user = await this.getUser(note.userId, businessId);
        return { ...note, userName: user?.fullName || user?.username || "Unknown" };
      })
    );
    return enriched;
  }

  async createJobInternalNote(noteData: InsertJobInternalNote): Promise<JobInternalNote> {
    const [note] = await db
      .insert(jobInternalNotes)
      .values({
        ...noteData,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return note;
  }

  async getInternalNotesCountByJobIds(jobIds: number[], businessId: number): Promise<Record<number, number>> {
    if (jobIds.length === 0) return {};
    const counts = await db
      .select({
        jobId: jobInternalNotes.jobId,
        count: sql<number>`count(*)::int`,
      })
      .from(jobInternalNotes)
      .where(
        and(
          inArray(jobInternalNotes.jobId, jobIds),
          eq(jobInternalNotes.businessId, businessId)
        )
      )
      .groupBy(jobInternalNotes.jobId);
    return Object.fromEntries(counts.map((r) => [r.jobId, r.count]));
  }

  // Job Sheet operations - Job Attachments
  async getJobAttachmentsByJobId(jobId: number, businessId: number): Promise<JobAttachment[]> {
    return await db
      .select()
      .from(jobAttachments)
      .where(
        and(eq(jobAttachments.jobId, jobId), eq(jobAttachments.businessId, businessId))
      )
      .orderBy(desc(jobAttachments.createdAt));
  }

  async createJobAttachment(attachmentData: InsertJobAttachment): Promise<JobAttachment> {
    const [attachment] = await db
      .insert(jobAttachments)
      .values({
        ...attachmentData,
        createdAt: new Date().toISOString()
      })
      .returning();
    return attachment;
  }

  async deleteJobAttachment(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(jobAttachments)
      .where(
        and(eq(jobAttachments.id, id), eq(jobAttachments.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  // Payment Request operations
  async getPaymentRequest(id: number, businessId: number): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db.select().from(paymentRequests).where(
      and(eq(paymentRequests.id, id), eq(paymentRequests.businessId, businessId))
    );
    return paymentRequest;
  }

  async getPaymentRequestByReference(reference: string, businessId: number): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db.select().from(paymentRequests).where(
      and(eq(paymentRequests.checkoutReference, reference), eq(paymentRequests.businessId, businessId))
    );
    return paymentRequest;
  }

  async getPaymentRequestsByJob(jobId: number, businessId: number): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).where(
      and(eq(paymentRequests.jobId, jobId), eq(paymentRequests.businessId, businessId))
    ).orderBy(desc(paymentRequests.createdAt));
  }

  async getAllPaymentRequests(businessId: number): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests)
      .where(eq(paymentRequests.businessId, businessId))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async createPaymentRequest(paymentData: InsertPaymentRequest): Promise<PaymentRequest> {
    // Generate a unique checkout reference if not provided
    const checkoutReference = paymentData.checkoutReference || this.generateCheckoutReference();
    
    // Ensure all required fields are set with proper defaults
    const insertData = {
      businessId: paymentData.businessId, // Required field
      customerEmail: paymentData.customerEmail,
      amount: paymentData.amount,
      currency: paymentData.currency || 'GBP',
      description: paymentData.description,
      checkoutReference,
      createdBy: paymentData.createdBy || 1, // Default to admin if not provided
      jobId: paymentData.jobId || null,
    };
    
    const [paymentRequest] = await db.insert(paymentRequests).values(insertData).returning();
    
    return paymentRequest;
  }

  private generateCheckoutReference(): string {
    // Generate a unique reference like PAY-XXXXXXXX
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PAY-${timestamp}${random}`;
  }

  async updatePaymentRequest(id: number, paymentData: Partial<PaymentRequest>, businessId: number): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db
      .update(paymentRequests)
      .set({
        ...paymentData,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(paymentRequests.id, id), eq(paymentRequests.businessId, businessId))
      )
      .returning();
    return paymentRequest;
  }

  async updatePaymentStatus(id: number, status: string, businessId: number, transactionData?: any): Promise<PaymentRequest | undefined> {
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (status === 'paid') {
      updateData.paidAt = new Date().toLocaleString('en-GB', { 
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    if (transactionData) {
      updateData.transactionId = transactionData.transactionId;
      updateData.transactionCode = transactionData.transactionCode;
      updateData.authCode = transactionData.authCode;
    }

    const [paymentRequest] = await db
      .update(paymentRequests)
      .set(updateData)
      .where(
        and(eq(paymentRequests.id, id), eq(paymentRequests.businessId, businessId))
      )
      .returning();
    return paymentRequest;
  }

  // Job payment operations
  async recordJobPayment(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined> {
    // Get job to find businessId
    const job = await this.getJob(jobId, (paymentData as any).businessId || 0);
    if (!job) return undefined;
    
    const [updatedJob] = await db
      .update(jobs)
      .set({
        paymentStatus: 'paid',
        paymentAmount: Math.round(paymentData.paymentAmount * 100), // Convert to pence
        invoiceNumber: paymentData.invoiceNumber,
        paymentMethod: paymentData.paymentMethod,
        paymentNotes: paymentData.paymentNotes,
        paidAt: new Date().toLocaleString('en-GB', { 
          timeZone: 'Europe/London',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        paymentRecordedBy: recordedBy
      })
      .where(
        and(eq(jobs.id, jobId), eq(jobs.businessId, job.businessId))
      )
      .returning();
    
    if (updatedJob) {
      // Create activity log for payment recording
      await this.createActivity({
        businessId: job.businessId,
        userId: recordedBy,
        activityType: 'job_payment_recorded',
        description: `Payment recorded for job ${updatedJob.jobId} - £${paymentData.paymentAmount} via ${paymentData.paymentMethod}`,
        entityType: 'job',
        entityId: updatedJob.id
      });
    }
    
    return updatedJob;
  }

  async createJobPaymentRequest(jobId: number, requestData: any, createdBy: number): Promise<PaymentRequest> {
    const businessId = (requestData as any).businessId;
    if (!businessId) {
      throw new Error("businessId is required");
    }

    // First, update the job to indicate a payment request is pending
    await db
      .update(jobs)
      .set({ paymentStatus: 'pending_payment_request' })
      .where(
        and(eq(jobs.id, jobId), eq(jobs.businessId, businessId))
      );

    // Create the payment request
    const paymentRequest = await this.createPaymentRequest({
      businessId: businessId,
      jobId: jobId,
      customerEmail: requestData.customerEmail,
      amount: Math.round(requestData.amount * 100), // Convert to pence
      currency: 'GBP',
      description: requestData.description || `Service payment for job`,
      createdBy: createdBy
    });

    // Link the payment request back to the job
    await db
      .update(jobs)
      .set({ linkedPaymentRequestId: paymentRequest.id })
      .where(
        and(eq(jobs.id, jobId), eq(jobs.businessId, businessId))
      );

    // Create activity log
    await this.createActivity({
      businessId: businessId,
      userId: createdBy,
      activityType: 'job_payment_request_created',
      description: `Payment request created for job - £${requestData.amount}`,
      entityType: 'job',
      entityId: jobId
    });

    return paymentRequest;
  }

  // Method to handle automatic payment completion from Stripe
  async completeJobPaymentFromStripe(paymentRequestId: number): Promise<Job | undefined> {
    // We need businessId - try to get it from payment request
    const paymentRequest = await db.select().from(paymentRequests).where(eq(paymentRequests.id, paymentRequestId)).limit(1);
    if (!paymentRequest[0] || !paymentRequest[0].jobId) {
      return undefined;
    }

    const businessId = paymentRequest[0].businessId;
    const jobId = paymentRequest[0].jobId;

    const [job] = await db
      .update(jobs)
      .set({
        paymentStatus: 'paid',
        paymentAmount: paymentRequest[0].amount,
        paymentMethod: 'stripe',
        paidAt: new Date().toISOString(),
        paymentNotes: `Paid via Stripe - Reference: ${paymentRequest[0].checkoutReference}`
      })
      .where(
        and(eq(jobs.id, jobId), eq(jobs.businessId, businessId))
      )
      .returning();

    if (job) {
      // Create activity log
      await this.createActivity({
        businessId: businessId,
        userId: paymentRequest[0].createdBy || 1,
        activityType: 'job_payment_completed',
        description: `Payment completed via Stripe for job ${job.jobId} - £${paymentRequest[0].amount / 100}`,
        entityType: 'job',
        entityId: job.id
      });
    }

    return job;
  }

  // Additional job payment methods
  async markJobAsPaid(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined> {
    return this.recordJobPayment(jobId, paymentData, recordedBy);
  }

  async getJobPaymentStatus(jobId: number): Promise<any> {
    // This method needs businessId but it's not in the interface - we'll need to get it from the job
    const [job] = await db.select({
      id: jobs.id,
      businessId: jobs.businessId,
      jobId: jobs.jobId,
      paymentStatus: jobs.paymentStatus,
      paymentAmount: jobs.paymentAmount,
      invoiceNumber: jobs.invoiceNumber,
      paymentMethod: jobs.paymentMethod,
      paymentNotes: jobs.paymentNotes,
      paidAt: jobs.paidAt,
      paymentRecordedBy: jobs.paymentRecordedBy,
      linkedPaymentRequestId: jobs.linkedPaymentRequestId
    }).from(jobs).where(eq(jobs.id, jobId));

    if (!job) return null;

    return {
      ...job,
      paymentAmount: job.paymentAmount ? job.paymentAmount / 100 : null // Convert back to pounds
    };
  }

  // Parts on Order operations
  async getPartOnOrder(id: number, businessId: number): Promise<PartOnOrder | undefined> {
    const [part] = await db.select().from(partsOnOrder).where(
      and(eq(partsOnOrder.id, id), eq(partsOnOrder.businessId, businessId))
    );
    return part;
  }

  async getAllPartsOnOrder(businessId: number): Promise<PartOnOrder[]> {
    return await db.select().from(partsOnOrder)
      .where(eq(partsOnOrder.businessId, businessId))
      .orderBy(desc(partsOnOrder.createdAt));
  }

  async getPartsOnOrderByStatus(status: string, businessId: number): Promise<PartOnOrder[]> {
    return await db.select().from(partsOnOrder)
      .where(
        and(eq(partsOnOrder.status, status), eq(partsOnOrder.businessId, businessId))
      )
      .orderBy(desc(partsOnOrder.createdAt));
  }

    async getOverduePartsOnOrder(businessId: number, daysSinceOrder: number = 8): Promise<PartOnOrder[]> {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysSinceOrder);
    
    return await db.select().from(partsOnOrder)
      .where(
        and(
          eq(partsOnOrder.businessId, businessId),
          eq(partsOnOrder.isArrived, false),
          ne(partsOnOrder.status, 'cancelled'),
          ne(partsOnOrder.status, 'collected'),
          lt(partsOnOrder.orderDate, overdueDate.toISOString())
        )
      )
      .orderBy(partsOnOrder.orderDate);
  }

    async getPartsOnOrderByJob(jobId: number, businessId: number): Promise<PartOnOrder[]> {
      return await db
        .select()
        .from(partsOnOrder)
        .where(
          and(eq(partsOnOrder.relatedJobId, jobId), eq(partsOnOrder.businessId, businessId))
        )
        .orderBy(desc(partsOnOrder.createdAt));
    }

  async createPartOnOrder(partData: InsertPartOnOrder): Promise<PartOnOrder> {
    // Convert decimal costs to pence if provided
      const processedData = {
        ...partData,
        createdBy: partData.createdBy ?? 1,
        estimatedCost: partData.estimatedCost ? Math.round(partData.estimatedCost * 100) : undefined,
        actualCost: partData.actualCost ? Math.round(partData.actualCost * 100) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

    const [newPart] = await db.insert(partsOnOrder).values(processedData).returning();

    // Create initial tracking update
        await this.createPartOrderUpdate({
          businessId: newPart.businessId,
          partOrderId: newPart.id,
          updateType: 'ordered',
          newStatus: 'ordered',
          notes: `Part ordered from ${newPart.supplier} for customer ${newPart.customerName}`,
          createdBy: partData.createdBy ?? 1
        });

    // Create activity log
    await this.createActivity({
      businessId: newPart.businessId,
      userId: partData.createdBy || 1,
      activityType: 'part_order_created',
      description: `Part ordered: ${newPart.partName} for ${newPart.customerName}`,
      entityType: 'part_order',
      entityId: newPart.id
    });

    return newPart;
  }

  async updatePartOnOrder(id: number, partData: Partial<PartOnOrder>, businessId: number): Promise<PartOnOrder | undefined> {
    // Convert decimal costs to pence if provided
    const processedData = {
      ...partData,
      estimatedCost: partData.estimatedCost ? Math.round(partData.estimatedCost * 100) : partData.estimatedCost,
      actualCost: partData.actualCost ? Math.round(partData.actualCost * 100) : partData.actualCost,
      updatedAt: new Date().toISOString()
    };

    const [updatedPart] = await db
      .update(partsOnOrder)
      .set(processedData)
      .where(
        and(eq(partsOnOrder.id, id), eq(partsOnOrder.businessId, businessId))
      )
      .returning();

    return updatedPart;
  }

  async markPartAsArrived(id: number, updatedBy: number, businessId: number, actualDeliveryDate?: string, actualCost?: number, notes?: string): Promise<PartOnOrder | undefined> {
    const deliveryDate = actualDeliveryDate || new Date().toISOString();
    const costInPence = actualCost ? Math.round(actualCost * 100) : undefined;

    const [updatedPart] = await db
      .update(partsOnOrder)
      .set({
        isArrived: true,
        status: 'arrived',
        actualDeliveryDate: deliveryDate,
        actualCost: costInPence,
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(partsOnOrder.id, id), eq(partsOnOrder.businessId, businessId))
      )
      .returning();

    if (updatedPart) {
      // Create tracking update
      await this.createPartOrderUpdate({
        businessId: businessId,
        partOrderId: updatedPart.id,
        updateType: 'arrived',
        previousStatus: 'ordered',
        newStatus: 'arrived',
        notes: notes || 'Part has arrived and is ready for customer collection',
        createdBy: updatedBy
      });

      // Create activity log
      await this.createActivity({
        businessId: businessId,
        userId: updatedBy,
        activityType: 'part_arrived',
        description: `Part arrived: ${updatedPart.partName} for ${updatedPart.customerName}`,
        entityType: 'part_order',
        entityId: updatedPart.id
      });
    }

    return updatedPart;
  }

  async markPartAsCollected(id: number, updatedBy: number, businessId: number): Promise<PartOnOrder | undefined> {
    const [updatedPart] = await db
      .update(partsOnOrder)
      .set({
        status: 'collected',
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(partsOnOrder.id, id), eq(partsOnOrder.businessId, businessId))
      )
      .returning();

    if (updatedPart) {
      // Create tracking update
      await this.createPartOrderUpdate({
        businessId: businessId,
        partOrderId: updatedPart.id,
        updateType: 'collected',
        previousStatus: 'arrived',
        newStatus: 'collected',
        notes: 'Part collected by customer',
        createdBy: updatedBy
      });

      // Create activity log
      await this.createActivity({
        businessId: businessId,
        userId: updatedBy,
        activityType: 'part_collected',
        description: `Part collected: ${updatedPart.partName} by ${updatedPart.customerName}`,
        entityType: 'part_order',
        entityId: updatedPart.id
      });
    }

    return updatedPart;
  }

  async notifyCustomerPartReady(id: number, updatedBy: number, businessId: number): Promise<boolean> {
    const [updatedPart] = await db
      .update(partsOnOrder)
      .set({
        isCustomerNotified: true,
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(partsOnOrder.id, id), eq(partsOnOrder.businessId, businessId))
      )
      .returning();

    if (updatedPart) {
      // Create tracking update
      await this.createPartOrderUpdate({
        businessId: businessId,
        partOrderId: updatedPart.id,
        updateType: 'customer_notified',
        newStatus: updatedPart.status,
        notes: 'Customer notified that part is ready for collection',
        createdBy: updatedBy
      });

      // Create activity log
      await this.createActivity({
        businessId: businessId,
        userId: updatedBy,
        activityType: 'customer_notified',
        description: `Customer notified: ${updatedPart.partName} ready for ${updatedPart.customerName}`,
        entityType: 'part_order',
        entityId: updatedPart.id
      });

      return true;
    }

    return false;
  }

  // Part Order Update operations
  async getPartOrderUpdates(partOrderId: number, businessId: number): Promise<PartOrderUpdate[]> {
    return await db.select().from(partOrderUpdates)
      .where(
        and(eq(partOrderUpdates.partOrderId, partOrderId), eq(partOrderUpdates.businessId, businessId))
      )
      .orderBy(desc(partOrderUpdates.createdAt));
  }

    async createPartOrderUpdate(updateData: InsertPartOrderUpdate): Promise<PartOrderUpdate> {
      const [newUpdate] = await db.insert(partOrderUpdates).values({
        ...updateData,
        createdBy: updateData.createdBy ?? 1
      }).returning();

      return newUpdate;
  }

  // Universal Order Management operations
  async generateNextOrderNumber(businessId: number): Promise<string> {
    const result = await db.transaction(async (tx) => {
      let [counter] = await tx.select().from(orderCounter).where(eq(orderCounter.businessId, businessId));

      if (!counter) {
        [counter] = await tx.insert(orderCounter).values({
          businessId,
          currentNumber: 0,
          updatedAt: new Date().toISOString(),
        }).returning();
      }

      const newNumber = counter.currentNumber + 1;

      await tx.update(orderCounter)
        .set({
          currentNumber: newNumber,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orderCounter.id, counter.id));

      return `ORD-${newNumber}`;
    });

    return result;
  }

  async getOrder(id: number, businessId: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(
      and(eq(orders.id, id), eq(orders.businessId, businessId))
    );
    return order;
  }

  async getOrderByNumber(orderNumber: string, businessId: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(
      and(eq(orders.orderNumber, orderNumber), eq(orders.businessId, businessId))
    );
    return order;
  }

  async getAllOrders(businessId: number, limit?: number, offset?: number): Promise<Order[]> {
    const baseQuery = db.select().from(orders)
      .where(eq(orders.businessId, businessId))
      .orderBy(desc(orders.createdAt));
    
    if (offset !== undefined && limit !== undefined) {
      return await baseQuery.offset(offset).limit(limit);
    } else if (limit !== undefined) {
      return await baseQuery.limit(limit);
    } else if (offset !== undefined) {
      return await baseQuery.offset(offset);
    }
    
    return await baseQuery;
  }

  async countAllOrders(businessId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.businessId, businessId));
    return Number(result[0]?.count || 0);
  }

  async getOrdersByStatus(status: string, businessId: number): Promise<Order[]> {
    return await db.select().from(orders)
      .where(
        and(eq(orders.status, status), eq(orders.businessId, businessId))
      )
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByCustomer(customerId: number, businessId: number): Promise<Order[]> {
    return await db.select().from(orders)
      .where(
        and(eq(orders.customerId, customerId), eq(orders.businessId, businessId))
      )
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByJob(jobId: number, businessId: number): Promise<Order[]> {
    return await db.select().from(orders)
      .where(
        and(eq(orders.relatedJobId, jobId), eq(orders.businessId, businessId))
      )
      .orderBy(desc(orders.createdAt));
  }

  async searchOrders(businessId: number, query: string): Promise<Order[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const matchingOrderIds = await db.selectDistinct({ orderId: orderItems.orderId })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.businessId, businessId),
          sql`LOWER(${orderItems.itemName}) LIKE ${searchTerm}`
        )
      );
    const orderIdsWithMatchingItems = matchingOrderIds.map((r) => r.orderId);
    const orderConditions = [
      sql`LOWER(${orders.orderNumber}) LIKE ${searchTerm}`,
      sql`LOWER(${orders.customerName}) LIKE ${searchTerm}`,
      sql`LOWER(${orders.customerEmail}) LIKE ${searchTerm}`,
      sql`LOWER(${orders.customerPhone}) LIKE ${searchTerm}`,
      sql`LOWER(${orders.status}) LIKE ${searchTerm}`,
      sql`LOWER(${orders.supplierName}) LIKE ${searchTerm}`,
    ];
    if (orderIdsWithMatchingItems.length > 0) {
      orderConditions.push(inArray(orders.id, orderIdsWithMatchingItems));
    }
    return await db.select().from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          or(...orderConditions)
        )
      )
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    // Ensure order number is always unique (generate if not provided)
    const orderNumber = orderData.orderNumber || await this.generateNextOrderNumber(orderData.businessId);
    const processedData = {
      ...orderData,
      orderNumber,
      businessId: orderData.businessId,
      createdBy: orderData.createdBy ?? 1,
      estimatedTotalCost: orderData.estimatedTotalCost ? Math.round(orderData.estimatedTotalCost * 100) : undefined,
      actualTotalCost: orderData.actualTotalCost ? Math.round(orderData.actualTotalCost * 100) : undefined,
      depositAmount: orderData.depositAmount ? Math.round(orderData.depositAmount * 100) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const [newOrder] = await db.insert(orders).values(processedData).returning();

    // Create initial status history entry
    await this.createOrderStatusHistory({
      businessId: newOrder.businessId,
      orderId: newOrder.id,
      previousStatus: null,
      newStatus: newOrder.status,
      changeReason: 'Order created',
      notes: `Order ${newOrder.orderNumber} created`,
      changedBy: orderData.createdBy ?? 1
    });

    // Create activity log
    await this.createActivity({
      businessId: newOrder.businessId,
      userId: orderData.createdBy || 1,
      activityType: 'order_created',
      description: `Order created: ${newOrder.orderNumber} for ${newOrder.customerName}`,
      entityType: 'order',
      entityId: newOrder.id
    });

    return newOrder;
  }

  async updateOrder(id: number, orderData: Partial<Order>, businessId: number): Promise<Order | undefined> {
    // Convert decimal costs to pence if provided
    const processedData: any = {
      ...orderData,
      updatedAt: new Date().toISOString()
    };

    if (orderData.estimatedTotalCost !== undefined) {
      processedData.estimatedTotalCost = orderData.estimatedTotalCost ? Math.round(orderData.estimatedTotalCost * 100) : null;
    }
    if (orderData.actualTotalCost !== undefined) {
      processedData.actualTotalCost = orderData.actualTotalCost ? Math.round(orderData.actualTotalCost * 100) : null;
    }
    if (orderData.depositAmount !== undefined) {
      processedData.depositAmount = orderData.depositAmount ? Math.round(orderData.depositAmount * 100) : null;
    }

    const [updatedOrder] = await db
      .update(orders)
      .set(processedData)
      .where(
        and(eq(orders.id, id), eq(orders.businessId, businessId))
      )
      .returning();

    return updatedOrder;
  }

  async updateOrderStatus(
    id: number,
    newStatus: string,
    changedBy: number,
    businessId: number,
    changeReason?: string,
    notes?: string,
    metadata?: Record<string, unknown>
  ): Promise<Order | undefined> {
    const order = await this.getOrder(id, businessId);
    if (!order) return undefined;

    const updateData: any = {
      status: newStatus,
      updatedBy: changedBy,
      updatedAt: new Date().toISOString()
    };

    // Set completion or cancellation timestamp
    if (newStatus === 'completed') {
      updateData.completedAt = new Date().toISOString();
    } else if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date().toISOString();
    }

    // If status is 'arrived', set actual delivery date if not already set
    if (newStatus === 'arrived' && !order.actualDeliveryDate) {
      updateData.actualDeliveryDate = new Date().toISOString();
    }

    const [updatedOrder] = await db
      .update(orders)
      .set(updateData)
      .where(
        and(eq(orders.id, id), eq(orders.businessId, businessId))
      )
      .returning();

    if (updatedOrder) {
      // Create status history entry
      await this.createOrderStatusHistory({
        businessId: businessId,
        orderId: updatedOrder.id,
        previousStatus: order.status,
        newStatus: newStatus,
        changeReason: changeReason,
        notes: notes,
        metadata: metadata || null,
        changedBy: changedBy
      });

      // Create activity log
      await this.createActivity({
        businessId: businessId,
        userId: changedBy,
        activityType: 'order_status_changed',
        description: `Order ${updatedOrder.orderNumber} status changed from ${order.status} to ${newStatus}`,
        entityType: 'order',
        entityId: updatedOrder.id
      });
    }

    return updatedOrder;
  }

  async deleteOrder(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(orders)
      .where(
        and(eq(orders.id, id), eq(orders.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  // Order Items operations
  async getOrderItems(orderId: number, businessId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems)
      .where(
        and(eq(orderItems.orderId, orderId), eq(orderItems.businessId, businessId))
      )
      .orderBy(orderItems.createdAt);
  }

  async getOrderItemsByOrderIds(orderIds: number[], businessId: number): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];
    return await db.select().from(orderItems)
      .where(
        and(inArray(orderItems.orderId, orderIds), eq(orderItems.businessId, businessId))
      )
      .orderBy(orderItems.orderId, orderItems.createdAt);
  }

  async getOrderItem(id: number, businessId: number): Promise<OrderItem | undefined> {
    const [item] = await db.select().from(orderItems).where(
      and(eq(orderItems.id, id), eq(orderItems.businessId, businessId))
    );
    return item;
  }

  async createOrderItem(itemData: InsertOrderItem): Promise<OrderItem> {
    if (!itemData.businessId || !itemData.orderId) {
      throw new Error('businessId and orderId are required for order items');
    }
    // Convert decimal prices to pence if provided
    const processedData = {
      ...itemData,
      businessId: itemData.businessId,
      orderId: itemData.orderId,
      unitPrice: itemData.unitPrice ? Math.round(itemData.unitPrice * 100) : undefined,
      priceExcludingVat: itemData.priceExcludingVat ? Math.round(itemData.priceExcludingVat * 100) : undefined,
      priceIncludingVat: itemData.priceIncludingVat ? Math.round(itemData.priceIncludingVat * 100) : undefined,
      totalPrice: itemData.totalPrice ? Math.round(itemData.totalPrice * 100) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const [newItem] = await db.insert(orderItems).values(processedData).returning();
    return newItem;
  }

  async updateOrderItem(id: number, itemData: Partial<OrderItem>, businessId: number): Promise<OrderItem | undefined> {
    const processedData: any = {
      ...itemData,
      updatedAt: new Date().toISOString()
    };

    if (itemData.unitPrice !== undefined) {
      processedData.unitPrice = itemData.unitPrice ? Math.round(itemData.unitPrice * 100) : null;
    }
    if (itemData.priceExcludingVat !== undefined) {
      processedData.priceExcludingVat = itemData.priceExcludingVat ? Math.round(itemData.priceExcludingVat * 100) : null;
    }
    if (itemData.priceIncludingVat !== undefined) {
      processedData.priceIncludingVat = itemData.priceIncludingVat ? Math.round(itemData.priceIncludingVat * 100) : null;
    }
    if (itemData.totalPrice !== undefined) {
      processedData.totalPrice = itemData.totalPrice ? Math.round(itemData.totalPrice * 100) : null;
    }

    const [updatedItem] = await db
      .update(orderItems)
      .set(processedData)
      .where(
        and(eq(orderItems.id, id), eq(orderItems.businessId, businessId))
      )
      .returning();

    return updatedItem;
  }

  async deleteOrderItem(id: number, businessId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(orderItems)
      .where(
        and(eq(orderItems.id, id), eq(orderItems.businessId, businessId))
      )
      .returning();
    return !!deleted;
  }

  async deleteOrderItemsByOrder(orderId: number, businessId: number): Promise<boolean> {
    const deleted = await db
      .delete(orderItems)
      .where(
        and(eq(orderItems.orderId, orderId), eq(orderItems.businessId, businessId))
      );
    return true;
  }

  // Order Status History operations
  async getOrderStatusHistory(orderId: number, businessId: number): Promise<OrderStatusHistory[]> {
    return await db.select().from(orderStatusHistory)
      .where(
        and(eq(orderStatusHistory.orderId, orderId), eq(orderStatusHistory.businessId, businessId))
      )
      .orderBy(desc(orderStatusHistory.createdAt));
  }

  async createOrderStatusHistory(historyData: InsertOrderStatusHistory): Promise<OrderStatusHistory> {
    const [newHistory] = await db.insert(orderStatusHistory).values({
      businessId: historyData.businessId,
      orderId: historyData.orderId,
      previousStatus: historyData.previousStatus || null,
      newStatus: historyData.newStatus,
      changeReason: historyData.changeReason || null,
      notes: historyData.notes || null,
      metadata: (historyData.metadata as Record<string, unknown> | null) || null,
      changedBy: historyData.changedBy ?? 1,
    }).returning();

    return newHistory;
  }

  // Time Entry operations
  async getTimeEntry(id: number, businessId: number): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(
      and(eq(timeEntries.id, id), eq(timeEntries.businessId, businessId))
    );
    return entry;
  }

  async getTimeEntriesByUser(userId: number, businessId: number, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    const conditions = [
      eq(timeEntries.userId, userId),
      eq(timeEntries.businessId, businessId)
    ];
    
    if (startDate) {
      conditions.push(gte(timeEntries.startTime, startDate));
    }
    if (endDate) {
      conditions.push(lte(timeEntries.startTime, endDate));
    }
    
    return await db.select().from(timeEntries)
      .where(and(...conditions))
      .orderBy(timeEntries.startTime);
  }

  async getTimeEntriesByJob(jobId: number, businessId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(
        and(eq(timeEntries.jobId, jobId), eq(timeEntries.businessId, businessId))
      )
      .orderBy(timeEntries.startTime);
  }

  async getAllTimeEntries(businessId: number, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    const conditions = [eq(timeEntries.businessId, businessId)];
    
    if (startDate) {
      conditions.push(gte(timeEntries.startTime, startDate));
    }
    if (endDate) {
      conditions.push(lte(timeEntries.startTime, endDate));
    }
    
    return await db.select().from(timeEntries)
      .where(and(...conditions))
      .orderBy(timeEntries.startTime);
  }

  async createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry> {
    const [newEntry] = await db.insert(timeEntries).values({
      ...timeEntry,
      updatedAt: new Date().toISOString(),
    }).returning();
    return newEntry;
  }

  async updateTimeEntry(id: number, timeEntry: Partial<InsertTimeEntry>, businessId: number): Promise<TimeEntry | undefined> {
    const [updatedEntry] = await db.update(timeEntries)
      .set({
        ...timeEntry,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(timeEntries.id, id), eq(timeEntries.businessId, businessId))
      )
      .returning();
    return updatedEntry;
  }

  async deleteTimeEntry(id: number, businessId: number): Promise<boolean> {
    const result = await db.delete(timeEntries).where(
      and(eq(timeEntries.id, id), eq(timeEntries.businessId, businessId))
    );
    return true;
  }

  // Announcement operations
  async getAnnouncements(includeInactive: boolean = true): Promise<Announcement[]> {
    if (includeInactive) {
      return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    }

    return await db.select().from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.createdAt));
  }

  async getActiveAnnouncements(audience: string = "login"): Promise<Announcement[]> {
    const nowIso = new Date().toISOString();

    return await db.select().from(announcements)
      .where(
        and(
          eq(announcements.audience, audience),
          eq(announcements.isActive, true),
          or(isNull(announcements.displayStart), lte(announcements.displayStart, nowIso)),
          or(isNull(announcements.displayEnd), gte(announcements.displayEnd, nowIso))
        )
      )
      .orderBy(desc(announcements.priority), desc(announcements.createdAt));
  }

  async createAnnouncement(announcementData: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db.insert(announcements).values({
      ...announcementData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();
    return announcement;
  }

  async updateAnnouncement(id: number, announcementData: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [announcement] = await db.update(announcements)
      .set({
        ...announcementData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(announcements.id, id))
      .returning();
    return announcement;
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const [announcement] = await db.update(announcements)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(announcements.id, id))
      .returning();
    return !!announcement;
  }

  // Message operations
  async getMessage(id: number, businessId: number): Promise<Message | undefined> {
    const [message] = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.id, id),
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt)
        )
      );
    return message;
  }

  async getMessagesByUser(userId: number, businessId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt),
          or(
            eq(messages.senderId, userId),
            eq(messages.recipientId, userId)
          )
        )
      )
      .orderBy(desc(messages.createdAt));
  }

  async getConversation(userId1: number, userId2: number, businessId: number): Promise<Message[]> {
    console.log('Storage: getConversation called with:', { userId1, userId2, businessId });
    
    // First, let's check if there are any messages at all for these users
    const allMessages = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt)
        )
      );
    console.log(`Storage: Total messages in business: ${allMessages.length}`);
    
    const result = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt),
          isNotNull(messages.recipientId), // Ensure recipientId is not null
          or(
            and(
              eq(messages.senderId, userId1),
              eq(messages.recipientId, userId2)
            ),
            and(
              eq(messages.senderId, userId2),
              eq(messages.recipientId, userId1)
            )
          )
        )
      )
      .orderBy(messages.createdAt);
    
    console.log(`Storage: getConversation found ${result.length} messages`);
    if (result.length > 0) {
      console.log('Storage: Sample message:', {
        id: result[0].id,
        senderId: result[0].senderId,
        recipientId: result[0].recipientId,
        businessId: result[0].businessId,
        content: result[0].content?.substring(0, 50),
      });
    } else {
      // Debug: Check if messages exist with these user IDs in any combination
      const debugMessages = await db.select()
        .from(messages)
        .where(
          and(
            eq(messages.businessId, businessId),
            isNull(messages.deletedAt),
            or(
              eq(messages.senderId, userId1),
              eq(messages.senderId, userId2),
              eq(messages.recipientId, userId1),
              eq(messages.recipientId, userId2)
            )
          )
        );
      console.log(`Storage: Debug - Found ${debugMessages.length} messages involving these users:`, 
        debugMessages.map(m => ({ id: m.id, senderId: m.senderId, recipientId: m.recipientId }))
      );
    }
    return result;
  }

  async getSupportConversation(masterUserId: number, otherUserId: number): Promise<Message[]> {
    const otherUser = await this.getUserById(otherUserId);
    if (!otherUser) return [];
    return this.getConversation(masterUserId, otherUserId, otherUser.businessId);
  }

  async getSupportConversations(masterUserId: number): Promise<Array<{ otherUser: User; lastMessage: Message; unreadCount: number }>> {
    const sentMessages = await db.select({
      otherUserId: messages.recipientId,
      lastMessage: messages,
      businessId: messages.businessId,
    })
      .from(messages)
      .where(
        and(
          eq(messages.senderId, masterUserId),
          isNull(messages.deletedAt),
          isNotNull(messages.recipientId)
        )
      )
      .orderBy(desc(messages.createdAt));

    const receivedMessages = await db.select({
      otherUserId: messages.senderId,
      lastMessage: messages,
      businessId: messages.businessId,
    })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, masterUserId),
          isNull(messages.deletedAt),
          isNotNull(messages.senderId)
        )
      )
      .orderBy(desc(messages.createdAt));

    const conversationMap = new Map<number, { lastMessage: Message; unreadCount: number }>();
    for (const msg of receivedMessages) {
      if (!msg.otherUserId) continue;
      const existing = conversationMap.get(msg.otherUserId);
      if (!existing || new Date(msg.lastMessage.createdAt) > new Date(existing.lastMessage.createdAt)) {
        conversationMap.set(msg.otherUserId, {
          lastMessage: msg.lastMessage,
          unreadCount: msg.lastMessage.isRead ? 0 : 1,
        });
      } else if (!msg.lastMessage.isRead) {
        existing.unreadCount += 1;
      }
    }
    for (const msg of sentMessages) {
      if (!msg.otherUserId) continue;
      const existing = conversationMap.get(msg.otherUserId);
      if (!existing || new Date(msg.lastMessage.createdAt) > new Date(existing.lastMessage.createdAt)) {
        conversationMap.set(msg.otherUserId, {
          lastMessage: msg.lastMessage,
          unreadCount: existing?.unreadCount ?? 0,
        });
      }
    }

    const unreadCounts = await db.select({
      senderId: messages.senderId,
      count: sql<number>`count(*)`.as('count'),
    })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, masterUserId),
          eq(messages.isRead, false),
          isNull(messages.deletedAt),
          isNotNull(messages.senderId)
        )
      )
      .groupBy(messages.senderId);

    const unreadMap = new Map<number, number>();
    for (const c of unreadCounts) {
      if (c.senderId) unreadMap.set(c.senderId, Number(c.count));
    }

    const result: Array<{ otherUser: User; lastMessage: Message; unreadCount: number }> = [];
    for (const [otherUserId, data] of conversationMap.entries()) {
      const otherUser = await this.getUserById(otherUserId);
      if (otherUser && otherUser.role !== 'master') {
        result.push({
          otherUser,
          lastMessage: data.lastMessage,
          unreadCount: unreadMap.get(otherUserId) ?? 0,
        });
      }
    }
    result.sort((a, b) =>
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
    return result;
  }

  async getGroupConversation(threadId: number, userId: number, businessId: number): Promise<Message[]> {
    console.log('Storage: getGroupConversation called with:', { threadId, userId, businessId });
    
    // For group conversations, we need to check if user is a participant
    const isParticipant = await db.select()
      .from(messageThreadParticipants)
      .where(
        and(
          eq(messageThreadParticipants.threadId, threadId),
          eq(messageThreadParticipants.userId, userId),
          isNull(messageThreadParticipants.leftAt)
        )
      )
      .limit(1);
    
    if (isParticipant.length === 0) {
      console.log('Storage: User is not a participant in this thread');
      return [];
    }
    
    // Get all messages in the thread (group messages have null recipientId)
    const result = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          eq(messages.threadId, threadId),
          isNull(messages.deletedAt)
        )
      )
      .orderBy(messages.createdAt);
    
    console.log(`Storage: getGroupConversation found ${result.length} messages`);
    return result;
  }

  async getAllConversations(userId: number, businessId: number): Promise<Array<{ otherUser: User; lastMessage: Message; unreadCount: number }>> {
    console.log(`[getAllConversations] userId: ${userId}, businessId: ${businessId}`);
    
    // Get all unique conversation partners
    // IMPORTANT: Only get messages where the user is either sender OR recipient
    // This ensures users only see conversations they're part of
    const sentMessages = await db.select({
      otherUserId: messages.recipientId,
      lastMessage: messages,
    })
      .from(messages)
      .where(
        and(
          eq(messages.senderId, userId),
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt),
          isNotNull(messages.recipientId)
        )
      )
      .orderBy(desc(messages.createdAt));
    
    console.log(`[getAllConversations] Found ${sentMessages.length} sent messages for userId ${userId}`);

    const receivedMessages = await db.select({
      otherUserId: messages.senderId,
      lastMessage: messages,
    })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt)
        )
      )
      .orderBy(desc(messages.createdAt));
    
    console.log(`[getAllConversations] Found ${receivedMessages.length} received messages for userId ${userId}`);

    // Combine and deduplicate by otherUserId, keeping the most recent message
    const conversationMap = new Map<number, { lastMessage: Message; unreadCount: number }>();

    // Process received messages (for unread count)
    for (const msg of receivedMessages) {
      if (!msg.otherUserId) continue;
      const existing = conversationMap.get(msg.otherUserId);
      if (!existing || new Date(msg.lastMessage.createdAt) > new Date(existing.lastMessage.createdAt)) {
        conversationMap.set(msg.otherUserId, {
          lastMessage: msg.lastMessage,
          unreadCount: msg.lastMessage.isRead ? 0 : 1,
        });
      } else if (!msg.lastMessage.isRead) {
        existing.unreadCount += 1;
      }
    }

    // Process sent messages (update if newer)
    for (const msg of sentMessages) {
      if (!msg.otherUserId) continue;
      const existing = conversationMap.get(msg.otherUserId);
      if (!existing || new Date(msg.lastMessage.createdAt) > new Date(existing.lastMessage.createdAt)) {
        conversationMap.set(msg.otherUserId, {
          lastMessage: msg.lastMessage,
          unreadCount: existing?.unreadCount || 0,
        });
      }
    }

    // Get unread counts properly
    // IMPORTANT: Only count unread messages where THIS user is the recipient
    // This ensures users only see unread counts for messages sent TO them
    const unreadCounts = await db.select({
      senderId: messages.senderId,
      count: sql<number>`count(*)`.as('count'),
    })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId), // Only messages where THIS user is recipient
          eq(messages.businessId, businessId),
          eq(messages.isRead, false),
          isNull(messages.deletedAt),
          isNotNull(messages.senderId)
        )
      )
      .groupBy(messages.senderId);
    
    console.log(`[getAllConversations] Found unread messages from ${unreadCounts.length} senders for userId ${userId}`);

    const unreadMap = new Map<number, number>();
    for (const count of unreadCounts) {
      if (count.senderId) {
        unreadMap.set(count.senderId, Number(count.count));
      }
    }

    // Fetch user details for each conversation partner (use getUserById for cross-business e.g. BoltDown support)
    const result: Array<{ otherUser: User; lastMessage: Message; unreadCount: number }> = [];
    for (const [otherUserId, data] of conversationMap.entries()) {
      let otherUser = await this.getUser(otherUserId, businessId);
      if (!otherUser) otherUser = await this.getUserById(otherUserId);
      if (otherUser) {
        result.push({
          otherUser,
          lastMessage: data.lastMessage,
          unreadCount: unreadMap.get(otherUserId) || 0,
        });
      }
    }

    // Sort by last message time (most recent first)
    result.sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    return result;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    try {
      console.log('Storage: Creating message with data:', JSON.stringify(messageData, null, 2));
      
      // Build insert data - use spread but filter out undefined values
      const insertData: any = {};
      
      // Required fields
      insertData.businessId = messageData.businessId;
      insertData.senderId = messageData.senderId;
      insertData.content = messageData.content;
      
      // Optional fields - only include if defined
      if (messageData.recipientId !== undefined && messageData.recipientId !== null) {
        insertData.recipientId = messageData.recipientId;
      }
      if (messageData.threadId !== undefined && messageData.threadId !== null) {
        insertData.threadId = messageData.threadId;
      }
      if (messageData.attachedJobId !== undefined && messageData.attachedJobId !== null) {
        insertData.attachedJobId = messageData.attachedJobId;
      }
      if (messageData.attachedTaskId !== undefined && messageData.attachedTaskId !== null) {
        insertData.attachedTaskId = messageData.attachedTaskId;
      }
      // Handle JSON array - only include if it's a non-empty array
      if (messageData.attachedImageUrls !== undefined && messageData.attachedImageUrls !== null) {
        if (Array.isArray(messageData.attachedImageUrls) && messageData.attachedImageUrls.length > 0) {
          insertData.attachedImageUrls = messageData.attachedImageUrls;
        }
        // If it's an empty array, don't include it (let it be null in DB)
      }
      
      console.log('Storage: Insert data prepared:', JSON.stringify(insertData, null, 2));
      console.log('Storage: Insert data types:', Object.entries(insertData).map(([k, v]) => [k, typeof v, Array.isArray(v) ? 'array' : '']));
      
      const [message] = await db.insert(messages).values(insertData).returning();
      
      if (!message) {
        throw new Error('Failed to create message: no message returned from database');
      }
      
      console.log('Storage: Message created successfully:', message.id);
      return message;
    } catch (error: any) {
      console.error('Storage: Error creating message:', error);
      console.error('Storage: Error type:', typeof error);
      console.error('Storage: Error constructor:', error?.constructor?.name);
      console.error('Storage: Message data that failed:', JSON.stringify(messageData, null, 2));
      if (error.code) {
        console.error('Storage: Database error code:', error.code);
        console.error('Storage: Database error detail:', error.detail);
        console.error('Storage: Database error constraint:', error.constraint);
        console.error('Storage: Database error table:', error.table);
        console.error('Storage: Database error column:', error.column);
        console.error('Storage: Database error hint:', error.hint);
      }
      if (error.message) {
        console.error('Storage: Error message:', error.message);
      }
      if (error.stack) {
        console.error('Storage: Error stack:', error.stack);
      }
      // Re-throw with more context
      const enhancedError = new Error(`Failed to create message: ${error.message || error}`);
      (enhancedError as any).originalError = error;
      (enhancedError as any).code = error.code;
      (enhancedError as any).detail = error.detail;
      throw enhancedError;
    }
  }

  async markMessageAsRead(id: number, userId: number, businessId: number): Promise<Message | undefined> {
    const [message] = await db.update(messages)
      .set({
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messages.id, id),
          eq(messages.recipientId, userId),
          eq(messages.businessId, businessId),
          eq(messages.isRead, false)
        )
      )
      .returning();
    return message;
  }

  async markConversationAsRead(userId: number, otherUserId: number, businessId: number): Promise<number> {
    const result = await db.update(messages)
      .set({
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messages.senderId, otherUserId),
          eq(messages.recipientId, userId),
          eq(messages.businessId, businessId),
          eq(messages.isRead, false),
          isNull(messages.deletedAt)
        )
      )
      .returning();
    return result.length;
  }

  async markGroupConversationAsRead(threadId: number, userId: number, businessId: number): Promise<number> {
    const result = await db.update(messages)
      .set({
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.recipientId, userId),
          eq(messages.businessId, businessId),
          eq(messages.isRead, false),
          isNull(messages.deletedAt)
        )
      )
      .returning();
    return result.length;
  }

  async deleteMessage(id: number, userId: number, businessId: number): Promise<boolean> {
    // Only allow sender or recipient to delete
    const [message] = await db.update(messages)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messages.id, id),
          eq(messages.businessId, businessId),
          isNull(messages.deletedAt),
          or(
            eq(messages.senderId, userId),
            eq(messages.recipientId, userId)
          )
        )
      )
      .returning();
    return !!message;
  }

  async deleteOldMessages(monthsOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);
    
    const result = await db.delete(messages)
      .where(
        and(
          lt(messages.createdAt, cutoffDate.toISOString()),
          isNull(messages.deletedAt) // Only delete non-soft-deleted messages
        )
      )
      .returning();
    
    return result.length;
  }

  // Thread/Group operations
  async createThread(threadData: InsertMessageThread, participantIds: number[]): Promise<MessageThread> {
    const [thread] = await db.insert(messageThreads).values({
      ...threadData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    // Add participants (including creator)
    const allParticipantIds = [...new Set([threadData.createdBy, ...participantIds])];
    if (allParticipantIds.length > 0) {
      await db.insert(messageThreadParticipants).values(
        allParticipantIds.map(userId => ({
          threadId: thread.id,
          userId,
          joinedAt: new Date().toISOString(),
        }))
      );
    }

    return thread;
  }

  async getThread(threadId: number, businessId: number): Promise<MessageThread | undefined> {
    const [thread] = await db.select()
      .from(messageThreads)
      .where(
        and(
          eq(messageThreads.id, threadId),
          eq(messageThreads.businessId, businessId)
        )
      );
    return thread;
  }

  async updateThread(threadId: number, businessId: number, data: Partial<InsertMessageThread>): Promise<MessageThread | undefined> {
    const [updated] = await db.update(messageThreads)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(messageThreads.id, threadId),
          eq(messageThreads.businessId, businessId)
        )
      )
      .returning();
    return updated;
  }

  async getThreadParticipants(threadId: number, businessId: number): Promise<User[]> {
    const participants = await db.select({
      userId: messageThreadParticipants.userId,
    })
      .from(messageThreadParticipants)
      .innerJoin(messageThreads, eq(messageThreads.id, messageThreadParticipants.threadId))
      .where(
        and(
          eq(messageThreadParticipants.threadId, threadId),
          eq(messageThreads.businessId, businessId),
          isNull(messageThreadParticipants.leftAt)
        )
      );

    const users: User[] = [];
    for (const p of participants) {
      const user = await this.getUser(p.userId, businessId);
      if (user) {
        users.push(user);
      }
    }
    return users;
  }

  async getUserThreads(userId: number, businessId: number): Promise<Array<{ thread: MessageThread; participants: User[]; lastMessage: Message; unreadCount: number }>> {
    console.log('getUserThreads called for userId:', userId, 'businessId:', businessId);
    // Get all threads where user is a participant
    const userThreads = await db.select({
      threadId: messageThreadParticipants.threadId,
    })
      .from(messageThreadParticipants)
      .where(
        and(
          eq(messageThreadParticipants.userId, userId),
          isNull(messageThreadParticipants.leftAt)
        )
      );

    console.log(`getUserThreads: Found ${userThreads.length} threads for user ${userId}`);

    const result: Array<{ thread: MessageThread; participants: User[]; lastMessage: Message; unreadCount: number }> = [];

    for (const ut of userThreads) {
      const thread = await this.getThread(ut.threadId, businessId);
      if (!thread) {
        console.log(`getUserThreads: Thread ${ut.threadId} not found or doesn't belong to business ${businessId}`);
        continue;
      }

      const participants = await this.getThreadParticipants(ut.threadId, businessId);
      console.log(`getUserThreads: Thread ${ut.threadId} has ${participants.length} participants`);
      
      // Get last message in thread
      const threadMessages = await this.getGroupConversation(ut.threadId, userId, businessId);
      const lastMessage = threadMessages[threadMessages.length - 1];
      
      // Get unread count
      const unreadMessages = await db.select()
        .from(messages)
        .where(
          and(
            eq(messages.threadId, ut.threadId),
            eq(messages.businessId, businessId),
            eq(messages.isRead, false),
            isNull(messages.deletedAt),
            ne(messages.senderId, userId) // Don't count own messages
          )
        );
      
      // Create a placeholder message if no messages exist yet
      const displayMessage: Message = lastMessage || {
        id: 0,
        businessId: thread.businessId,
        senderId: userId,
        recipientId: null,
        threadId: thread.id,
        content: 'No messages yet',
        isRead: true,
        readAt: null,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        deletedAt: null,
        attachedJobId: null,
        attachedTaskId: null,
        attachedImageUrls: null,
      };
      
      const filteredParticipants = participants.filter(p => p.id !== userId); // Exclude current user
      console.log(`getUserThreads: Thread ${ut.threadId} - ${participants.length} total participants, ${filteredParticipants.length} after filtering current user`);
      
      result.push({
        thread,
        participants: filteredParticipants,
        lastMessage: displayMessage,
        unreadCount: unreadMessages.length,
      });
    }

    // Sort by last message time
    result.sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    console.log(`getUserThreads: Returning ${result.length} groups`);
    return result;
  }

  // Password Reset Code operations
  async createPasswordResetCode(resetData: InsertPasswordResetCode): Promise<PasswordResetCode> {
    const [resetCode] = await db.insert(passwordResetCodes).values(resetData).returning();
    return resetCode;
  }

  async getPasswordResetCode(code: string): Promise<PasswordResetCode | undefined> {
    const [resetCode] = await db
      .select()
      .from(passwordResetCodes)
      .where(and(
        eq(passwordResetCodes.code, code),
        isNull(passwordResetCodes.usedAt),
        gte(passwordResetCodes.expiresAt, new Date().toISOString())
      ))
      .limit(1);
    return resetCode;
  }

  async markPasswordResetCodeAsUsed(code: string): Promise<boolean> {
    const result = await db
      .update(passwordResetCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(passwordResetCodes.code, code));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteExpiredPasswordResetCodes(): Promise<number> {
    const result = await db
      .delete(passwordResetCodes)
      .where(
        or(
          lt(passwordResetCodes.expiresAt, new Date().toISOString()),
          isNotNull(passwordResetCodes.usedAt)
        )
      );
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();