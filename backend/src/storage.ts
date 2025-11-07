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
  paymentRequests, PaymentRequest, InsertPaymentRequest,
  jobCounter, JobCounter,
  partsOnOrder, PartOnOrder, InsertPartOnOrder,
  partOrderUpdates, PartOrderUpdate, InsertPartOrderUpdate
} from "@shared/schema";

import { formatDistanceToNow } from "date-fns";
import { db } from "./db";
import { and, desc, eq, ne, lt, isNull, isNotNull, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  deactivateUser(id: number): Promise<boolean>;
  
  // Workshop activity operations
  getAllActivities(limit?: number): Promise<Activity[]>;
  getActivityByUser(userId: number, limit?: number): Promise<Activity[]>;
  getActivityByEntity(entityType: string, entityId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  cleanupOldActivities(keepCount: number): Promise<void>;
  cleanupOldActivities(keepCount: number): Promise<void>;
  
  // Registration operations
  createRegistrationRequest(request: InsertRegistrationRequest): Promise<RegistrationRequest>;
  getRegistrationRequest(id: number): Promise<RegistrationRequest | undefined>;
  getAllRegistrationRequests(): Promise<RegistrationRequest[]>;
  getPendingRegistrationRequests(): Promise<RegistrationRequest[]>;
  updateRegistrationRequestStatus(id: number, status: string, reviewedBy: number, notes?: string): Promise<RegistrationRequest | undefined>;

  // Customer operations
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;

  // Equipment type operations removed - table was dropped

  // Equipment operations
  getEquipment(id: number): Promise<Equipment | undefined>;
  getEquipmentByCustomer(customerId: number): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, equipment: InsertEquipment): Promise<Equipment>;
  getAllEquipment(): Promise<Equipment[]>;

  // Job operations
  generateNextJobId(): Promise<string>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: number): Promise<boolean>;
  getAllJobs(): Promise<Job[]>;
  getActiveJobs(): Promise<Job[]>;
  
  // Job payment operations
  recordJobPayment(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined>;
  createJobPaymentRequest(jobId: number, requestData: any, createdBy: number): Promise<PaymentRequest>;
  markJobAsPaid(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined>;
  getJobPaymentStatus(jobId: number): Promise<any>;
  completeJobPaymentFromStripe(paymentRequestId: number): Promise<Job | undefined>;

  // Service operations
  getService(id: number): Promise<Service | undefined>;
  getServicesByJob(jobId: number): Promise<Service[]>;
  getServicesByEquipment(equipmentId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: InsertService): Promise<Service>;
  getAllServices(): Promise<Service[]>;

  // Task operations
  getTask(id: number): Promise<Task | undefined>;
  getTasksByAssignee(assignedTo: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<Task>): Promise<Task | undefined>;
  completeTask(id: number): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getPendingTasks(): Promise<Task[]>;

  // Job Update operations
  getJobUpdates(jobId: number): Promise<JobUpdate[]>;
  getPublicJobUpdates(jobId: number): Promise<JobUpdate[]>;
  createJobUpdate(updateData: InsertJobUpdate): Promise<JobUpdate>;

  // Callback Request operations
  getCallbackRequest(id: number): Promise<CallbackRequest | undefined>;
  getCallbackRequestsByCustomer(customerId: number): Promise<CallbackRequest[]>;
  getCallbackRequestsByAssignee(assignedTo: number): Promise<CallbackRequest[]>;
  getPendingCallbackRequests(): Promise<CallbackRequest[]>;
  getCompletedCallbackRequests(): Promise<CallbackRequest[]>;
  getAllCallbackRequests(): Promise<CallbackRequest[]>;
  getDeletedCallbackRequests(): Promise<CallbackRequest[]>;
  createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest>;
  updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>): Promise<CallbackRequest | undefined>;
  completeCallbackRequest(id: number, notes?: string): Promise<CallbackRequest | undefined>;
  markCallbackAsDeleted(id: number): Promise<CallbackRequest | undefined>;
  restoreDeletedCallback(id: number): Promise<CallbackRequest | undefined>;
  permanentlyDeleteCallback(id: number): Promise<boolean>;
  purgeExpiredDeletedCallbacks(): Promise<number>;

  // Work Completed operations
  getWorkCompletedByJobId(jobId: number): Promise<WorkCompleted[]>;
  createWorkCompleted(workData: InsertWorkCompleted): Promise<WorkCompleted>;
  updateWorkCompleted(id: number, workData: Partial<InsertWorkCompleted>): Promise<WorkCompleted | undefined>;
  deleteWorkCompleted(id: number): Promise<boolean>;

  // Payment Request operations
  getPaymentRequest(id: number): Promise<PaymentRequest | undefined>;
  getPaymentRequestByReference(reference: string): Promise<PaymentRequest | undefined>;
  getPaymentRequestsByJob(jobId: number): Promise<PaymentRequest[]>;
  getAllPaymentRequests(): Promise<PaymentRequest[]>;
  createPaymentRequest(paymentData: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequest(id: number, paymentData: Partial<PaymentRequest>): Promise<PaymentRequest | undefined>;
  updatePaymentStatus(id: number, status: string, transactionData?: any): Promise<PaymentRequest | undefined>;

  // Parts on Order operations
  getPartOnOrder(id: number): Promise<PartOnOrder | undefined>;
  getAllPartsOnOrder(): Promise<PartOnOrder[]>;
  getPartsOnOrderByStatus(status: string): Promise<PartOnOrder[]>;
  getOverduePartsOnOrder(daysSinceOrder?: number): Promise<PartOnOrder[]>;
  createPartOnOrder(partData: InsertPartOnOrder): Promise<PartOnOrder>;
  updatePartOnOrder(id: number, partData: Partial<PartOnOrder>): Promise<PartOnOrder | undefined>;
  markPartAsArrived(id: number, updatedBy: number, actualDeliveryDate?: string, actualCost?: number, notes?: string): Promise<PartOnOrder | undefined>;
  markPartAsCollected(id: number, updatedBy: number): Promise<PartOnOrder | undefined>;
  notifyCustomerPartReady(id: number, updatedBy: number): Promise<boolean>;
  
  // Part Order Update operations
  getPartOrderUpdates(partOrderId: number): Promise<PartOrderUpdate[]>;
  createPartOrderUpdate(updateData: InsertPartOrderUpdate): Promise<PartOrderUpdate>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.role, role),
        eq(users.isActive, true)
      )
    );
  }

  async deactivateUser(id: number): Promise<boolean> {
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

  async getAllRegistrationRequests(): Promise<RegistrationRequest[]> {
    return await db.select().from(registrationRequests).orderBy(desc(registrationRequests.createdAt));
  }

  async getPendingRegistrationRequests(): Promise<RegistrationRequest[]> {
    return await db.select().from(registrationRequests)
      .where(eq(registrationRequests.status, 'pending'))
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
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();
    return !!deleted;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  // Equipment type operations removed - table was dropped

  // Equipment operations
  async getEquipment(id: number): Promise<Equipment | undefined> {
    const [equipmentItem] = await db.select().from(equipment).where(eq(equipment.id, id));
    return equipmentItem;
  }

  async getEquipmentByCustomer(customerId: number): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.customerId, customerId));
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: InsertEquipment): Promise<Equipment> {
    const [updatedEquipment] = await db
      .update(equipment)
      .set(equipmentData)
      .where(eq(equipment.id, id))
      .returning();
    return updatedEquipment;
  }

  async getAllEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment);
  }

  // Job operations
  async generateNextJobId(): Promise<string> {
    try {
      // Use a transaction to ensure atomic increment
      const result = await db.transaction(async (tx) => {
        // Get current counter or create one if it doesn't exist
        let [counter] = await tx.select().from(jobCounter).limit(1);
        
        if (!counter) {
          // Initialize counter if it doesn't exist
          [counter] = await tx.insert(jobCounter).values({
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
        
        return `WS-${newNumber}`;
      });
      
      return result;
    } catch (error) {
      console.error("Error generating job ID:", error);
      // Fallback to timestamp-based ID if database operation fails
      const timestamp = Date.now().toString().slice(-4);
      return `WS-1${timestamp}`;
    }
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    
    if (job && job.customerId) {
      // Fetch customer data to include in the job response
      const customer = await this.getCustomer(job.customerId);
      if (customer) {
        // Add customer data to the job object
        (job as any).customerName = customer.name;
        (job as any).customerEmail = customer.email || "";
        (job as any).customerPhone = customer.phone || "";
      }
    }
    
    return job;
  }

  async createJob(jobData: InsertJob): Promise<Job> {
    let finalCustomerId = jobData.customerId;
    
    // If no customerId but we have customerName, create or find customer
    if (!finalCustomerId && jobData.customerName) {
      // Try to find existing customer by name
      const existingCustomers = await db.select().from(customers).where(eq(customers.name, jobData.customerName));
      
      if (existingCustomers.length > 0) {
        finalCustomerId = existingCustomers[0].id;
      } else {
        // Create new customer
        const newCustomer = await this.createCustomer({
          name: jobData.customerName,
          email: jobData.customerEmail || undefined,
        });
        finalCustomerId = newCustomer.id;
      }
    }
    
    const jobInsertData = {
      ...jobData,
      customerId: finalCustomerId || null,
      status: jobData.status || (jobData.assignedTo ? "in_progress" : "waiting_assessment")
    };
    
    // Remove undefined fields to avoid Drizzle issues
    const cleanJobData = Object.fromEntries(
      Object.entries(jobInsertData).filter(([_, value]) => value !== undefined)
    );
    
    const [job] = await db.insert(jobs).values(cleanJobData as any).returning();
    
    // Create activity log
    await this.createActivity({
      userId: jobData.assignedTo || 1,
      activityType: 'job_created',
      description: `Job ${job.jobId} created`,
      entityType: 'job',
      entityId: job.id
    });
    
    return job;
  }

  async updateJob(id: number, jobData: Partial<Job>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set(jobData)
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async deleteJob(id: number): Promise<boolean> {
    try {
      // First delete related services
      await db.delete(services).where(eq(services.jobId, id));
      
      // Then delete related payment requests
      await db.delete(paymentRequests).where(eq(paymentRequests.jobId, id));
      
      // Delete related work completed records
      await db.delete(workCompleted).where(eq(workCompleted.jobId, id));
      
      // Delete related activities
      await db.delete(activities).where(
        and(
          eq(activities.entityType, 'job'),
          eq(activities.entityId, id)
        )
      );
      
      // Finally delete the job itself
      const deletedJobs = await db.delete(jobs).where(eq(jobs.id, id)).returning();
      
      return deletedJobs.length > 0;
    } catch (error) {
      console.error("Error deleting job:", error);
      throw error;
    }
  }

  async getAllJobs(): Promise<Job[]> {
    const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    
    // Enhance each job with customer data
    const enhancedJobs = await Promise.all(allJobs.map(async (job) => {
      if (job.customerId) {
        const customer = await this.getCustomer(job.customerId);
        if (customer) {
          (job as any).customerName = customer.name;
          (job as any).customerEmail = customer.email || "";
          (job as any).customerPhone = customer.phone || "";
        }
      }
      return job;
    }));
    
    return enhancedJobs;
  }

  async getActiveJobs(): Promise<Job[]> {
    return await db.select().from(jobs).where(
      and(
        ne(jobs.status, 'completed'),
        ne(jobs.status, 'cancelled')
      )
    );
  }

  // Service operations
  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getServicesByJob(jobId: number): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.jobId, jobId));
  }

  async getServicesByEquipment(equipmentId: number): Promise<Service[]> {
    // First get all jobs for this equipment
    const equipmentJobs = await db.select().from(jobs).where(eq(jobs.equipmentId, equipmentId));
    const jobIds = equipmentJobs.map(job => job.id);
    
    if (jobIds.length === 0) return [];
    
    return await db.select().from(services).where(sql`${services.jobId} IN (${jobIds.join(',')})`);
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values({
      ...serviceData,
      performedAt: serviceData.performedAt || new Date().toISOString()
    }).returning();
    
    // Create activity log
    await this.createActivity({
      userId: serviceData.performedBy || 1,
      activityType: 'service_created',
      description: `Service record created for job`,
      entityType: 'service',
      entityId: service.id
    });
    
    return service;
  }

  async updateService(id: number, serviceData: InsertService): Promise<Service> {
    const [service] = await db
      .update(services)
      .set(serviceData)
      .where(eq(services.id, id))
      .returning();
    return service;
  }

  async getAllServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  // Task operations
  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByAssignee(assignedTo: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.assignedTo, assignedTo));
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values({
      ...taskData,
      createdAt: new Date().toISOString()
    }).returning();
    
    // Create activity log
    await this.createActivity({
      userId: taskData.assignedTo || 1,
      activityType: 'task_created',
      description: `Task "${task.title}" created`,
      entityType: 'task',
      entityId: task.id
    });
    
    return task;
  }

  async updateTask(id: number, taskData: Partial<Task>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set(taskData)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async completeTask(id: number): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getPendingTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(
        ne(tasks.status, 'completed'),
        isNotNull(tasks.assignedTo)
      )
    );
  }

  // Activity operations
  async getAllActivities(limit: number = 50): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .orderBy(desc(activities.timestamp))
      .limit(limit);
  }

  async getActivityByUser(userId: number, limit: number = 50): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.timestamp))
      .limit(limit);
  }

  async getActivityByEntity(entityType: string, entityId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.entityType, entityType),
          eq(activities.entityId, entityId)
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
  async getJobUpdates(jobId: number): Promise<JobUpdate[]> {
    try {
      return await db
        .select()
        .from(jobUpdates)
        .where(eq(jobUpdates.jobId, jobId))
        .orderBy(desc(jobUpdates.createdAt));
    } catch (error) {
      console.error("Error getting job updates:", error);
      return [];
    }
  }

  async getPublicJobUpdates(jobId: number): Promise<JobUpdate[]> {
    try {
      return await db
        .select()
        .from(jobUpdates)
        .where(and(
          eq(jobUpdates.jobId, jobId),
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
  async getCallbackRequest(id: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, id));
    return callback;
  }

  async getCallbackRequestsByCustomer(customerId: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.customerId, customerId))
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getCallbackRequestsByAssignee(assignedTo: number): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.assignedTo, assignedTo))
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getPendingCallbackRequests(): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.status, 'pending'))
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getCompletedCallbackRequests(): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.status, 'completed'))
      .orderBy(desc(callbackRequests.completedAt));
  }

  async getAllCallbackRequests(): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(ne(callbackRequests.status, 'deleted'))
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getDeletedCallbackRequests(): Promise<CallbackRequest[]> {
    return await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.status, 'deleted'))
      .orderBy(desc(callbackRequests.deletedAt));
  }

  async createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest> {
    const [callback] = await db.insert(callbackRequests).values({
      ...callbackData,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    }).returning();
    return callback;
  }

  async updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set(callbackData)
      .where(eq(callbackRequests.id, id))
      .returning();
    return callback;
  }

  async completeCallbackRequest(id: number, notes?: string): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        notes: notes || null
      })
      .where(eq(callbackRequests.id, id))
      .returning();
    return callback;
  }

  async markCallbackAsDeleted(id: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set({
        status: 'deleted',
        deletedAt: new Date().toISOString()
      })
      .where(eq(callbackRequests.id, id))
      .returning();
    return callback;
  }

  async restoreDeletedCallback(id: number): Promise<CallbackRequest | undefined> {
    const [callback] = await db
      .update(callbackRequests)
      .set({
        status: 'pending',
        deletedAt: null
      })
      .where(eq(callbackRequests.id, id))
      .returning();
    return callback;
  }

  async permanentlyDeleteCallback(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(callbackRequests)
      .where(eq(callbackRequests.id, id))
      .returning();
    return !!deleted;
  }

  async purgeExpiredDeletedCallbacks(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();
    
    const result = await db
      .delete(callbackRequests)
      .where(
        and(
          eq(callbackRequests.status, 'deleted'),
          lt(callbackRequests.deletedAt, cutoffDate)
        )
      );
    
    return result.rowCount || 0;
  }

  // Work Completed operations
  async getWorkCompletedByJobId(jobId: number): Promise<WorkCompleted[]> {
    const workEntries = await db
      .select()
      .from(workCompleted)
      .where(eq(workCompleted.jobId, jobId))
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

  async updateWorkCompleted(id: number, workData: Partial<InsertWorkCompleted>): Promise<WorkCompleted | undefined> {
    const [workEntry] = await db
      .update(workCompleted)
      .set({
        ...workData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(workCompleted.id, id))
      .returning();
    
    if (!workEntry) return undefined;
    
    // Convert minutes back to hours and pence back to pounds for display
    return {
      ...workEntry,
      laborHours: workEntry.laborHours ? workEntry.laborHours / 60 : 0,
      partsCost: workEntry.partsCost ? workEntry.partsCost / 100 : null
    };
  }

  async deleteWorkCompleted(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(workCompleted)
      .where(eq(workCompleted.id, id))
      .returning();
    return !!deleted;
  }

  // Payment Request operations
  async getPaymentRequest(id: number): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
    return paymentRequest;
  }

  async getPaymentRequestByReference(reference: string): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db.select().from(paymentRequests).where(eq(paymentRequests.checkoutReference, reference));
    return paymentRequest;
  }

  async getPaymentRequestsByJob(jobId: number): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).where(eq(paymentRequests.jobId, jobId)).orderBy(desc(paymentRequests.createdAt));
  }

  async getAllPaymentRequests(): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
  }

  async createPaymentRequest(paymentData: InsertPaymentRequest): Promise<PaymentRequest> {
    // Generate a unique checkout reference if not provided
    const checkoutReference = paymentData.checkoutReference || this.generateCheckoutReference();
    
    // Ensure all required fields are set with proper defaults
    const insertData = {
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

  async updatePaymentRequest(id: number, paymentData: Partial<PaymentRequest>): Promise<PaymentRequest | undefined> {
    const [paymentRequest] = await db
      .update(paymentRequests)
      .set({
        ...paymentData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return paymentRequest;
  }

  async updatePaymentStatus(id: number, status: string, transactionData?: any): Promise<PaymentRequest | undefined> {
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
      .where(eq(paymentRequests.id, id))
      .returning();
    return paymentRequest;
  }

  // Job payment operations
  async recordJobPayment(jobId: number, paymentData: any, recordedBy: number): Promise<Job | undefined> {
    const [job] = await db
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
      .where(eq(jobs.id, jobId))
      .returning();
    
    if (job) {
      // Create activity log for payment recording
      await this.createActivity({
        userId: recordedBy,
        activityType: 'job_payment_recorded',
        description: `Payment recorded for job ${job.jobId} - £${paymentData.paymentAmount} via ${paymentData.paymentMethod}`,
        entityType: 'job',
        entityId: job.id
      });
    }
    
    return job;
  }

  async createJobPaymentRequest(jobId: number, requestData: any, createdBy: number): Promise<PaymentRequest> {
    // First, update the job to indicate a payment request is pending
    await db
      .update(jobs)
      .set({ paymentStatus: 'pending_payment_request' })
      .where(eq(jobs.id, jobId));

    // Create the payment request
    const paymentRequest = await this.createPaymentRequest({
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
      .where(eq(jobs.id, jobId));

    // Create activity log
    await this.createActivity({
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
    const paymentRequest = await this.getPaymentRequest(paymentRequestId);
    if (!paymentRequest || !paymentRequest.jobId) {
      return undefined;
    }

    const [job] = await db
      .update(jobs)
      .set({
        paymentStatus: 'paid',
        paymentAmount: paymentRequest.amount,
        paymentMethod: 'stripe',
        paidAt: new Date().toISOString(),
        paymentNotes: `Paid via Stripe - Reference: ${paymentRequest.checkoutReference}`
      })
      .where(eq(jobs.id, paymentRequest.jobId))
      .returning();

    if (job) {
      // Create activity log
      await this.createActivity({
        userId: paymentRequest.createdBy || 1,
        activityType: 'job_payment_completed',
        description: `Payment completed via Stripe for job ${job.jobId} - £${paymentRequest.amount / 100}`,
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
    const [job] = await db.select({
      id: jobs.id,
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
  async getPartOnOrder(id: number): Promise<PartOnOrder | undefined> {
    const [part] = await db.select().from(partsOnOrder).where(eq(partsOnOrder.id, id));
    return part;
  }

  async getAllPartsOnOrder(): Promise<PartOnOrder[]> {
    return await db.select().from(partsOnOrder).orderBy(desc(partsOnOrder.createdAt));
  }

  async getPartsOnOrderByStatus(status: string): Promise<PartOnOrder[]> {
    return await db.select().from(partsOnOrder)
      .where(eq(partsOnOrder.status, status))
      .orderBy(desc(partsOnOrder.createdAt));
  }

  async getOverduePartsOnOrder(daysSinceOrder: number = 8): Promise<PartOnOrder[]> {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysSinceOrder);
    
    return await db.select().from(partsOnOrder)
      .where(
        and(
          eq(partsOnOrder.isArrived, false),
          ne(partsOnOrder.status, 'cancelled'),
          ne(partsOnOrder.status, 'collected'),
          lt(partsOnOrder.orderDate, overdueDate.toISOString())
        )
      )
      .orderBy(partsOnOrder.orderDate);
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
          partOrderId: newPart.id,
          updateType: 'ordered',
          newStatus: 'ordered',
          notes: `Part ordered from ${newPart.supplier} for customer ${newPart.customerName}`,
          createdBy: partData.createdBy ?? 1
        });

    // Create activity log
    await this.createActivity({
      userId: partData.createdBy || 1,
      activityType: 'part_order_created',
      description: `Part ordered: ${newPart.partName} for ${newPart.customerName}`,
      entityType: 'part_order',
      entityId: newPart.id
    });

    return newPart;
  }

  async updatePartOnOrder(id: number, partData: Partial<PartOnOrder>): Promise<PartOnOrder | undefined> {
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
      .where(eq(partsOnOrder.id, id))
      .returning();

    return updatedPart;
  }

  async markPartAsArrived(id: number, updatedBy: number, actualDeliveryDate?: string, actualCost?: number, notes?: string): Promise<PartOnOrder | undefined> {
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
      .where(eq(partsOnOrder.id, id))
      .returning();

    if (updatedPart) {
      // Create tracking update
      await this.createPartOrderUpdate({
        partOrderId: updatedPart.id,
        updateType: 'arrived',
        previousStatus: 'ordered',
        newStatus: 'arrived',
        notes: notes || 'Part has arrived and is ready for customer collection',
        createdBy: updatedBy
      });

      // Create activity log
      await this.createActivity({
        userId: updatedBy,
        activityType: 'part_arrived',
        description: `Part arrived: ${updatedPart.partName} for ${updatedPart.customerName}`,
        entityType: 'part_order',
        entityId: updatedPart.id
      });
    }

    return updatedPart;
  }

  async markPartAsCollected(id: number, updatedBy: number): Promise<PartOnOrder | undefined> {
    const [updatedPart] = await db
      .update(partsOnOrder)
      .set({
        status: 'collected',
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      })
      .where(eq(partsOnOrder.id, id))
      .returning();

    if (updatedPart) {
      // Create tracking update
      await this.createPartOrderUpdate({
        partOrderId: updatedPart.id,
        updateType: 'collected',
        previousStatus: 'arrived',
        newStatus: 'collected',
        notes: 'Part collected by customer',
        createdBy: updatedBy
      });

      // Create activity log
      await this.createActivity({
        userId: updatedBy,
        activityType: 'part_collected',
        description: `Part collected: ${updatedPart.partName} by ${updatedPart.customerName}`,
        entityType: 'part_order',
        entityId: updatedPart.id
      });
    }

    return updatedPart;
  }

  async notifyCustomerPartReady(id: number, updatedBy: number): Promise<boolean> {
    const [updatedPart] = await db
      .update(partsOnOrder)
      .set({
        isCustomerNotified: true,
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      })
      .where(eq(partsOnOrder.id, id))
      .returning();

    if (updatedPart) {
      // Create tracking update
      await this.createPartOrderUpdate({
        partOrderId: updatedPart.id,
        updateType: 'customer_notified',
        newStatus: updatedPart.status,
        notes: 'Customer notified that part is ready for collection',
        createdBy: updatedBy
      });

      // Create activity log
      await this.createActivity({
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
  async getPartOrderUpdates(partOrderId: number): Promise<PartOrderUpdate[]> {
    return await db.select().from(partOrderUpdates)
      .where(eq(partOrderUpdates.partOrderId, partOrderId))
      .orderBy(desc(partOrderUpdates.createdAt));
  }

    async createPartOrderUpdate(updateData: InsertPartOrderUpdate): Promise<PartOrderUpdate> {
      const [newUpdate] = await db.insert(partOrderUpdates).values({
        ...updateData,
        createdBy: updateData.createdBy ?? 1
      }).returning();

      return newUpdate;
  }
}

export const storage = new DatabaseStorage();