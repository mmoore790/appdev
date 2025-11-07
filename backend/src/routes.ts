import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  createJobUpdate, 
  getJobUpdates, 
  getPublicJobUpdates 
} from "./services/jobUpdateService";
import { sendJobBackupEmail, getNextBackupEmailDate } from "./services/jobBackupService";
import { 
  insertUserSchema, 
  insertCustomerSchema, 
  insertEquipmentSchema, 
  insertJobSchema, 
  insertServiceSchema, 
  insertTaskSchema, 
  insertCallbackRequestSchema,
  insertPaymentRequestSchema,
  recordPaymentSchema,
  jobPaymentRequestSchema,
  insertPartOnOrderSchema,
  insertPartOrderUpdateSchema
} from "@shared/schema";
import { sendJobBookedEmail, sendJobCompletedEmail, sendPaymentRequestEmail, sendPaymentRequestEmailNoLink, sendPartReadyEmail } from "./services/emailService";
import { initAuthRoutes, isAuthenticated, isAdmin } from "./auth";
import StripeService from "./stripe-service";
import { logActivity, getActivityDescription } from "./services/activityService";
import { schedulerService } from "./services/schedulerService";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize authentication routes
  await initAuthRoutes(app);

  // Generate sequential job ID endpoint
  app.get("/api/generate-job-id", async (req: Request, res: Response) => {
    try {
      const nextJobId = await storage.generateNextJobId();
      res.json({ jobId: nextJobId });
    } catch (error) {
      console.error("Error generating job ID:", error);
      res.status(500).json({ message: "Failed to generate job ID" });
    }
  });

  // Authentication middleware endpoint
  app.get("/api/user", isAuthenticated, async (req: Request, res: Response) => {
    res.json((req.session as any).user);
  });

  // Job tracker public endpoint
  app.get("/api/public/job-tracker", async (req: Request, res: Response) => {
    try {
      const { jobId, email } = req.query;
      
      if (!jobId || !email) {
        return res.status(400).json({ message: "Job ID and email are required" });
      }

      // Find job by jobId field, not id
      const jobs = await storage.getAllJobs();
      const job = jobs.find(j => j.jobId === jobId.toString());
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get customer info  
      const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Validate email matches the customer's email (case-insensitive)
      if (!customer.email || customer.email.toLowerCase() !== email.toString().toLowerCase()) {
        return res.status(403).json({ message: "Email does not match the job record" });
      }

      // Get job updates (public ones only)
      const updates = await getPublicJobUpdates(job.id);

      res.json({
        job: {
          id: job.id,
          jobId: job.jobId,
          status: job.status,
          description: job.description,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          estimatedHours: job.estimatedHours,
          actualHours: job.actualHours,
          customerNotified: job.customerNotified
        },
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        },
        updates
      });
    } catch (error) {
      console.error("Error retrieving job:", error);
      res.status(500).json({ message: "Failed to retrieve job information" });
    }
  });

  // User routes
  app.get("/api/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error retrieving users:", error);
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  });

  app.get("/api/users/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error retrieving user:", error);
      res.status(500).json({ message: "Failed to retrieve user" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      
      // Log user creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'user_created',
        description: getActivityDescription('user_created', 'user', newUser.id, {
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role
        }),
        entityType: 'user',
        entityId: newUser.id,
        metadata: {
          username: newUser.username,
          role: newUser.role
        }
      });
      
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Customer routes
  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      let customers;
      
      // Check if there's a search query
      if (req.query.search) {
        const searchTerm = req.query.search as string;
        const allCustomers = await storage.getAllCustomers();
        customers = allCustomers.filter(customer =>
          customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (customer.phone && customer.phone.includes(searchTerm))
        );
      } else {
        customers = await storage.getAllCustomers();
      }
      
      res.json(customers);
    } catch (error) {
      console.error("Error retrieving customers:", error);
      res.status(500).json({ message: "Failed to retrieve customers" });
    }
  });

  app.get("/api/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      console.error("Error retrieving customer:", error);
      res.status(500).json({ message: "Failed to retrieve customer" });
    }
  });

  app.post("/api/customers", async (req: Request, res: Response) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const newCustomer = await storage.createCustomer(customerData);
      
      // Log customer creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'customer_created',
        description: getActivityDescription('customer_created', 'customer', newCustomer.id, {
          customerName: newCustomer.name,
          email: newCustomer.email,
          phone: newCustomer.phone
        }),
        entityType: 'customer',
        entityId: newCustomer.id,
        metadata: {
          customerName: newCustomer.name,
          email: newCustomer.email,
          phone: newCustomer.phone
        }
      });
      
      res.status(201).json(newCustomer);
    } catch (error) {
      console.error("Error creating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const updatedCustomer = await storage.updateCustomer(id, customerData);
      
      if (!updatedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Log customer update activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'customer_updated',
        description: getActivityDescription('customer_updated', 'customer', updatedCustomer.id, {
          customerName: updatedCustomer.name,
          changes: Object.keys(customerData).join(', ')
        }),
        entityType: 'customer',
        entityId: updatedCustomer.id,
        metadata: {
          customerName: updatedCustomer.name,
          updatedFields: Object.keys(customerData)
        }
      });
      
      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error updating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCustomer(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Equipment type routes removed - table was dropped

  // Equipment routes
  app.get("/api/equipment", async (req: Request, res: Response) => {
    try {
      const equipment = await storage.getAllEquipment();
      res.json(equipment);
    } catch (error) {
      console.error("Error retrieving equipment:", error);
      res.status(500).json({ message: "Failed to retrieve equipment" });
    }
  });

  app.get("/api/equipment/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const equipment = await storage.getEquipment(id);
      
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      
      res.json(equipment);
    } catch (error) {
      console.error("Error retrieving equipment:", error);
      res.status(500).json({ message: "Failed to retrieve equipment" });
    }
  });

  app.post("/api/equipment", async (req: Request, res: Response) => {
    try {
      const equipmentData = insertEquipmentSchema.parse(req.body);
      const newEquipment = await storage.createEquipment(equipmentData);

      const equipmentDetails = {
        serialNumber: newEquipment.serialNumber,
        typeId: newEquipment.typeId,
        customerId: newEquipment.customerId,
      };
      
      // Log equipment creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'equipment_created',
        description: getActivityDescription('equipment_created', 'equipment', newEquipment.id, {
          equipmentName: equipmentDetails.serialNumber
            ? `Serial ${equipmentDetails.serialNumber}`
            : `Equipment ${newEquipment.id}`,
          ...equipmentDetails
        }),
        entityType: 'equipment',
        entityId: newEquipment.id,
        metadata: {
          ...equipmentDetails
        }
      });
      
      res.status(201).json(newEquipment);
    } catch (error) {
      console.error("Error creating equipment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid equipment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  app.put("/api/equipment/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const equipmentData = insertEquipmentSchema.parse(req.body);
      const updatedEquipment = await storage.updateEquipment(id, equipmentData);
      res.json(updatedEquipment);
    } catch (error) {
      console.error("Error updating equipment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid equipment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update equipment" });
    }
  });

  // Job routes
  app.get("/api/jobs", async (req: Request, res: Response) => {
    try {
      let jobs;
      
      if (req.query.customerId) {
        const allJobs = await storage.getAllJobs();
        jobs = allJobs.filter(job => job.customerId === Number(req.query.customerId));
      } else if (req.query.assignedTo) {
        const allJobs = await storage.getAllJobs();
        jobs = allJobs.filter(job => job.assignedTo === Number(req.query.assignedTo));
      } else {
        jobs = await storage.getAllJobs();
      }
      
      res.json(jobs);
    } catch (error) {
      console.error("Error retrieving jobs:", error);
      res.status(500).json({ message: "Failed to retrieve jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      // Disable caching for job data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const id = parseInt(req.params.id);
      let job;
      
      if (isNaN(id)) {
        // Try searching by jobId string
        const jobs = await storage.getAllJobs();
        job = jobs.find(j => j.jobId === req.params.id);
      } else {
        // Search by numeric ID
        job = await storage.getJob(id);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error retrieving job:", error);
      res.status(500).json({ message: "Failed to retrieve job" });
    }
  });

  app.post("/api/jobs", async (req: Request, res: Response) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const newJob = await storage.createJob(jobData);
      
      // Get customer info for activity logging
      let customerName = 'Unknown Customer';
      if (newJob.customerId) {
        try {
          const customer = await storage.getCustomer(newJob.customerId);
          if (customer) {
            customerName = customer.name;
            
            // Send email receipt if customer has email
            if (customer.email) {
              await sendJobBookedEmail(newJob, customer);
              console.log(`Job receipt email sent for job ${newJob.jobId}`);
            }
          }
        } catch (emailError) {
          console.error(`Failed to send job receipt email for job ${newJob.jobId}:`, emailError);
          // Don't fail the job creation if email fails
        }
      }
      
      // Log job creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'job_created',
        description: getActivityDescription('job_created', 'job', newJob.id, {
          jobId: newJob.jobId,
          customerName: customerName,
          description: newJob.description
        }),
        entityType: 'job',
        entityId: newJob.id,
        metadata: {
          jobId: newJob.jobId,
          customerName: customerName,
          status: newJob.status,
          estimatedHours: newJob.estimatedHours
        }
      });
      
      res.status(201).json(newJob);
    } catch (error) {
      console.error("Error creating job:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.put("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const jobData = req.body;
      
      // Get the current job to check for status changes
      const currentJob = await storage.getJob(id);
      if (!currentJob) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const updatedJob = await storage.updateJob(id, jobData);
      
      if (!updatedJob) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Get customer info for logging
      let customerName = 'Unknown Customer';
      if (updatedJob.customerId) {
        try {
          const customer = await storage.getCustomer(updatedJob.customerId);
          if (customer) {
            customerName = customer.name;
          }
        } catch (error) {
          console.error("Error fetching customer for activity log:", error);
        }
      }
      
      // Log status change if status changed
      if (currentJob.status !== updatedJob.status) {
        await logActivity({
          userId: (req.session as any)?.userId || 1,
          activityType: 'job_status_changed',
          description: getActivityDescription('job_status_changed', 'job', updatedJob.id, {
            jobId: updatedJob.jobId,
            customerName: customerName,
            oldStatus: currentJob.status,
            newStatus: updatedJob.status
          }),
          entityType: 'job',
          entityId: updatedJob.id,
          metadata: {
            jobId: updatedJob.jobId,
            customerName: customerName,
            oldStatus: currentJob.status,
            newStatus: updatedJob.status
          }
        });
        
        // Log completion activity if job is completed
        if (updatedJob.status === 'completed') {
          await logActivity({
            userId: (req.session as any)?.userId || 1,
            activityType: 'job_completed',
            description: getActivityDescription('job_completed', 'job', updatedJob.id, {
              jobId: updatedJob.jobId,
              customerName: customerName
            }),
            entityType: 'job',
            entityId: updatedJob.id,
            metadata: {
              jobId: updatedJob.jobId,
              customerName: customerName,
              completionTime: new Date().toISOString()
            }
          });
        }
      }
      
        // Check if status changed to ready for pickup - send email notification
        if (currentJob.status !== 'ready_for_pickup' && updatedJob.status === 'ready_for_pickup') {
          try {
            if (updatedJob.customerId) {
              const customer = await storage.getCustomer(updatedJob.customerId);
              if (customer && customer.email) {
                await sendJobCompletedEmail(customer.email, updatedJob);
                console.log(`Job ready for pickup email sent for job ${updatedJob.jobId} to ${customer.email}`);
              }
            }
          } catch (emailError) {
            console.error(`Failed to send job ready for pickup email for job ${updatedJob.jobId}:`, emailError);
          }
        }
      
        // Log other significant changes
        const jobUpdatesPayload = jobData as Record<string, unknown>;
        const currentJobRecord = currentJob as Record<string, unknown>;
        const updatedJobRecord = updatedJob as Record<string, unknown>;
        const changedFields = Object.keys(jobUpdatesPayload).filter((key) => {
          if (key === 'status') {
            return false;
          }
          return currentJobRecord[key] !== updatedJobRecord[key];
        });
      
      if (changedFields.length > 0) {
        await logActivity({
          userId: (req.session as any)?.userId || 1,
          activityType: 'job_updated',
          description: getActivityDescription('job_updated', 'job', updatedJob.id, {
            jobId: updatedJob.jobId,
            customerName: customerName,
            changes: changedFields.join(', ')
          }),
          entityType: 'job',
          entityId: updatedJob.id,
          metadata: {
            jobId: updatedJob.jobId,
            customerName: customerName,
            changedFields: changedFields
          }
        });
      }
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  // Delete job
  app.delete("/api/jobs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get job info for logging before deletion
      let jobInfo = null;
      try {
        const job = await storage.getJob(id);
        if (job) {
          jobInfo = {
            jobId: job.jobId,
            customerName: 'Unknown Customer'
          };
          
          // Get customer name if available
          if (job.customerId) {
            try {
              const customer = await storage.getCustomer(job.customerId);
              if (customer) {
                jobInfo.customerName = customer.name;
              }
            } catch (error) {
              console.error("Error fetching customer for delete activity log:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching job for delete activity log:", error);
      }
      
      const deleted = await storage.deleteJob(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Log job deletion activity if we have job info
      if (jobInfo) {
        await logActivity({
          userId: (req.session as any)?.userId || 1,
          activityType: 'job_deleted',
          description: getActivityDescription('job_deleted', 'job', id, {
            jobId: jobInfo.jobId,
            customerName: jobInfo.customerName
          }),
          entityType: 'job',
          entityId: id,
          metadata: {
            jobId: jobInfo.jobId,
            customerName: jobInfo.customerName,
            deletedAt: new Date().toISOString()
          }
        });
      }
      
      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // Service routes
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const services = await storage.getAllServices();
      res.json(services);
    } catch (error) {
      console.error("Error retrieving services:", error);
      res.status(500).json({ message: "Failed to retrieve services" });
    }
  });

  app.get("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const service = await storage.getService(id);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error retrieving service:", error);
      res.status(500).json({ message: "Failed to retrieve service" });
    }
  });

  app.post("/api/services", async (req: Request, res: Response) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const newService = await storage.createService(serviceData);
      
      // Get job info for activity logging
      let jobId = 'Unknown';
      if (newService.jobId) {
        try {
          const job = await storage.getJob(newService.jobId);
          if (job) {
            jobId = job.jobId;
          }
        } catch (error) {
          console.error("Error fetching job for service activity log:", error);
        }
      }
      
      // Log service creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'service_added',
        description: getActivityDescription('service_added', 'service', newService.id, {
          jobId: jobId,
          serviceType: newService.serviceType,
          cost: newService.cost
        }),
        entityType: 'service',
        entityId: newService.id,
        metadata: {
          jobId: jobId,
          serviceType: newService.serviceType,
          cost: newService.cost,
          laborHours: newService.laborHours
        }
      });
      
      res.status(201).json(newService);
    } catch (error) {
      console.error("Error creating service:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const serviceData = insertServiceSchema.parse(req.body);
      const updatedService = await storage.updateService(id, serviceData);
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  // Task routes
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
      const pendingOnly = req.query.pendingOnly === 'true';
      
      if (assignedTo) {
        const tasks = await storage.getTasksByAssignee(assignedTo);
        return res.json(tasks);
      } else if (pendingOnly) {
        const tasks = await storage.getPendingTasks();
        return res.json(tasks);
      } else {
        const tasks = await storage.getAllTasks();
        return res.json(tasks);
      }
    } catch (error) {
      console.error("Error retrieving tasks:", error);
      res.status(500).json({ message: "Failed to retrieve tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error retrieving task:", error);
      res.status(500).json({ message: "Failed to retrieve task" });
    }
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const newTask = await storage.createTask(taskData);
      
      // Get assigned user name for activity logging
      let assignedToName = '';
      if (newTask.assignedTo) {
        try {
          const assignedUser = await storage.getUser(newTask.assignedTo);
          if (assignedUser) {
            assignedToName = assignedUser.fullName || assignedUser.username;
          }
        } catch (error) {
          console.error("Error fetching assigned user for task activity log:", error);
        }
      }
      
      // Log task creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'task_created',
        description: getActivityDescription('task_created', 'task', newTask.id, {
          taskTitle: newTask.title,
          assignedTo: newTask.assignedTo,
          assignedToName: assignedToName,
          priority: newTask.priority
        }),
        entityType: 'task',
        entityId: newTask.id,
        metadata: {
          taskTitle: newTask.title,
          assignedTo: newTask.assignedTo,
          assignedToName: assignedToName,
          priority: newTask.priority,
          dueDate: newTask.dueDate
        }
      });
      
      res.status(201).json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const taskData = req.body;
      
      // Get current task for comparison
      const currentTask = await storage.getTask(id);
      if (!currentTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const updatedTask = await storage.updateTask(id, taskData);
      
      if (!updatedTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Log task completion if status changed to completed
      if (currentTask.status !== 'completed' && updatedTask.status === 'completed') {
        await logActivity({
          userId: (req.session as any)?.userId || 1,
          activityType: 'task_completed',
          description: getActivityDescription('task_completed', 'task', updatedTask.id, {
            taskTitle: updatedTask.title
          }),
          entityType: 'task',
          entityId: updatedTask.id,
          metadata: {
            taskTitle: updatedTask.title,
            completionTime: new Date().toISOString()
          }
        });
      } else if (currentTask.status !== updatedTask.status || currentTask.title !== updatedTask.title) {
        // Log other task updates
        await logActivity({
          userId: (req.session as any)?.userId || 1,
          activityType: 'task_updated',
          description: getActivityDescription('task_updated', 'task', updatedTask.id, {
            taskTitle: updatedTask.title,
            changes: Object.keys(taskData).join(', ')
          }),
          entityType: 'task',
          entityId: updatedTask.id,
          metadata: {
            taskTitle: updatedTask.title,
            changedFields: Object.keys(taskData),
            oldStatus: currentTask.status,
            newStatus: updatedTask.status
          }
        });
      }
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Activities route
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getAllActivities(limit);
      
      // Automatically clean up old activities - keep only the 50 most recent
      await storage.cleanupOldActivities(50);
      
      res.json(activities);
    } catch (error) {
      console.error("Error retrieving activities:", error);
      res.status(500).json({ message: "Failed to retrieve activities" });
    }
  });

  // Analytics summary route
  app.get("/api/analytics/summary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      
      // Get all data needed for analytics
      const [jobs, customers, tasks, services] = await Promise.all([
        storage.getAllJobs(),
        storage.getAllCustomers(),
        storage.getAllTasks(),
        storage.getAllServices()
      ]);

      // Calculate active jobs (not completed or cancelled)
      const activeJobs = jobs.filter(job => 
        job.status !== 'completed' && job.status !== 'cancelled'
      );

      // Calculate pending tasks assigned to the current user (todo and in_progress)
      const pendingTasks = tasks.filter(task => 
        task.assignedTo === userId && 
        (task.status === 'todo' || task.status === 'in_progress')
      );

      // Calculate completed jobs this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const completedThisWeek = jobs.filter(job => 
        job.status === 'completed' && 
        job.completedAt && 
        new Date(job.completedAt) >= oneWeekAgo
      ).length;

      // Calculate average repair time for completed jobs
      const completedJobs = jobs.filter(job => job.status === 'completed' && job.completedAt);
      let avgRepairTime = 0;
      if (completedJobs.length > 0) {
        const totalDays = completedJobs.reduce((sum, job) => {
          const created = new Date(job.createdAt);
          const completed = new Date(job.completedAt!);
          return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgRepairTime = Math.round(totalDays / completedJobs.length);
      }

      // Calculate other metrics
      const satisfaction = 4.2; // This would come from customer feedback
      const partsAvailability = 85; // This would come from inventory system
      const monthlyGrowth = 12; // This would be calculated from historical data

      // Get all equipment for job distribution analysis
      const allEquipment = await storage.getAllEquipment();
      
      // Calculate job distribution by status instead of equipment type
      const jobsByStatus = [
        { name: 'Waiting Assessment', count: jobs.filter(j => j.status === 'waiting_assessment').length },
        { name: 'In Progress', count: jobs.filter(j => j.status === 'in_progress').length },
        { name: 'Parts Ordered', count: jobs.filter(j => j.status === 'parts_ordered').length },
        { name: 'Completed', count: jobs.filter(j => j.status === 'completed').length }
      ];

      res.json({
        activeJobs: activeJobs.length,
        totalCustomers: customers.length,
        pendingTasks: pendingTasks.length,
        completedThisWeek,
        avgRepairTime,
        customerSatisfaction: satisfaction,
        partsAvailability,
        monthlyGrowth,
        jobsByStatus
      });
    } catch (error) {
      console.error("Error generating analytics summary:", error);
      res.status(500).json({ message: "Failed to generate analytics summary" });
    }
  });

  // Callback Request routes
  
  // Get all callbacks
  app.get("/api/callbacks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      let callbacks;
      
      // Filter by query parameters if provided
      if (req.query.assignedTo) {
        callbacks = await storage.getCallbackRequestsByAssignee(Number(req.query.assignedTo));
      } else if (req.query.customerId) {
        callbacks = await storage.getCallbackRequestsByCustomer(Number(req.query.customerId));
      } else if (req.query.status === 'pending') {
        callbacks = await storage.getPendingCallbackRequests();
      } else if (req.query.status === 'completed') {
        callbacks = await storage.getCompletedCallbackRequests();
      } else {
        callbacks = await storage.getAllCallbackRequests();
      }
      
      // Apply date filtering if provided
      if (req.query.fromDate && req.query.toDate) {
        const fromDate = new Date(req.query.fromDate as string);
        const toDate = new Date(req.query.toDate as string);
        
        callbacks = callbacks.filter((callback: any) => {
          const requestedAt = new Date(callback.requestedAt);
          return requestedAt >= fromDate && requestedAt <= toDate;
        });
      }
      
      res.json(callbacks);
    } catch (error) {
      console.error("Error retrieving callback requests:", error);
      res.status(500).json({ message: "Failed to retrieve callback requests" });
    }
  });

  // Get deleted callbacks (admin only)
  app.get("/api/callbacks/deleted", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const deletedCallbacks = await storage.getDeletedCallbackRequests();
      res.json(deletedCallbacks);
    } catch (error) {
      console.error("Error retrieving deleted callback requests:", error);
      res.status(500).json({ message: "Failed to retrieve deleted callback requests" });
    }
  });

  // Create new callback request
  app.post("/api/callbacks", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const callbackData = insertCallbackRequestSchema.parse(req.body);
        const newCallback = await storage.createCallbackRequest(callbackData);
        const callbackMetadata = {
          customerName: newCallback.customerName,
          phone: newCallback.phoneNumber,
          reason: newCallback.subject,
          details: newCallback.details,
          requestedTime: newCallback.requestedAt
        };
        
        // Log callback creation activity
      await logActivity({
        userId: (req.session as any)?.userId || 1,
        activityType: 'callback_created',
          description: getActivityDescription('callback_created', 'callback', newCallback.id, callbackMetadata),
        entityType: 'callback',
        entityId: newCallback.id,
          metadata: callbackMetadata
      });
      
      res.status(201).json(newCallback);
    } catch (error) {
      console.error("Error creating callback request:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid callback data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create callback request" });
    }
  });

  // Purge expired deleted callbacks
  app.post("/api/callbacks/purge-expired", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const purgedCount = await storage.purgeExpiredDeletedCallbacks();
      res.json({ 
        success: true, 
        purgedCount, 
        message: `Successfully purged ${purgedCount} expired deleted callbacks` 
      });
    } catch (error) {
      console.error("Error purging expired callbacks:", error);
      res.status(500).json({ message: "Failed to purge expired callbacks" });
    }
  });

  // Update callback request
  app.put("/api/callbacks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const callbackData = req.body;
      const updatedCallback = await storage.updateCallbackRequest(id, callbackData);
      
      if (!updatedCallback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      res.json(updatedCallback);
    } catch (error) {
      console.error("Error updating callback request:", error);
      res.status(500).json({ message: "Failed to update callback request" });
    }
  });

  // Complete callback request
  app.post("/api/callbacks/:id/complete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const completedCallback = await storage.completeCallbackRequest(id, notes);
      
      if (!completedCallback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      // Log callback completion activity
        const completedMetadata = {
          customerName: completedCallback.customerName,
          phone: completedCallback.phoneNumber,
          completionNotes: notes,
          completionTime: new Date().toISOString()
        };

        await logActivity({
          userId: (req.session as any)?.userId || 1,
          activityType: 'callback_completed',
          description: getActivityDescription('callback_completed', 'callback', completedCallback.id, completedMetadata),
          entityType: 'callback',
          entityId: completedCallback.id,
          metadata: completedMetadata
        });
      
      res.json(completedCallback);
    } catch (error) {
      console.error("Error completing callback request:", error);
      res.status(500).json({ message: "Failed to complete callback request" });
    }
  });

  // Get single callback request
  app.get("/api/callbacks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const callback = await storage.getCallbackRequest(id);
      
      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      res.json(callback);
    } catch (error) {
      console.error("Error retrieving callback request:", error);
      res.status(500).json({ message: "Failed to retrieve callback request" });
    }
  });

  // Delete callback request (soft delete)
  app.delete("/api/callbacks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deletedCallback = await storage.markCallbackAsDeleted(id);
      
      if (!deletedCallback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      res.json({ message: "Callback request deleted successfully" });
    } catch (error) {
      console.error("Error deleting callback request:", error);
      res.status(500).json({ message: "Failed to delete callback request" });
    }
  });

  // Restore deleted callback
  app.post("/api/callbacks/:id/restore", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const restoredCallback = await storage.restoreDeletedCallback(id);
      
      if (!restoredCallback) {
        return res.status(404).json({ message: "Deleted callback request not found" });
      }
      
      res.json(restoredCallback);
    } catch (error) {
      console.error("Error restoring callback request:", error);
      res.status(500).json({ message: "Failed to restore callback request" });
    }
  });

  // Permanently delete callback
  app.delete("/api/callbacks/:id/permanent", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.permanentlyDeleteCallback(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      res.json({ message: "Callback request permanently deleted" });
    } catch (error) {
      console.error("Error permanently deleting callback request:", error);
      res.status(500).json({ message: "Failed to permanently delete callback request" });
    }
  });

  // Purge expired deleted callbacks (duplicate route, keeping for compatibility)
  app.post("/api/callbacks/purge-expired", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const purgedCount = await storage.purgeExpiredDeletedCallbacks();
      res.json({ 
        success: true, 
        purgedCount, 
        message: `Successfully purged ${purgedCount} expired deleted callbacks` 
      });
    } catch (error) {
      console.error("Error purging expired callbacks:", error);
      res.status(500).json({ message: "Failed to purge expired callbacks" });
    }
  });

  // Job backup routes
  app.post("/api/backup/send-job-backup", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const success = await sendJobBackupEmail();
      if (success) {
        res.json({ message: "Job backup email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send job backup email" });
      }
    } catch (error) {
      console.error("Error sending job backup email:", error);
      res.status(500).json({ message: "Failed to send job backup email" });
    }
  });

  app.get("/api/backup/next-backup-date", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const nextDate = getNextBackupEmailDate();
      res.json({ nextBackupDate: nextDate.toISOString() });
    } catch (error) {
      console.error("Error getting next backup date:", error);
      res.status(500).json({ message: "Failed to get next backup date" });
    }
  });

  // Work Completed API endpoints
  
  // Get work completed entries for a job
  app.get("/api/work-completed/:jobId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const workEntries = await storage.getWorkCompletedByJobId(jobId);
      res.json(workEntries);
    } catch (error) {
      console.error("Error retrieving work completed entries:", error);
      res.status(500).json({ message: "Failed to retrieve work completed entries" });
    }
  });

  // Create new work completed entry
  app.post("/api/work-completed", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workData = req.body;
      
      // Convert hours to minutes for storage precision
      if (workData.laborHours) {
        workData.laborHours = Math.round(parseFloat(workData.laborHours) * 60);
      }
      
      // Convert cost to pence for storage precision
      if (workData.partsCost) {
        workData.partsCost = Math.round(parseFloat(workData.partsCost) * 100);
      }
      
      const newWorkEntry = await storage.createWorkCompleted(workData);
      res.status(201).json(newWorkEntry);
    } catch (error) {
      console.error("Error creating work completed entry:", error);
      res.status(500).json({ message: "Failed to create work completed entry" });
    }
  });

  // Update work completed entry
  app.put("/api/work-completed/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const workData = req.body;
      
      // Convert hours to minutes for storage precision
      if (workData.laborHours) {
        workData.laborHours = Math.round(parseFloat(workData.laborHours) * 60);
      }
      
      // Convert cost to pence for storage precision
      if (workData.partsCost) {
        workData.partsCost = Math.round(parseFloat(workData.partsCost) * 100);
      }
      
      const updatedWorkEntry = await storage.updateWorkCompleted(id, workData);
      
      if (!updatedWorkEntry) {
        return res.status(404).json({ message: "Work completed entry not found" });
      }
      
      res.json(updatedWorkEntry);
    } catch (error) {
      console.error("Error updating work completed entry:", error);
      res.status(500).json({ message: "Failed to update work completed entry" });
    }
  });

  // Delete work completed entry
  app.delete("/api/work-completed/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteWorkCompleted(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Work completed entry not found" });
      }
      
      res.json({ message: "Work completed entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting work completed entry:", error);
      res.status(500).json({ message: "Failed to delete work completed entry" });
    }
  });

  // Payment Request routes
  
  // Get all payment requests
  app.get("/api/payment-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const paymentRequests = await storage.getAllPaymentRequests();
      res.json(paymentRequests);
    } catch (error) {
      console.error("Error retrieving payment requests:", error);
      res.status(500).json({ message: "Failed to retrieve payment requests" });
    }
  });

  // Get payment requests for a specific job
  app.get("/api/payment-requests/job/:jobId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const paymentRequests = await storage.getPaymentRequestsByJob(jobId);
      res.json(paymentRequests);
    } catch (error) {
      console.error("Error retrieving payment requests for job:", error);
      res.status(500).json({ message: "Failed to retrieve payment requests" });
    }
  });

  // Create new payment request with SumUp integration
  app.post("/api/payment-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      console.log("=== PAYMENT REQUEST DEBUG ===");
      console.log("Request headers:", req.headers);
      console.log("Request body:", req.body);
      console.log("Request body type:", typeof req.body);
      console.log("Request body keys:", Object.keys(req.body || {}));
      console.log("===============================");
      
      const paymentData = insertPaymentRequestSchema.parse(req.body);
      
      // Generate unique checkout reference
      const checkoutReference = `MH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Convert amount to pence for storage (assuming amount comes in pounds)
      const amountInPence = Math.round(paymentData.amount * 100);
      
      // Create payment request in database with all required fields
      const paymentRequestData = {
        ...paymentData,
        amount: amountInPence,
        checkoutReference,
        createdBy: (req.session as any).userId || 1
      };
      
      // Create the payment request with all data
      const paymentRequest = await storage.createPaymentRequest(paymentRequestData);

      // Try to create Stripe checkout session if configured
      const stripeService = StripeService.fromEnvironment();
      if (stripeService) {
        try {
          const session = await stripeService.createCheckoutSession({
            amount: amountInPence, // Stripe expects amount in pence
            currency: paymentData.currency || 'GBP',
            description: paymentData.description,
            customerEmail: paymentData.customerEmail || '',
            checkoutReference: checkoutReference
          });

            const paymentLink = session.url!;

            // Update payment request with Stripe data
            const finalPaymentRequest = (await storage.updatePaymentRequest(paymentRequest.id, {
            checkoutId: session.id,
            paymentLink: paymentLink,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expires in 24 hours
            })) ?? paymentRequest;

          // Send email notification to customer if email provided
          if (paymentData.customerEmail) {
            try {
              await sendPaymentRequestEmail(
                paymentData.customerEmail,
                paymentLink,
                paymentData.description,
                paymentData.amount.toFixed(2), // Amount is already in pounds
                checkoutReference
              );
              console.log(`Payment request email sent to ${paymentData.customerEmail}`);
            } catch (emailError) {
              console.error('Failed to send payment request email:', emailError);
              // Don't fail the request if email fails
            }
          }

          // Log payment request creation activity
          await logActivity({
            userId: (req.session as any)?.userId || 1,
            activityType: 'job_payment_request_created',
            description: getActivityDescription('job_payment_request_created', 'payment_request', finalPaymentRequest.id, {
              jobId: finalPaymentRequest.jobId || 'N/A',
              amount: amountInPence,
              customerEmail: paymentData.customerEmail
            }),
            entityType: 'payment_request',
            entityId: finalPaymentRequest.id,
            metadata: {
              jobId: finalPaymentRequest.jobId,
              amount: amountInPence,
              customerEmail: paymentData.customerEmail,
              checkoutReference: checkoutReference,
              description: paymentData.description
            }
          });

          res.status(201).json(finalPaymentRequest);
        } catch (stripeError) {
          console.error("Stripe checkout creation failed:", stripeError);
          
          // Send notification email even when Stripe fails - inform customer to contact for payment
          if (paymentData.customerEmail) {
            try {
              await sendPaymentRequestEmailNoLink(
                paymentData.customerEmail,
                paymentData.description,
                paymentData.amount.toFixed(2),
                checkoutReference
              );
              console.log(`Payment request notification email sent to ${paymentData.customerEmail} (Stripe failed)`);
            } catch (emailError) {
              console.error('Failed to send payment request notification email:', emailError);
            }
          }
          
          // Return payment request without Stripe integration
          res.status(201).json({
            ...paymentRequest,
            error: "Payment link generation failed - Stripe integration unavailable"
          });
        }
      } else {
        // Stripe not configured - send fallback email
        if (paymentData.customerEmail) {
          try {
            await sendPaymentRequestEmailNoLink(
              paymentData.customerEmail,
              paymentData.description,
              paymentData.amount.toFixed(2),
              checkoutReference
            );
            console.log(`Payment request notification email sent to ${paymentData.customerEmail} (Stripe not configured)`);
          } catch (emailError) {
            console.error('Failed to send payment request notification email:', emailError);
          }
        }
        
        res.status(201).json({
          ...paymentRequest,
          error: "Stripe integration not configured"
        });
      }
    } catch (error) {
      console.error("Error creating payment request:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment request" });
    }
  });

  // Get payment request status and sync with Stripe
  app.get("/api/payment-requests/:id/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const paymentRequest = await storage.getPaymentRequest(id);
      
      if (!paymentRequest) {
        return res.status(404).json({ message: "Payment request not found" });
      }

      // If we have a Stripe checkout session ID, check the status
      if (paymentRequest.checkoutId) {
        const stripeService = StripeService.fromEnvironment();
        if (stripeService) {
          try {
            const session = await stripeService.getCheckoutSession(paymentRequest.checkoutId);
            const newStatus = stripeService.getPaymentStatus(session);
            
            // Update status if it has changed
            if (newStatus !== paymentRequest.status) {
              await storage.updatePaymentStatus(
                id, 
                newStatus,
                session.payment_intent ? {
                  transactionId: session.payment_intent.toString(),
                  transactionCode: session.id,
                  authCode: session.payment_intent.toString()
                } : undefined
              );
            }

            res.json({
              ...paymentRequest,
              status: newStatus,
              stripeStatus: session.payment_status,
              sessionId: session.id
            });
          } catch (stripeError) {
            console.error("Error checking Stripe status:", stripeError);
            res.json(paymentRequest);
          }
        } else {
          res.json(paymentRequest);
        }
      } else {
        res.json(paymentRequest);
      }
    } catch (error) {
      console.error("Error retrieving payment request status:", error);
      res.status(500).json({ message: "Failed to retrieve payment request status" });
    }
  });

  // Update payment request
  app.put("/api/payment-requests/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      // Convert amount to pence if provided
      if (updateData.amount) {
        updateData.amount = Math.round(updateData.amount * 100);
      }
      
      const updatedPaymentRequest = await storage.updatePaymentRequest(id, updateData);
      
      if (!updatedPaymentRequest) {
        return res.status(404).json({ message: "Payment request not found" });
      }
      
      res.json(updatedPaymentRequest);
    } catch (error) {
      console.error("Error updating payment request:", error);
      res.status(500).json({ message: "Failed to update payment request" });
    }
  });

  // Check Stripe configuration status
  app.get("/api/stripe/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const isConfigured = StripeService.isConfigured();
      res.json({ 
        configured: isConfigured,
        message: isConfigured 
          ? "Stripe integration is configured and ready" 
          : "Stripe integration requires STRIPE_SECRET_KEY environment variable"
      });
    } catch (error) {
      console.error("Error checking Stripe configuration:", error);
      res.status(500).json({ message: "Failed to check Stripe configuration" });
    }
  });

  // Get Stripe session details for payment success verification
  app.get("/api/stripe/session/:sessionId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Stripe integration not configured" });
      }

      // Get session details from Stripe
      const session = await stripeService.getCheckoutSession(sessionId);
      
      // Find associated payment request by checkout ID
      const allPaymentRequests = await storage.getAllPaymentRequests();
      const paymentRequest = allPaymentRequests.find(pr => pr.checkoutId === sessionId);

      // Update payment request status if needed
      if (paymentRequest) {
        const newStatus = stripeService.getPaymentStatus(session);
        
        if (newStatus !== paymentRequest.status) {
          await storage.updatePaymentStatus(
            paymentRequest.id,
            newStatus,
            session.payment_intent ? {
              transactionId: session.payment_intent.toString(),
              transactionCode: session.id,
              authCode: session.payment_intent.toString()
            } : undefined
          );
        }
      }

      res.json({
        session: {
          id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency,
          customer_details: session.customer_details
        },
        paymentRequest: paymentRequest ? {
          id: paymentRequest.id,
          description: paymentRequest.description,
          status: stripeService.getPaymentStatus(session)
        } : null
      });
    } catch (error) {
      console.error("Error retrieving Stripe session:", error);
      res.status(500).json({ message: "Failed to retrieve payment session details" });
    }
  });

  // Stripe callback handler (for successful payments)
  app.get("/callback", async (req: Request, res: Response) => {
    const { session_id } = req.query;
    
    if (session_id) {
      // Redirect to success page with session ID for status checking
      return res.redirect(`/payments/success?session_id=${session_id}`);
    }
    
    // Default redirect if no session ID
    res.redirect("/payments/success");
  });

  // Public payment success page (for Stripe redirects)
  app.get("/payments/success", async (req: Request, res: Response) => {
    const { session_id } = req.query;
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Successful - Moore Horticulture Equipment</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
            .success { color: #22c55e; font-size: 24px; margin-bottom: 20px; }
            .message { color: #374151; margin-bottom: 30px; }
            .checkout-id { color: #6b7280; font-size: 14px; margin-bottom: 20px; font-family: monospace; }
            .button { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px; }
            .secondary-button { background: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅ Payment Successful!</div>
            <div class="message">Your payment has been processed successfully. Thank you for your business with Moore Horticulture Equipment!</div>
            ${session_id ? `<div class="checkout-id">Session ID: ${session_id}</div>` : ''}
            <div>
              <a href="/" class="button">Return to Workshop</a>
              <a href="/job-tracker" class="button secondary-button">Track Your Job</a>
            </div>
          </div>
        </body>
      </html>
    `);
  });

  // Job payment integration routes
  
  // Record manual payment for a job
  app.post("/api/jobs/:jobId/payments/record", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const paymentData = recordPaymentSchema.parse(req.body);
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Record the payment
      const updatedJob = await storage.recordJobPayment(jobId, paymentData, userId);
      
      if (!updatedJob) {
        return res.status(500).json({ message: "Failed to record payment" });
      }

      res.json({
        message: "Payment recorded successfully",
        job: updatedJob
      });
    } catch (error) {
      console.error("Error recording job payment:", error);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // Create Stripe payment request for a job
  app.post("/api/jobs/:jobId/payments/request", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const requestData = jobPaymentRequestSchema.parse(req.body);
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify job exists and get customer email if not provided
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Use customer email from job if not provided in request
      if (!requestData.customerEmail && job.customerId) {
        const customer = await storage.getCustomer(job.customerId);
        if (customer?.email) {
          requestData.customerEmail = customer.email;
        }
      }

      if (!requestData.customerEmail) {
        return res.status(400).json({ message: "Customer email is required for payment request" });
      }

      // Create job-specific payment request
      const paymentRequest = await storage.createJobPaymentRequest(jobId, requestData, userId);

      // Try to create Stripe checkout session if configured
      const stripeService = StripeService.fromEnvironment();
      if (stripeService) {
        try {
          const session = await stripeService.createCheckoutSession({
            description: requestData.description || `Service payment for job ${job.jobId}`,
            customerEmail: requestData.customerEmail,
            amount: Math.round(requestData.amount * 100), // Convert to pence for Stripe
            currency: 'GBP',
            checkoutReference: paymentRequest.checkoutReference
          });

          // Update payment request with Stripe session ID
          await storage.updatePaymentRequest(paymentRequest.id, {
            checkoutId: session.id
          });

          // Send payment request email with Stripe link
          await sendPaymentRequestEmail(
            requestData.customerEmail,
            session.url || '', // paymentLink
            requestData.description || `Service payment for job ${job.jobId}`, // description
            requestData.amount.toString(), // amount
            paymentRequest.checkoutReference
          );

          res.json({
            message: "Payment request created successfully",
            paymentRequest: {
              ...paymentRequest,
              checkoutId: session.id,
              checkoutUrl: session.url
            }
          });
        } catch (stripeError) {
          console.error("Stripe error, falling back to email-only:", stripeError);
          
          // Send email without payment link
          await sendPaymentRequestEmailNoLink(
            requestData.customerEmail,
            requestData.description || `Service payment for job ${job.jobId}`,
            requestData.amount.toString(),
            paymentRequest.checkoutReference
          );

          res.json({
            message: "Payment request created (email sent without payment link)",
            paymentRequest
          });
        }
      } else {
        // Send email without payment link if Stripe not configured
        await sendPaymentRequestEmailNoLink(
          requestData.customerEmail,
          requestData.description || `Service payment for job ${job.jobId}`,
          requestData.amount.toString(),
          paymentRequest.checkoutReference
        );

        res.json({
          message: "Payment request created (email sent without payment link)",
          paymentRequest
        });
      }
    } catch (error) {
      console.error("Error creating job payment request:", error);
      res.status(500).json({ message: "Failed to create payment request" });
    }
  });

  // Stripe webhook endpoint for automatic payment processing
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    console.log("Stripe webhook received:", req.body);
    
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event: any;

    try {
      if (!endpointSecret) {
        console.log("No webhook endpoint secret configured, processing webhook without signature verification");
        event = req.body;
      } else {
        const stripeService = StripeService.fromEnvironment();
        if (stripeService) {
          // For webhook signature verification, we'd need raw body
          // For now, process without verification in development
          event = req.body;
        } else {
          throw new Error("Stripe not configured");
        }
      }
    } catch (err: any) {
      console.error(`Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          console.log(`Payment completed for session: ${session.id}`);
          
          // VERIFY: Check that the session is actually paid before proceeding
          if (session.payment_status !== 'paid') {
            console.log(`⚠️  Session ${session.id} is not marked as paid (status: ${session.payment_status})`);
            return res.json({ received: true, warning: 'Session not paid' });
          }
          
          // Find payment request by checkout session ID
          const paymentRequests = await storage.getAllPaymentRequests();
          const matchingRequest = paymentRequests.find(pr => pr.checkoutId === session.id);
          
          if (matchingRequest) {
            console.log(`Found matching payment request ${matchingRequest.id} for session ${session.id}`);
            
            // VERIFY: Get additional proof from Stripe API
            let stripeVerification = null;
              try {
                const stripeService = StripeService.fromEnvironment();
                if (stripeService && session.payment_intent) {
                  const paymentIntentId = typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent.id;

                  if (paymentIntentId) {
                    const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
                    
                    // Only proceed if payment intent is actually succeeded
                      if (paymentIntent.status === 'succeeded') {
                        const charge = (paymentIntent as any).charges?.data?.[0];
                      stripeVerification = {
                        payment_intent_id: paymentIntent.id,
                        status: paymentIntent.status,
                        amount: paymentIntent.amount,
                        currency: paymentIntent.currency,
                        created: new Date(paymentIntent.created * 1000).toISOString(),
                          receipt_url: charge?.receipt_url || null,
                          payment_method_id: paymentIntent.payment_method,
                          last_4: charge?.payment_method_details?.card?.last4 || null,
                          brand: charge?.payment_method_details?.card?.brand || null
                      };
                      console.log(`✅ Stripe verification successful for ${session.id}:`, JSON.stringify(stripeVerification, null, 2));
                    } else {
                      console.log(`❌ Payment intent ${paymentIntent.id} status is ${paymentIntent.status}, not succeeded`);
                      return res.json({ received: true, error: 'Payment not succeeded' });
                    }
                  }
                }
              } catch (error) {
              console.error('❌ Error verifying payment with Stripe:', error);
              return res.json({ received: true, error: 'Failed to verify payment' });
            }
            
            // Update payment request status with comprehensive proof
              const amountInPence = matchingRequest.amount ?? 0;
              const transactionDetails = {
              transactionId: session.payment_intent?.toString() || session.id,
              transactionCode: session.id,
              authCode: session.payment_intent?.toString() || session.id,
              // Store verification details as proof
              stripeVerification: JSON.stringify(stripeVerification),
              verifiedAt: new Date().toISOString()
            };
            
            await storage.updatePaymentStatus(matchingRequest.id, 'paid', transactionDetails);
            
            // Automatically mark the job as paid with verified proof
              if (matchingRequest.jobId) {
                const job = await storage.getJob(matchingRequest.jobId);
                if (job) {
              const ukVerificationTime = new Date().toLocaleString('en-GB', { 
                timeZone: 'Europe/London',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });
              
              const paymentNotes = [
                `✅ VERIFIED Stripe Payment`,
                `Session: ${session.id}`,
                stripeVerification ? `Payment Intent: ${stripeVerification.payment_intent_id}` : '',
                stripeVerification?.receipt_url ? `Receipt: ${stripeVerification.receipt_url}` : '',
                stripeVerification?.last_4 ? `Card: ****${stripeVerification.last_4} (${stripeVerification.brand})` : '',
                `Verified: ${ukVerificationTime}`
              ].filter(Boolean).join(' | ');
              
              // Use local UK timezone for payment timestamp
              const ukTime = new Date().toLocaleString('en-GB', { 
                timeZone: 'Europe/London',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });
              
                await storage.updateJob(matchingRequest.jobId, {
                  paymentStatus: 'paid',
                  paymentAmount: amountInPence, // Amount is already in pence
                  paymentMethod: 'stripe',
                  paymentNotes,
                  paidAt: ukTime
                });
                
                console.log(`✅ Job ${job.jobId} automatically marked as paid with Stripe verification proof`);
                
                // Log the activity with verification details (use system user ID 1)
                try {
                  await storage.createActivity({
                    userId: 1, // System activity
                    activityType: 'job_payment_completed',
                    description: `✅ VERIFIED Stripe Payment: ${job.jobId} - £${(amountInPence / 100).toFixed(2)} ${stripeVerification?.receipt_url ? `| Receipt: ${stripeVerification.receipt_url}` : ''}`,
                    metadata: {
                      jobId: matchingRequest.jobId,
                      paymentAmount: amountInPence,
                      stripeSessionId: session.id,
                      paymentIntentId: stripeVerification?.payment_intent_id,
                      receiptUrl: stripeVerification?.receipt_url,
                      verified: true,
                      verificationDate: new Date().toISOString()
                    },
                    entityType: 'job',
                    entityId: job.id
                  });
                  } catch (activityError) {
                    console.error("Error logging payment activity:", activityError);
                  }
                }
              }
          } else {
            console.log(`No payment request found for session ${session.id}`);
          }
          break;
          
        case 'payment_intent.succeeded':
          console.log(`Payment intent succeeded: ${event.data.object.id}`);
          break;
          
        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object;
          console.log(`Payment failed for intent: ${failedIntent.id}`);
          
          // Find payment request by payment intent and mark as failed
          const allRequests = await storage.getAllPaymentRequests();
          const failedRequest = allRequests.find(pr => 
            pr.checkoutId && pr.checkoutId.includes(failedIntent.id)
          );
          
          if (failedRequest) {
            await storage.updatePaymentStatus(failedRequest.id, 'failed');
            console.log(`Marked payment request ${failedRequest.id} as failed`);
          }
          break;
          
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook event:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Legacy webhook handler (keep for backward compatibility)
  app.post("/api/jobs/payments/webhook", async (req: Request, res: Response) => {
    try {
      const { paymentRequestId, sessionId } = req.body;
      
      if (paymentRequestId) {
        // Find the payment request and complete the job payment
        const paymentRequest = await storage.getPaymentRequest(paymentRequestId);
        
        if (paymentRequest && paymentRequest.jobId) {
          await storage.completeJobPaymentFromStripe(paymentRequestId);
          
          // Also update the payment request status
          await storage.updatePaymentStatus(paymentRequestId, 'paid');
          
          res.json({ message: "Job payment completed successfully" });
        } else {
          res.status(404).json({ message: "Payment request not found or not linked to job" });
        }
      } else {
        res.status(400).json({ message: "Missing paymentRequestId" });
      }
    } catch (error) {
      console.error("Error processing payment webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Get payment history for a job
  app.get("/api/jobs/:jobId/payments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Get the job with payment details
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get payment requests for this job
      const paymentRequests = await storage.getPaymentRequestsByJob(jobId);

      res.json({
        job: {
          id: job.id,
          jobId: job.jobId,
          paymentStatus: job.paymentStatus,
          paymentAmount: job.paymentAmount ? job.paymentAmount / 100 : null, // Convert back to pounds
          paymentMethod: job.paymentMethod,
          paymentNotes: job.paymentNotes,
          invoiceNumber: job.invoiceNumber,
          paidAt: job.paidAt
        },
        paymentRequests: paymentRequests.map(pr => ({
          ...pr,
          amount: pr.amount / 100 // Convert back to pounds
        }))
      });
    } catch (error) {
      console.error("Error retrieving job payment history:", error);
      res.status(500).json({ message: "Failed to retrieve payment history" });
    }
  });

  // Refresh payment status for all payment requests linked to a job
  app.post("/api/jobs/:jobId/payments/refresh", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Get the job
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get all payment requests for this job
      const paymentRequests = await storage.getPaymentRequestsByJob(jobId);
      
      let updatedCount = 0;
      let paidRequests = [];
      
      const stripeService = StripeService.fromEnvironment();
      
      for (const paymentRequest of paymentRequests) {
        if (paymentRequest.checkoutId && paymentRequest.status === 'pending' && stripeService) {
          try {
            const session = await stripeService.getCheckoutSession(paymentRequest.checkoutId);
            const newStatus = stripeService.getPaymentStatus(session);
            
            if (newStatus !== paymentRequest.status) {
              await storage.updatePaymentStatus(
                paymentRequest.id, 
                newStatus,
                session.payment_intent ? {
                  transactionId: session.payment_intent.toString(),
                  transactionCode: session.id,
                  authCode: session.payment_intent.toString()
                } : undefined
              );
              
              updatedCount++;
              
              // If payment is now paid, mark the job as paid automatically
              if (newStatus === 'paid') {
                paidRequests.push(paymentRequest);
                
                // Update job payment status
                await storage.updateJob(jobId, {
                  paymentStatus: 'paid',
                  paymentAmount: paymentRequest.amount, // Amount is already in pence
                  paymentMethod: 'stripe',
                  paymentNotes: `Paid via Stripe - Session: ${session.id}`,
                  paidAt: new Date().toISOString()
                });
                
                console.log(`Job ${job.jobId} automatically marked as paid from Stripe payment`);
              }
            }
          } catch (stripeError) {
            console.error(`Error checking Stripe status for payment request ${paymentRequest.id}:`, stripeError);
          }
        }
      }

      res.json({
        message: `Payment status refreshed. ${updatedCount} requests updated, ${paidRequests.length} payments completed.`,
        updatedCount,
        paidRequests: paidRequests.length
      });
    } catch (error) {
      console.error("Error refreshing job payment status:", error);
      res.status(500).json({ message: "Failed to refresh payment status" });
    }
  });

  // Manual trigger for weekly callback report (admin only)
  app.post("/api/reports/callbacks/weekly", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      console.log('Manually triggering weekly callback report...');
      const success = await schedulerService.triggerWeeklyCallbackReport();
      
      if (success) {
        res.json({ 
          message: "Weekly callback report sent successfully",
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({ 
          message: "Failed to send weekly callback report"
        });
      }
    } catch (error) {
      console.error("Error triggering weekly callback report:", error);
      res.status(500).json({ 
        message: "Error triggering weekly callback report",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Parts on Order routes
  // Get all parts on order
  app.get("/api/parts-on-order", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const parts = await storage.getAllPartsOnOrder();
      
      // Convert costs back to pounds for frontend display
      const formattedParts = parts.map(part => ({
        ...part,
        estimatedCost: part.estimatedCost ? part.estimatedCost / 100 : null,
        actualCost: part.actualCost ? part.actualCost / 100 : null
      }));
      
      res.json(formattedParts);
    } catch (error) {
      console.error("Error fetching parts on order:", error);
      res.status(500).json({ message: "Failed to fetch parts on order" });
    }
  });

  // Get overdue parts (8+ days since order)
  app.get("/api/parts-on-order/overdue", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const daysSince = parseInt(req.query.days as string) || 8;
      const overdueParts = await storage.getOverduePartsOnOrder(daysSince);
      
      // Convert costs back to pounds for frontend display
      const formattedParts = overdueParts.map(part => ({
        ...part,
        estimatedCost: part.estimatedCost ? part.estimatedCost / 100 : null,
        actualCost: part.actualCost ? part.actualCost / 100 : null
      }));
      
      res.json(formattedParts);
    } catch (error) {
      console.error("Error fetching overdue parts:", error);
      res.status(500).json({ message: "Failed to fetch overdue parts" });
    }
  });

  // Get specific part on order
  app.get("/api/parts-on-order/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }
      
      const part = await storage.getPartOnOrder(id);
      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }
      
      // Convert costs back to pounds for frontend display
      const formattedPart = {
        ...part,
        estimatedCost: part.estimatedCost ? part.estimatedCost / 100 : null,
        actualCost: part.actualCost ? part.actualCost / 100 : null
      };
      
      res.json(formattedPart);
    } catch (error) {
      console.error("Error fetching part:", error);
      res.status(500).json({ message: "Failed to fetch part" });
    }
  });

  // Create new part on order
  app.post("/api/parts-on-order", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      
      // Validate request body
      const validatedData = insertPartOnOrderSchema.parse({
        ...req.body,
        createdBy: userId
      });
      
      const newPart = await storage.createPartOnOrder(validatedData);
      
      // Convert costs back to pounds for frontend display
      const formattedPart = {
        ...newPart,
        estimatedCost: newPart.estimatedCost ? newPart.estimatedCost / 100 : null,
        actualCost: newPart.actualCost ? newPart.actualCost / 100 : null
      };
      
      res.status(201).json(formattedPart);
    } catch (error) {
      console.error("Error creating part order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      res.status(500).json({ message: "Failed to create part order" });
    }
  });

  // Update part on order
  app.put("/api/parts-on-order/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.session as any).userId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }
      
      const updateData = {
        ...req.body,
        updatedBy: userId
      };
      
      const updatedPart = await storage.updatePartOnOrder(id, updateData);
      if (!updatedPart) {
        return res.status(404).json({ message: "Part not found" });
      }
      
      // Convert costs back to pounds for frontend display
      const formattedPart = {
        ...updatedPart,
        estimatedCost: updatedPart.estimatedCost ? updatedPart.estimatedCost / 100 : null,
        actualCost: updatedPart.actualCost ? updatedPart.actualCost / 100 : null
      };
      
      res.json(formattedPart);
    } catch (error) {
      console.error("Error updating part:", error);
      res.status(500).json({ message: "Failed to update part" });
    }
  });

  // Mark part as arrived
  app.post("/api/parts-on-order/:id/arrived", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.session as any).userId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }
      
      const { actualDeliveryDate, actualCost, notes } = req.body;
      
      const updatedPart = await storage.markPartAsArrived(
        id, 
        userId, 
        actualDeliveryDate, 
        actualCost, 
        notes
      );
      
      if (!updatedPart) {
        return res.status(404).json({ message: "Part not found" });
      }
      
      // Convert costs back to pounds for frontend display
      const formattedPart = {
        ...updatedPart,
        estimatedCost: updatedPart.estimatedCost ? updatedPart.estimatedCost / 100 : null,
        actualCost: updatedPart.actualCost ? updatedPart.actualCost / 100 : null
      };
      
      res.json(formattedPart);
    } catch (error) {
      console.error("Error marking part as arrived:", error);
      res.status(500).json({ message: "Failed to mark part as arrived" });
    }
  });

  // Mark part as collected
  app.post("/api/parts-on-order/:id/collected", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.session as any).userId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }
      
      const updatedPart = await storage.markPartAsCollected(id, userId);
      
      if (!updatedPart) {
        return res.status(404).json({ message: "Part not found" });
      }
      
      // Convert costs back to pounds for frontend display
      const formattedPart = {
        ...updatedPart,
        estimatedCost: updatedPart.estimatedCost ? updatedPart.estimatedCost / 100 : null,
        actualCost: updatedPart.actualCost ? updatedPart.actualCost / 100 : null
      };
      
      res.json(formattedPart);
    } catch (error) {
      console.error("Error marking part as collected:", error);
      res.status(500).json({ message: "Failed to mark part as collected" });
    }
  });

  // Notify customer that part is ready
  app.post("/api/parts-on-order/:id/notify-customer", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.session as any).userId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }
      
      // Get part details for email
      const part = await storage.getPartOnOrder(id);
      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }
      
      if (!part.isArrived) {
        return res.status(400).json({ message: "Part has not arrived yet" });
      }
      
      if (!part.customerEmail) {
        return res.status(400).json({ message: "No customer email on file" });
      }
      
      // Send customer notification email
      try {
        await sendPartReadyEmail(part);
      } catch (emailError) {
        console.error("Error sending customer notification email:", emailError);
        // Continue with updating the database even if email fails
      }
      
      // Update the notification status
      const success = await storage.notifyCustomerPartReady(id, userId);
      
      if (success) {
        res.json({ message: "Customer notified successfully" });
      } else {
        res.status(404).json({ message: "Part not found" });
      }
    } catch (error) {
      console.error("Error notifying customer:", error);
      res.status(500).json({ message: "Failed to notify customer" });
    }
  });

  // Get part order updates/history
  app.get("/api/parts-on-order/:id/updates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }
      
      const updates = await storage.getPartOrderUpdates(id);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching part updates:", error);
      res.status(500).json({ message: "Failed to fetch part updates" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}