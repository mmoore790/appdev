import { 
  users, User, InsertUser,
  customers, Customer, InsertCustomer,
  equipmentTypes, EquipmentType, InsertEquipmentType,
  equipment, Equipment, InsertEquipment,
  jobs, Job, InsertJob,
  services, Service, InsertService,
  tasks, Task, InsertTask,
  registrationRequests, RegistrationRequest, InsertRegistrationRequest,
  callbackRequests, CallbackRequest, InsertCallbackRequest,
  jobUpdates, JobUpdate, InsertJobUpdate,
  activities, Activity, InsertActivity
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
  searchCustomers(query: string): Promise<Customer[]>;

  // Equipment Type operations
  getEquipmentType(id: number): Promise<EquipmentType | undefined>;
  createEquipmentType(equipmentType: InsertEquipmentType): Promise<EquipmentType>;
  updateEquipmentType(id: number, equipmentType: Partial<InsertEquipmentType>): Promise<EquipmentType | undefined>;
  getAllEquipmentTypes(): Promise<EquipmentType[]>;

  // Equipment operations
  getEquipment(id: number): Promise<Equipment | undefined>;
  getEquipmentByCustomer(customerId: number): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  getAllEquipment(): Promise<Equipment[]>;

  // Job operations
  getJob(id: number): Promise<Job | undefined>;
  getJobByJobId(jobId: string): Promise<Job | undefined>;
  getJobsByCustomer(customerId: number): Promise<Job[]>;
  getJobsByAssignee(assignedTo: number): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<Job>): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getActiveJobs(): Promise<Job[]>;

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


  
  // Callback Request operations
  getCallbackRequest(id: number): Promise<CallbackRequest | undefined>;
  getCallbackRequestsByCustomer(customerId: number): Promise<CallbackRequest[]>;
  getCallbackRequestsByAssignee(assignedTo: number): Promise<CallbackRequest[]>;
  getPendingCallbackRequests(): Promise<CallbackRequest[]>;
  getAllCallbackRequests(): Promise<CallbackRequest[]>;
  getDeletedCallbackRequests(): Promise<CallbackRequest[]>;
  createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest>;
  updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>): Promise<CallbackRequest | undefined>;
  completeCallbackRequest(id: number, notes?: string): Promise<CallbackRequest | undefined>;
  markCallbackAsDeleted(id: number): Promise<CallbackRequest | undefined>;
  restoreDeletedCallback(id: number): Promise<CallbackRequest | undefined>;
  permanentlyDeleteCallback(id: number): Promise<boolean>;
  purgeExpiredDeletedCallbacks(): Promise<number>;
  
  // Callback Request operations
  getCallbackRequest(id: number): Promise<CallbackRequest | undefined>;
  getCallbackRequestsByCustomer(customerId: number): Promise<CallbackRequest[]>;
  getCallbackRequestsByAssignee(assignedTo: number): Promise<CallbackRequest[]>;
  getPendingCallbackRequests(): Promise<CallbackRequest[]>;
  getAllCallbackRequests(): Promise<CallbackRequest[]>;
  getDeletedCallbackRequests(): Promise<CallbackRequest[]>;
  createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest>;
  updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>): Promise<CallbackRequest | undefined>;
  completeCallbackRequest(id: number, notes?: string): Promise<CallbackRequest | undefined>;
  markCallbackAsDeleted(id: number): Promise<CallbackRequest | undefined>;
  restoreDeletedCallback(id: number): Promise<CallbackRequest | undefined>;
  permanentlyDeleteCallback(id: number): Promise<boolean>;
  purgeExpiredDeletedCallbacks(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Workshop Activity operations
  async getAllActivities(limit: number = 20): Promise<Activity[]> {
    return await db.select().from(activities).orderBy(desc(activities.timestamp)).limit(limit);
  }
  
  async getActivityByUser(userId: number, limit: number = 20): Promise<Activity[]> {
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
      .where(and(
        eq(activities.entityType, entityType),
        eq(activities.entityId, entityId)
      ))
      .orderBy(desc(activities.timestamp));
  }
  
  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(activityData).returning();
    return activity;
  }
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
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }



  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async deactivateUser(id: number): Promise<boolean> {
    const [user] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning();
    return !!user;
  }

  // Registration operations
  async createRegistrationRequest(requestData: InsertRegistrationRequest): Promise<RegistrationRequest> {
    const [request] = await db.insert(registrationRequests).values(requestData).returning();
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
    return await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.status, "pending"))
      .orderBy(desc(registrationRequests.createdAt));
  }

  async updateRegistrationRequestStatus(
    id: number, 
    status: string, 
    reviewedBy: number, 
    notes?: string
  ): Promise<RegistrationRequest | undefined> {
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
    const [customer] = await db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();
    return !!customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const lowercaseQuery = query.toLowerCase();
    const results = await db.select().from(customers);
    
    // Filtering in memory for now since Drizzle ORM doesn't have straightforward
    // case-insensitive search across multiple columns
    return results.filter(
      (customer) => 
        customer.name.toLowerCase().includes(lowercaseQuery) ||
        (customer.email && customer.email.toLowerCase().includes(lowercaseQuery)) ||
        (customer.phone && customer.phone.includes(lowercaseQuery))
    );
  }

  // Equipment Type operations
  async getEquipmentType(id: number): Promise<EquipmentType | undefined> {
    const [equipmentType] = await db.select().from(equipmentTypes).where(eq(equipmentTypes.id, id));
    return equipmentType;
  }

  async createEquipmentType(equipmentTypeData: InsertEquipmentType): Promise<EquipmentType> {
    const [equipmentType] = await db.insert(equipmentTypes).values(equipmentTypeData).returning();
    return equipmentType;
  }

  async updateEquipmentType(id: number, equipmentTypeData: Partial<InsertEquipmentType>): Promise<EquipmentType | undefined> {
    const [equipmentType] = await db
      .update(equipmentTypes)
      .set(equipmentTypeData)
      .where(eq(equipmentTypes.id, id))
      .returning();
    return equipmentType;
  }

  async getAllEquipmentTypes(): Promise<EquipmentType[]> {
    return await db.select().from(equipmentTypes);
  }

  // Equipment operations
  async getEquipment(id: number): Promise<Equipment | undefined> {
    const [equipment] = await db.select().from(equipment).where(eq(equipment.id, id));
    return equipment;
  }

  async getEquipmentByCustomer(customerId: number): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.customerId, customerId));
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment | undefined> {
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
  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobId, jobId));
    return job;
  }

  async getJobsByCustomer(customerId: number): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.customerId, customerId));
  }

  async getJobsByAssignee(assignedTo: number): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.assignedTo, assignedTo));
  }

  async createJob(jobData: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values({
      ...jobData,
      createdAt: new Date().toISOString(),
      completedAt: null,
      actualHours: null,
      customerNotified: false
    }).returning();
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

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs);
  }

  async getActiveJobs(): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(
        and(
          ne(jobs.status, "waiting_assessment"),
          ne(jobs.status, "completed"),
          ne(jobs.status, "cancelled")
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
    const jobsWithEquipment = await db
      .select()
      .from(jobs)
      .where(eq(jobs.equipmentId, equipmentId));
    
    const jobIds = jobsWithEquipment.map(job => job.id);
    
    if (jobIds.length === 0) {
      return [];
    }
    
    // For simplicity, this doesn't use the "in" operator but it should in production
    const allServices = await db.select().from(services);
    return allServices.filter(service => jobIds.includes(service.jobId));
  }

  async createService(serviceData: InsertService): Promise<Service> {
    // Make sure performedAt is set if not provided
    if (!serviceData.performedAt) {
      serviceData.performedAt = new Date().toISOString();
    }
    
    const [service] = await db.insert(services).values(serviceData).returning();
    return service;
  }
  
  async updateService(id: number, serviceData: InsertService): Promise<Service> {
    // First check if the service exists
    const existingService = await this.getService(id);
    if (!existingService) {
      throw new Error(`Service with ID ${id} not found`);
    }
    
    // Update the service
    const [updatedService] = await db
      .update(services)
      .set(serviceData)
      .where(eq(services.id, id))
      .returning();
    
    return updatedService;
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
      createdAt: new Date().toISOString(),
      completedAt: null
    }).returning();
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



  // Message operations
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessagesBySender(senderId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.senderId, senderId))
      .orderBy(desc(messages.createdAt));
  }

  async getMessagesByRecipient(recipientId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.recipientId, recipientId))
      .orderBy(desc(messages.createdAt));
  }

  async getMessagesByJob(jobId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.relatedJobId, jobId))
      .orderBy(desc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
    return result.length;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values({
      ...messageData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRead: false
    }).returning();
    return message;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true, updatedAt: new Date().toISOString() })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  async deleteMessage(id: number): Promise<boolean> {
    // First delete attachments linked to this message
    await db
      .delete(messageAttachments)
      .where(eq(messageAttachments.messageId, id));
    
    // Then delete the message
    const [deleted] = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning();
    return !!deleted;
  }

  async cleanupOldMessages(days: number): Promise<number> {
    // Calculate the cutoff date (n days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = cutoffDate.toISOString();
    
    // Get IDs of messages to delete
    const oldMessages = await db
      .select({ id: messages.id })
      .from(messages)
      .where(lt(messages.createdAt, cutoffDateString));
      
    const messageIds = oldMessages.map(m => m.id);
    
    // If there are no old messages, return 0
    if (messageIds.length === 0) {
      return 0;
    }
    
    // Delete attachments first
    for (const id of messageIds) {
      await db
        .delete(messageAttachments)
        .where(eq(messageAttachments.messageId, id));
    }
    
    // Delete the messages
    // Note: In a production system with large data, this would be better done
    // using a batch delete approach with a single SQL query
    let deleteCount = 0;
    for (const id of messageIds) {
      const result = await db
        .delete(messages)
        .where(eq(messages.id, id))
        .returning();
      
      if (result.length > 0) {
        deleteCount++;
      }
    }
    
    return deleteCount;
  }

  // Message Attachment operations
  async getMessageAttachment(id: number): Promise<MessageAttachment | undefined> {
    const [attachment] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, id));
    return attachment;
  }

  async getAttachmentsByMessage(messageId: number): Promise<MessageAttachment[]> {
    return await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
  }

  async createMessageAttachment(attachmentData: InsertMessageAttachment): Promise<MessageAttachment> {
    const [attachment] = await db.insert(messageAttachments).values({
      ...attachmentData,
      uploadedAt: new Date().toISOString()
    }).returning();
    return attachment;
  }

  async deleteMessageAttachment(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(messageAttachments)
      .where(eq(messageAttachments.id, id))
      .returning();
    return !!deleted;
  }

  // Callback Request operations
  async getCallbackRequest(id: number): Promise<CallbackRequest | undefined> {
    const [callbackRequest] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, id));
    return callbackRequest;
  }

  async getCallbackRequestsByCustomer(customerId: number): Promise<CallbackRequest[]> {
    return await db.select().from(callbackRequests).where(eq(callbackRequests.customerId, customerId))
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getCallbackRequestsByAssignee(assignedTo: number): Promise<CallbackRequest[]> {
    return await db.select().from(callbackRequests).where(eq(callbackRequests.assignedTo, assignedTo))
      .orderBy(desc(callbackRequests.requestedAt));
  }

  async getPendingCallbackRequests(): Promise<CallbackRequest[]> {
    return await db.select()
      .from(callbackRequests)
      .where(and(
        eq(callbackRequests.status, 'pending'),
        isNull(callbackRequests.deletedAt)
      ))
      .orderBy(desc(callbackRequests.requestedAt));
  }
  
  async getCompletedCallbackRequests(): Promise<CallbackRequest[]> {
    return await db.select()
      .from(callbackRequests)
      .where(and(
        eq(callbackRequests.status, 'completed'),
        isNull(callbackRequests.deletedAt)
      ))
      .orderBy(desc(callbackRequests.completedAt));
  }

  async createCallbackRequest(callbackData: InsertCallbackRequest): Promise<CallbackRequest> {
    // First create a task for the assigned user
    const taskTitle = `Customer Callback Request: ${callbackData.subject}`;
    const taskDescription = `Call back ${callbackData.customerName} at ${callbackData.phoneNumber}. ${callbackData.details || ''}`;
    
    // Create the task
    const task = await this.createTask({
      title: taskTitle,
      description: taskDescription,
      priority: callbackData.priority,
      status: 'pending',
      assignedTo: callbackData.assignedTo,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Set due date to tomorrow
      relatedJobId: null
    });
    
    // Try to find existing customer by name, or leave customerId as null if none found
    let customerId = null;
    if (callbackData.customerName) {
      const existingCustomer = await db
        .select()
        .from(customers)
        .where(eq(customers.name, callbackData.customerName))
        .limit(1);
      
      if (existingCustomer.length > 0) {
        customerId = existingCustomer[0].id;
      }
    }
    
    // Now create the callback request with the related task ID
    const [callbackRequest] = await db.insert(callbackRequests).values({
      ...callbackData,
      customerId,
      relatedTaskId: task.id,
      requestedAt: new Date().toISOString(),
      completedAt: null
    }).returning();
    
    return callbackRequest;
  }

  async updateCallbackRequest(id: number, callbackData: Partial<CallbackRequest>): Promise<CallbackRequest | undefined> {
    const [callbackRequest] = await db
      .update(callbackRequests)
      .set(callbackData)
      .where(eq(callbackRequests.id, id))
      .returning();
    
    // If the status changes to completed, also update the related task
    if (callbackData.status === 'completed' && callbackRequest.relatedTaskId) {
      await this.completeTask(callbackRequest.relatedTaskId);
    }
    
    return callbackRequest;
  }

  async completeCallbackRequest(id: number, notes?: string): Promise<CallbackRequest | undefined> {
    const callbackRequest = await this.getCallbackRequest(id);
    if (!callbackRequest) {
      return undefined;
    }
    
    // Update the callback request status
    const [updatedCallback] = await db
      .update(callbackRequests)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        notes: notes || callbackRequest.notes
      })
      .where(eq(callbackRequests.id, id))
      .returning();
    
    // Also complete the related task if it exists
    if (updatedCallback.relatedTaskId) {
      await this.completeTask(updatedCallback.relatedTaskId);
    }
    
    return updatedCallback;
  }

  async getAllCallbackRequests(): Promise<CallbackRequest[]> {
    return await db.select().from(callbackRequests)
      .where(isNull(callbackRequests.deletedAt))
      .orderBy(desc(callbackRequests.requestedAt));
  }
  
  async getDeletedCallbackRequests(): Promise<CallbackRequest[]> {
    return await db.select().from(callbackRequests)
      .where(isNotNull(callbackRequests.deletedAt))
      .orderBy(desc(callbackRequests.requestedAt));
  }
  
  async markCallbackAsDeleted(id: number): Promise<CallbackRequest | undefined> {
    const callbackRequest = await this.getCallbackRequest(id);
    if (!callbackRequest) {
      return undefined;
    }
    
    // Set delete expiration to 24 hours from now
    const deleteExpiresAt = new Date();
    deleteExpiresAt.setHours(deleteExpiresAt.getHours() + 24);
    
    // Update the callback request status
    const [updatedCallback] = await db
      .update(callbackRequests)
      .set({
        status: 'deleted',
        deletedAt: new Date().toISOString(),
        deleteExpiresAt: deleteExpiresAt.toISOString()
      })
      .where(eq(callbackRequests.id, id))
      .returning();
    
    return updatedCallback;
  }
  
  async restoreDeletedCallback(id: number): Promise<CallbackRequest | undefined> {
    const callbackRequest = await this.getCallbackRequest(id);
    if (!callbackRequest || callbackRequest.status !== 'deleted') {
      return undefined;
    }
    
    // Restore to pending status
    const [restoredCallback] = await db
      .update(callbackRequests)
      .set({
        status: 'pending',
        deletedAt: null,
        deleteExpiresAt: null
      })
      .where(eq(callbackRequests.id, id))
      .returning();
    
    return restoredCallback;
  }
  
  async permanentlyDeleteCallback(id: number): Promise<boolean> {
    const callbackRequest = await this.getCallbackRequest(id);
    if (!callbackRequest) {
      return false;
    }
    
    // Permanently delete
    const [deleted] = await db
      .delete(callbackRequests)
      .where(eq(callbackRequests.id, id))
      .returning();
    
    return !!deleted;
  }
  
  async purgeExpiredDeletedCallbacks(): Promise<number> {
    // Get current timestamp
    const now = new Date().toISOString();
    
    // Find callbacks where delete has expired
    const expiredCallbacks = await db
      .select({ id: callbackRequests.id })
      .from(callbackRequests)
      .where(
        and(
          eq(callbackRequests.status, 'deleted'),
          lt(callbackRequests.deleteExpiresAt, now)
        )
      );
    
    const callbackIds = expiredCallbacks.map(cb => cb.id);
    
    // If there are no expired callbacks, return 0
    if (callbackIds.length === 0) {
      return 0;
    }
    
    // Permanently delete expired callbacks
    const deleted = await db
      .delete(callbackRequests)
      .where(
        and(
          eq(callbackRequests.status, 'deleted'),
          lt(callbackRequests.deleteExpiresAt, now)
        )
      );
    
    return callbackIds.length;
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private customers: Map<number, Customer>;
  private equipmentTypes: Map<number, EquipmentType>;
  private equipment: Map<number, Equipment>;
  private jobs: Map<number, Job>;
  private services: Map<number, Service>;
  private tasks: Map<number, Task>;
  private activities: Map<number, Activity>;

  private userIdCounter: number;
  private customerIdCounter: number;
  private equipmentTypeIdCounter: number;
  private equipmentIdCounter: number;
  private jobIdCounter: number;
  private serviceIdCounter: number;
  private taskIdCounter: number;
  private activityIdCounter: number;

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.equipmentTypes = new Map();
    this.equipment = new Map();
    this.jobs = new Map();
    this.services = new Map();
    this.tasks = new Map();
    this.activities = new Map();

    this.userIdCounter = 1;
    this.customerIdCounter = 1;
    this.equipmentTypeIdCounter = 1;
    this.equipmentIdCounter = 1;
    this.jobIdCounter = 1;
    this.serviceIdCounter = 1;
    this.taskIdCounter = 1;
    this.activityIdCounter = 1;

    this.initializeDemoData();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = this.customerIdCounter++;
    const newCustomer: Customer = { ...customer, id };
    this.customers.set(id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    if (!existingCustomer) return undefined;

    const updatedCustomer = { ...existingCustomer, ...customer };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.customers.delete(id);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    query = query.toLowerCase();
    return Array.from(this.customers.values()).filter(
      (customer) => customer.name.toLowerCase().includes(query) ||
                     (customer.email && customer.email.toLowerCase().includes(query)) ||
                     (customer.phone && customer.phone.includes(query))
    );
  }

  // Equipment Type operations
  async getEquipmentType(id: number): Promise<EquipmentType | undefined> {
    return this.equipmentTypes.get(id);
  }

  async createEquipmentType(equipmentType: InsertEquipmentType): Promise<EquipmentType> {
    const id = this.equipmentTypeIdCounter++;
    const newEquipmentType: EquipmentType = { ...equipmentType, id };
    this.equipmentTypes.set(id, newEquipmentType);
    return newEquipmentType;
  }

  async updateEquipmentType(id: number, equipmentType: Partial<InsertEquipmentType>): Promise<EquipmentType | undefined> {
    const existingEquipmentType = this.equipmentTypes.get(id);
    if (!existingEquipmentType) return undefined;

    const updatedEquipmentType = { ...existingEquipmentType, ...equipmentType };
    this.equipmentTypes.set(id, updatedEquipmentType);
    return updatedEquipmentType;
  }

  async getAllEquipmentTypes(): Promise<EquipmentType[]> {
    return Array.from(this.equipmentTypes.values());
  }

  // Equipment operations
  async getEquipment(id: number): Promise<Equipment | undefined> {
    return this.equipment.get(id);
  }

  async getEquipmentByCustomer(customerId: number): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(
      (equipment) => equipment.customerId === customerId
    );
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const id = this.equipmentIdCounter++;
    const newEquipment: Equipment = { ...equipmentData, id };
    this.equipment.set(id, newEquipment);
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const existingEquipment = this.equipment.get(id);
    if (!existingEquipment) return undefined;

    const updatedEquipment = { ...existingEquipment, ...equipmentData };
    this.equipment.set(id, updatedEquipment);
    return updatedEquipment;
  }

  async getAllEquipment(): Promise<Equipment[]> {
    return Array.from(this.equipment.values());
  }

  // Job operations
  async getJob(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    return Array.from(this.jobs.values()).find(job => job.jobId === jobId);
  }

  async getJobsByCustomer(customerId: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.customerId === customerId
    );
  }

  async getJobsByAssignee(assignedTo: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.assignedTo === assignedTo
    );
  }

  async createJob(jobData: InsertJob): Promise<Job> {
    const id = this.jobIdCounter++;
    const createdAt = new Date().toISOString();
    const newJob: Job = { 
      ...jobData, 
      id, 
      createdAt, 
      completedAt: null,
      actualHours: null,
      customerNotified: false
    };
    this.jobs.set(id, newJob);
    return newJob;
  }

  async updateJob(id: number, jobData: Partial<Job>): Promise<Job | undefined> {
    const existingJob = this.jobs.get(id);
    if (!existingJob) return undefined;

    const updatedJob = { ...existingJob, ...jobData };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getActiveJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status !== 'completed' && job.status !== 'cancelled'
    );
  }

  // Service operations
  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getServicesByJob(jobId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(
      (service) => service.jobId === jobId
    );
  }

  async getServicesByEquipment(equipmentId: number): Promise<Service[]> {
    const jobsWithEquipment = Array.from(this.jobs.values()).filter(
      job => job.equipmentId === equipmentId
    );
    
    const jobIds = jobsWithEquipment.map(job => job.id);
    
    return Array.from(this.services.values()).filter(
      service => jobIds.includes(service.jobId)
    );
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const id = this.serviceIdCounter++;
    const performedAt = new Date().toISOString();
    const newService: Service = { ...serviceData, id, performedAt };
    this.services.set(id, newService);
    return newService;
  }
  
  async updateService(id: number, serviceData: InsertService): Promise<Service> {
    const existingService = await this.getService(id);
    if (!existingService) {
      throw new Error(`Service with ID ${id} not found`);
    }
    
    // Create updated service object, preserving the original id and created date
    const updatedService: Service = { 
      ...existingService,
      ...serviceData,
      id, // Ensure the ID stays the same
    };
    
    // Update the service in our storage
    this.services.set(id, updatedService);
    
    return updatedService;
  }

  async getAllServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  // Task operations
  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByAssignee(assignedTo: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.assignedTo === assignedTo
    );
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const createdAt = new Date().toISOString();
    const newTask: Task = { 
      ...taskData, 
      id, 
      createdAt, 
      completedAt: null 
    };
    this.tasks.set(id, newTask);
    return newTask;
  }

  async updateTask(id: number, taskData: Partial<Task>): Promise<Task | undefined> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) return undefined;

    const updatedTask = { ...existingTask, ...taskData };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async completeTask(id: number): Promise<Task | undefined> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) return undefined;

    const completedTask = { 
      ...existingTask, 
      status: 'completed', 
      completedAt: new Date().toISOString() 
    };
    this.tasks.set(id, completedTask);
    return completedTask;
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getPendingTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.status === 'pending'
    );
  }


  
  // Message operations
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesBySender(senderId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.senderId === senderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getMessagesByRecipient(recipientId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.recipientId === recipientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getMessagesByJob(jobId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.relatedJobId === jobId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    return Array.from(this.messages.values())
      .filter(message => message.recipientId === userId && !message.isRead)
      .length;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date().toISOString();
    const message: Message = {
      ...messageData,
      id,
      isRead: false,
      createdAt: now,
      updatedAt: now
    };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = {
      ...message,
      isRead: true,
      updatedAt: new Date().toISOString()
    };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  async deleteMessage(id: number): Promise<boolean> {
    return this.messages.delete(id);
  }
  
  // Message Attachment operations
  async getMessageAttachment(id: number): Promise<MessageAttachment | undefined> {
    return this.messageAttachments.get(id);
  }

  async getAttachmentsByMessage(messageId: number): Promise<MessageAttachment[]> {
    return Array.from(this.messageAttachments.values())
      .filter(attachment => attachment.messageId === messageId);
  }

  async createMessageAttachment(attachmentData: InsertMessageAttachment): Promise<MessageAttachment> {
    const id = this.messageAttachmentIdCounter++;
    const attachment: MessageAttachment = {
      ...attachmentData,
      id,
      uploadedAt: new Date().toISOString()
    };
    this.messageAttachments.set(id, attachment);
    return attachment;
  }

  async deleteMessageAttachment(id: number): Promise<boolean> {
    return this.messageAttachments.delete(id);
  }

  // Initialize demo data
  private initializeDemoData() {
    // Add a default admin user
    this.createUser({
      username: "admin",
      password: "password", // In a real app, this would be hashed
      fullName: "John Moore",
      role: "admin",
      email: "john@moorehorticulture.com",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    });

    // Add mechanics
    this.createUser({
      username: "james",
      password: "password",
      fullName: "James Morgan",
      role: "mechanic",
      email: "james@moorehorticulture.com",
      avatarUrl: null
    });

    this.createUser({
      username: "sarah",
      password: "password",
      fullName: "Sarah Kim",
      role: "mechanic",
      email: "sarah@moorehorticulture.com",
      avatarUrl: null
    });

    this.createUser({
      username: "robert",
      password: "password",
      fullName: "Robert Lee",
      role: "mechanic",
      email: "robert@moorehorticulture.com",
      avatarUrl: null
    });

    // Add customers
    this.createCustomer({
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "555-123-4567",
      address: "123 Main St, Anytown, USA",
      notes: "Regular customer, prefers pickup on weekends"
    });

    this.createCustomer({
      name: "Alice Johnson",
      email: "alice.j@example.com",
      phone: "555-987-6543",
      address: "456 Oak Ave, Somewhere, USA",
      notes: "New customer as of May 2023"
    });

    this.createCustomer({
      name: "Tom Wilson",
      email: "tom.w@example.com",
      phone: "555-567-8901",
      address: "789 Pine Rd, Elsewhere, USA",
      notes: "Commercial account, priority service"
    });

    this.createCustomer({
      name: "Maria Perez",
      email: "maria.p@example.com",
      phone: "555-234-5678",
      address: "101 Maple Dr, Nowhere, USA",
      notes: "Prefers communication by phone"
    });

    // Add equipment types
    this.createEquipmentType({
      name: "Lawn Mower",
      brand: "Honda",
      model: "HRX217",
      commonRepairs: "Carburetor issues, blade sharpening",
      stockQuantity: 15,
      imageUrl: "https://pixabay.com/get/g6bb0b88dd450d9b82be02c909fe53e3f41c59f138dd5ca5810e427b0271f113d8ead094c236b1788eef6b0878d9547efa646161db5e139d1211b977df6c49a32_1280.jpg"
    });

    this.createEquipmentType({
      name: "Hedge Trimmer",
      brand: "Stihl",
      model: "HSA 56",
      commonRepairs: "Cutting blade issues, motor problems",
      stockQuantity: 3,
      imageUrl: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=400"
    });

    this.createEquipmentType({
      name: "Chainsaw",
      brand: "Husqvarna",
      model: "450",
      commonRepairs: "Chain tension, starter cord",
      stockQuantity: 0,
      imageUrl: "https://images.unsplash.com/photo-1628624747186-a941c476b7ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=400"
    });

    this.createEquipmentType({
      name: "Tiller",
      brand: "Troy-Bilt",
      model: "Super Bronco",
      commonRepairs: "Belt replacement, tine maintenance",
      stockQuantity: 5,
      imageUrl: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=400"
    });

    // Add equipment for customers
    this.createEquipment({
      serialNumber: "A2345",
      typeId: 1, // Lawn Mower
      customerId: 1, // John Smith
      purchaseDate: new Date("2022-05-15").toISOString(),
      notes: "Purchased with extended warranty"
    });

    this.createEquipment({
      serialNumber: "B8721",
      typeId: 2, // Hedge Trimmer
      customerId: 2, // Alice Johnson
      purchaseDate: new Date("2023-02-10").toISOString(),
      notes: "First maintenance due in August"
    });

    this.createEquipment({
      serialNumber: "C4534",
      typeId: 3, // Chainsaw
      customerId: 3, // Tom Wilson
      purchaseDate: new Date("2021-11-25").toISOString(),
      notes: "Commercial grade, heavy usage"
    });

    this.createEquipment({
      serialNumber: "D6789",
      typeId: 4, // Tiller
      customerId: 4, // Maria Perez
      purchaseDate: new Date("2023-04-05").toISOString(),
      notes: "Residential use only"
    });

    // Add jobs
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);
    
    const fiveHoursAgo = new Date(now);
    fiveHoursAgo.setHours(now.getHours() - 5);

    this.createJob({
      jobId: "WS-2023-089",
      equipmentId: 1,
      customerId: 1,
      assignedTo: 2, // James Morgan
      status: "completed",
      description: "Regular maintenance",
      taskDetails: "Oil change, blade sharpening, filter replacement",
      estimatedHours: 2
    }).then(job => {
      // Mark as completed
      this.updateJob(job.id, { 
        completedAt: now.toISOString(),
        actualHours: 2,
        customerNotified: true
      });

      // Add a service record
      this.createService({
        jobId: job.id,
        serviceType: "Maintenance",
        details: "Oil change, blade sharpening, filter replacement",
        performedBy: 2, // James Morgan
        partsUsed: [
          { name: "Oil filter", quantity: 1 },
          { name: "Engine oil", quantity: 1 },
          { name: "Air filter", quantity: 1 }
        ],
        cost: 8500, // $85.00
        notes: "Customer requested additional carburetor cleaning"
      });

      // Add activity
      this.createActivity({
        userId: 2,
        activityType: "job_completed",
        description: "Completed service on Lawn Mower #A2345",
        entityType: "job",
        entityId: job.id
      });
    });

    this.createJob({
      jobId: "WS-2023-090",
      equipmentId: 2,
      customerId: 2,
      assignedTo: 3, // Sarah Kim
      status: "in_progress",
      description: "Repair motor and align cutting blades",
      taskDetails: "Motor repair, cutting blade alignment",
      estimatedHours: 3
    }).then(job => {
      // Add activity
      this.createActivity({
        userId: 3,
        activityType: "job_started",
        description: "Started repair on Hedge Trimmer #B8721",
        entityType: "job",
        entityId: job.id
      });
    });

    this.createJob({
      jobId: "WS-2023-091",
      equipmentId: 3,
      customerId: 3,
      assignedTo: 4, // Robert Lee
      status: "parts_ordered",
      description: "Chainsaw maintenance and repair",
      taskDetails: "Initial assessment completed, parts ordered",
      estimatedHours: 4
    }).then(job => {
      // Add activity
      this.createActivity({
        userId: 4,
        activityType: "job_received",
        description: "Received Chainsaw #C4534 for maintenance",
        entityType: "job",
        entityId: job.id
      });
    });

    this.createJob({
      jobId: "WS-2023-092",
      equipmentId: 4,
      customerId: 4,
      assignedTo: null, // Unassigned
      status: "waiting_assessment",
      description: "Tiller not starting, possible fuel issue",
      taskDetails: "",
      estimatedHours: null
    });

    // Add tasks
    this.createTask({
      title: "Contact John Smith about lawn mower repair quote",
      description: "Need to discuss additional services and quote approval",
      priority: "high",
      status: "pending",
      assignedTo: 1, // Admin (John Moore)
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), // Today
      relatedJobId: 1
    });

    this.createTask({
      title: "Order replacement parts for hedge trimmer inventory",
      description: "We're running low on cutting blades and motor assemblies",
      priority: "medium",
      status: "pending",
      assignedTo: 3, // Sarah
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString(), // In 2 days
      relatedJobId: null
    });

    this.createTask({
      title: "Schedule maintenance for delivery vehicles",
      description: "All three trucks need oil changes and tire rotations",
      priority: "low",
      status: "pending",
      assignedTo: 4, // Robert
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString(), // Next week
      relatedJobId: null
    });

    this.createTask({
      title: "Follow up with customers about equipment pickup",
      description: "Several completed repairs have not been picked up yet",
      priority: "medium",
      status: "pending",
      assignedTo: 1, // Admin (John Moore)
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(), // Tomorrow
      relatedJobId: null
    });
  }

  // Job updates operations
  async createJobUpdate(updateData: InsertJobUpdate): Promise<JobUpdate> {
    try {
      const [jobUpdate] = await db
        .insert(jobUpdates)
        .values(updateData)
        .returning();
      
      return jobUpdate;
    } catch (error) {
      console.error("Error creating job update:", error);
      throw error;
    }
  }
  
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
        .where(
          and(
            eq(jobUpdates.jobId, jobId),
            eq(jobUpdates.isPublic, true)
          )
        )
        .orderBy(desc(jobUpdates.createdAt));
    } catch (error) {
      console.error("Error getting public job updates:", error);
      return [];
    }
  }
}

// Use DatabaseStorage for the application
export const storage = new DatabaseStorage();
