import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { sendTaskAssignmentEmail } from "./services/emailService";
import { 
  createJobUpdate, 
  getJobUpdates, 
  getPublicJobUpdates 
} from "./services/jobUpdateService";
import { 
  insertUserSchema, 
  insertCustomerSchema, 
  insertEquipmentTypeSchema, 
  insertEquipmentSchema, 
  insertJobSchema, 
  insertServiceSchema, 
  insertTaskSchema, 
  insertCallbackRequestSchema
} from "@shared/schema";
import { initAuthRoutes, isAuthenticated, isAdmin } from "./auth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static redirect.html page with high priority
  app.get('/redirect.html', (req, res) => {
    res.sendFile(path.resolve('./client/public/redirect.html'));
  });
  
  // Serve test login page
  app.get('/test-login', (req, res) => {
    res.sendFile(path.resolve('./client/public/test-login.html'));
  });
  
  // Initialize authentication routes
  initAuthRoutes(app);
  
  // PUBLIC API ROUTES - No authentication required
  
  // Create a simple test endpoint to verify API is working
  app.get("/api/test", (req, res) => {
    res.status(200).send(JSON.stringify({
      success: true,
      message: "API test successful",
      timestamp: new Date().toISOString()
    }));
  });
  
  // Create a separate API route for job tracking that explicitly sets JSON headers
  // This ensures it doesn't get caught by the HTML/Vite catch-all
  app.get("/api/public/job-tracker", async (req: Request, res: Response) => {
    // Explicitly set multiple headers to ensure JSON response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    try {
      const jobId = req.query.jobId as string;
      const email = req.query.email as string;
      
      console.log(`Job tracker request: jobId=${jobId}, email=${email}`);
      
      if (!jobId || !email) {
        return res.status(400).send(JSON.stringify({ message: "Job ID and email are required" }));
      }
      
      // Find the job by ID
      const job = await storage.getJobByJobId(jobId);
      
      if (!job) {
        console.log(`Job not found: ${jobId}`);
        return res.status(404).send(JSON.stringify({ message: "Job not found" }));
      }
      
      // Find the customer
      const customer = await storage.getCustomer(job.customerId);
      
      if (!customer) {
        console.log(`Customer not found for job: ${jobId}`);
        return res.status(404).send(JSON.stringify({ message: "Customer not found" }));
      }
      
      // More lenient email verification - convert to lowercase, trim, and allow partial matches
      const customerEmail = (customer.email || "").toLowerCase().trim();
      const submittedEmail = email.toLowerCase().trim();
      
      // If customer email is blank, don't verify
      // Otherwise check for exact match or if submitted email contains customer email (or vice versa)
      if (customerEmail && 
          customerEmail !== submittedEmail && 
          !customerEmail.includes(submittedEmail) && 
          !submittedEmail.includes(customerEmail)) {
        console.log(`Email mismatch: ${customerEmail} vs ${submittedEmail}`);
        return res.status(403).send(JSON.stringify({ message: "Invalid email for this job" }));
      }
      
      // Get job updates/history if available (public updates only for customer portal)
      const jobUpdates = await getPublicJobUpdates(job.id);
      console.log(`Found ${jobUpdates?.length || 0} updates for job ${job.id}`);
      
      // Prepare the response with job info
      const jobData = {
        ...job,
        updates: jobUpdates || []
      };
      
      console.log(`Returning job data for ${job.jobId}`);
      // Use send with stringified JSON to ensure proper content delivery
      return res.status(200).send(JSON.stringify(jobData));
    } catch (error) {
      console.error("Error in job tracker endpoint:", error);
      return res.status(500).send(JSON.stringify({ message: "Internal server error" }));
    }
  });
  
  // User routes
  app.get("/api/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      
      // Don't return password hashes
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error retrieving users:", error);
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  });

  app.get("/api/users/:id", isAuthenticated, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      return res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Customer routes
  app.get("/api/customers", async (req: Request, res: Response) => {
    if (req.query.search) {
      const customers = await storage.searchCustomers(req.query.search as string);
      return res.json(customers);
    } else {
      const customers = await storage.getAllCustomers();
      return res.json(customers);
    }
  });

  app.get("/api/customers/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.json(customer);
  });

  app.post("/api/customers", async (req: Request, res: Response) => {
    try {
      console.log("[CUSTOMER API] Creating customer with data:", JSON.stringify(req.body, null, 2));
      
      // Ensure name is provided
      if (!req.body.name || req.body.name.trim() === '') {
        console.error("[CUSTOMER API] Customer name is required");
        return res.status(400).json({ message: "Customer name is required" });
      }
      
      // Handle empty strings for optional fields
      const customerData = {
        name: req.body.name,
        email: req.body.email === '' ? ' ' : req.body.email || ' ',
        phone: req.body.phone === '' ? ' ' : req.body.phone || ' ',
        address: req.body.address === '' ? ' ' : req.body.address || ' ',
        notes: req.body.notes || ''
      };
      
      console.log("[CUSTOMER API] Processed customer data:", JSON.stringify(customerData, null, 2));
      
      try {
        // Parse the data through Zod schema
        const validatedData = insertCustomerSchema.parse(customerData);
        console.log("[CUSTOMER API] Validated customer data:", JSON.stringify(validatedData, null, 2));
        
        // Create the customer
        const customer = await storage.createCustomer(validatedData);
        console.log("[CUSTOMER API] Customer created successfully:", JSON.stringify(customer, null, 2));
        return res.status(201).json(customer);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          console.error("[CUSTOMER API] Validation errors:", JSON.stringify(zodError.errors, null, 2));
          return res.status(400).json({ message: "Invalid customer data", errors: zodError.errors });
        }
        throw zodError;
      }
    } catch (error: any) {
      console.error("[CUSTOMER API] Error creating customer:", error);
      return res.status(500).json({ message: `Failed to create customer: ${error.message || "Unknown error"}` });
    }
  });

  app.put("/api/customers/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    try {
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, customerData);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      return res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const success = await storage.deleteCustomer(id);
    if (!success) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.status(204).send();
  });

  // Equipment Type routes
  app.get("/api/equipment-types", async (req: Request, res: Response) => {
    const equipmentTypes = await storage.getAllEquipmentTypes();
    return res.json(equipmentTypes);
  });

  app.get("/api/equipment-types/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid equipment type ID" });
    }

    const equipmentType = await storage.getEquipmentType(id);
    if (!equipmentType) {
      return res.status(404).json({ message: "Equipment type not found" });
    }

    return res.json(equipmentType);
  });

  app.post("/api/equipment-types", async (req: Request, res: Response) => {
    try {
      const equipmentTypeData = insertEquipmentTypeSchema.parse(req.body);
      const equipmentType = await storage.createEquipmentType(equipmentTypeData);
      return res.status(201).json(equipmentType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid equipment type data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create equipment type" });
    }
  });

  app.put("/api/equipment-types/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid equipment type ID" });
    }

    try {
      const equipmentTypeData = insertEquipmentTypeSchema.partial().parse(req.body);
      const equipmentType = await storage.updateEquipmentType(id, equipmentTypeData);
      
      if (!equipmentType) {
        return res.status(404).json({ message: "Equipment type not found" });
      }
      
      return res.json(equipmentType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid equipment type data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to update equipment type" });
    }
  });

  // Equipment routes
  app.get("/api/equipment", async (req: Request, res: Response) => {
    const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
    
    if (customerId) {
      const equipment = await storage.getEquipmentByCustomer(customerId);
      return res.json(equipment);
    } else {
      const equipment = await storage.getAllEquipment();
      return res.json(equipment);
    }
  });

  app.get("/api/equipment/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }

    const equipment = await storage.getEquipment(id);
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    return res.json(equipment);
  });

  app.post("/api/equipment", async (req: Request, res: Response) => {
    try {
      const equipmentData = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(equipmentData);
      return res.status(201).json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid equipment data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  app.put("/api/equipment/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }

    try {
      const equipmentData = insertEquipmentSchema.partial().parse(req.body);
      const equipment = await storage.updateEquipment(id, equipmentData);
      
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      
      return res.json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid equipment data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to update equipment" });
    }
  });

  // Job routes
  app.get("/api/jobs", async (req: Request, res: Response) => {
    const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
    const activeOnly = req.query.activeOnly === 'true';
    
    if (customerId) {
      const jobs = await storage.getJobsByCustomer(customerId);
      return res.json(jobs);
    } else if (assignedTo) {
      const jobs = await storage.getJobsByAssignee(assignedTo);
      return res.json(jobs);
    } else if (activeOnly) {
      const jobs = await storage.getActiveJobs();
      return res.json(jobs);
    } else {
      const jobs = await storage.getAllJobs();
      return res.json(jobs);
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      // Try searching by jobId
      const job = await storage.getJobByJobId(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      return res.json(job);
    }

    const job = await storage.getJob(id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.json(job);
  });

  app.post("/api/jobs", async (req: Request, res: Response) => {
    try {
      console.log("[JOB API] Received job creation request:", JSON.stringify(req.body, null, 2));
      
      // Validate customer ID exists
      if (!req.body.customerId) {
        console.error("[JOB API] Missing customerId in job creation request");
        return res.status(400).json({ message: "Missing customerId" });
      }
      
      try {
        const customer = await storage.getCustomer(req.body.customerId);
        if (!customer) {
          console.error("[JOB API] Invalid customerId provided:", req.body.customerId);
          return res.status(400).json({ message: "Invalid customerId provided" });
        }
      } catch (customerError) {
        console.error("[JOB API] Error checking customer:", customerError);
        return res.status(400).json({ message: "Error validating customer" });
      }
      
      try {
        // Parse and validate the job data
        const jobData = insertJobSchema.parse(req.body);
        console.log("[JOB API] Parsed job data:", JSON.stringify(jobData, null, 2));
        
        // Create the job
        const job = await storage.createJob(jobData);
        console.log("[JOB API] Job created successfully:", JSON.stringify(job, null, 2));
        
        // Create activity for job creation
        try {
          await storage.createActivity({
            userId: req.body.assignedTo || 1, // Use assigned user or admin as fallback
            activityType: "job_created",
            description: `New job ${job.jobId} created for ${req.body.customerName || `customer #${req.body.customerId}`}`,
            entityType: "job",
            entityId: job.id,
            timestamp: new Date().toISOString()
          });
        } catch (activityError) {
          console.error("[JOB API] Failed to create activity:", activityError);
          // Don't fail the request if activity creation fails
        }
        
        return res.status(201).json(job);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          console.error("[JOB API] Validation errors:", JSON.stringify(zodError.errors, null, 2));
          return res.status(400).json({ message: "Invalid job data", errors: zodError.errors });
        }
        throw zodError;
      }
    } catch (error: any) {
      console.error("[JOB API] Error creating job:", error);
      return res.status(500).json({ message: `Failed to create job: ${error.message || "Unknown error"}` });
    }
  });

  app.put("/api/jobs/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    const existingJob = await storage.getJob(id);
    if (!existingJob) {
      return res.status(404).json({ message: "Job not found" });
    }

    try {
      // We're allowing partial job updates
      const jobData = req.body;
      
      // Special handling for status changes
      if (jobData.status !== existingJob.status) {
        // Record completion date if job is being marked as completed
        if (jobData.status === 'completed') {
          jobData.completedAt = new Date().toISOString();
          
          // Create activity for job completion
          try {
            await storage.createActivity({
              userId: jobData.assignedTo || existingJob.assignedTo || 1,
              activityType: "job_completed",
              description: `Job ${existingJob.jobId} marked as completed`,
              entityType: "job",
              entityId: existingJob.id,
              timestamp: new Date().toISOString()
            });
          } catch (activityError) {
            console.error("[JOB API] Failed to create activity:", activityError);
          }
        }
        
        // Create activity for job status change to in_progress
        if (jobData.status === 'in_progress') {
          try {
            await storage.createActivity({
              userId: jobData.assignedTo || existingJob.assignedTo || 1,
              activityType: "job_started",
              description: `Job ${existingJob.jobId} work has started`,
              entityType: "job",
              entityId: existingJob.id,
              timestamp: new Date().toISOString()
            });
          } catch (activityError) {
            console.error("[JOB API] Failed to create activity:", activityError);
          }
        }
        
        // Create activity for job status change to parts_ordered
        if (jobData.status === 'parts_ordered') {
          try {
            await storage.createActivity({
              userId: jobData.assignedTo || existingJob.assignedTo || 1,
              activityType: "job_received",
              description: `Parts ordered for job ${existingJob.jobId}`,
              entityType: "job",
              entityId: existingJob.id,
              timestamp: new Date().toISOString()
            });
          } catch (activityError) {
            console.error("[JOB API] Failed to create activity:", activityError);
          }
        }
      }
      
      const job = await storage.updateJob(id, jobData);
      

      

      
      return res.json(job);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update job" });
    }
  });

  // Service routes
  app.get("/api/services", async (req: Request, res: Response) => {
    const jobId = req.query.jobId ? parseInt(req.query.jobId as string) : undefined;
    const equipmentId = req.query.equipmentId ? parseInt(req.query.equipmentId as string) : undefined;
    
    if (jobId) {
      const services = await storage.getServicesByJob(jobId);
      return res.json(services);
    } else if (equipmentId) {
      const services = await storage.getServicesByEquipment(equipmentId);
      return res.json(services);
    } else {
      const services = await storage.getAllServices();
      return res.json(services);
    }
  });

  app.get("/api/services/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid service ID" });
    }

    const service = await storage.getService(id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    return res.json(service);
  });

  app.post("/api/services", async (req: Request, res: Response) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      
      return res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create service" });
    }
  });
  
  // Update an existing service record (for continuous updates to work details)
  app.put("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const serviceId = parseInt(req.params.id);
      if (isNaN(serviceId)) {
        return res.status(400).json({ message: "Invalid service ID" });
      }
      
      // Validate service data
      const serviceData = insertServiceSchema.parse(req.body);
      
      // Check if service exists
      const existingService = await storage.getService(serviceId);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      // Update the service
      const updatedService = await storage.updateService(serviceId, serviceData);
      
      return res.json(updatedService);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to update service" });
    }
  });

  // Task routes
  app.get("/api/tasks", async (req: Request, res: Response) => {
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
  });

  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await storage.getTask(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json(task);
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      

      
      // If task is assigned to a user, send email notification
      if (task.assignedTo) {
        try {
          // Get user details to get their email
          const assignedUser = await storage.getUser(task.assignedTo);
          
          // Only send email if user has task notifications enabled (or it's undefined which defaults to true)
          if (assignedUser && assignedUser.email && 
              (assignedUser.taskNotifications === undefined || assignedUser.taskNotifications === true)) {
            // Send email notification
            await sendTaskAssignmentEmail(
              assignedUser.email,
              assignedUser.fullName,
              task.id,
              task.title,
              task.description || '',
              task.dueDate || undefined
            );
            console.log(`Task assignment email sent to ${assignedUser.email}`);
          } else {
            console.log(`Task assignment email not sent - user has disabled notifications`);
          }
        } catch (emailError) {
          console.error("Failed to send task assignment email:", emailError);
          // Continue with response even if email fails
        }
      }
      
      return res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put("/api/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      const taskData = req.body;
      const existingTask = await storage.getTask(id);
      
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Special case for completion
      if (taskData.status === 'completed' && existingTask.status !== 'completed') {
        const task = await storage.completeTask(id);
        
        if (!task) {
          return res.status(404).json({ message: "Task not found after completion" });
        }
        

        
        return res.json(task);
      } 
      // Special case for reopening a completed task
      else if (taskData.status === 'in_progress' && existingTask.status === 'completed') {
        // Mark the task as in progress again
        const task = await storage.updateTask(id, {
          status: 'in_progress',
          completedAt: null  // Remove completion date
        });
        
        if (!task) {
          return res.status(404).json({ message: "Task not found after reopening" });
        }
        

        
        return res.json(task);
      }
      // Regular update
      else {
        const task = await storage.updateTask(id, taskData);
        
        // If task has been assigned to a user (or reassigned), send email notification
        if (taskData.assignedTo && 
            (existingTask.assignedTo !== taskData.assignedTo)) {
          try {
            // Get user details to get their email
            const assignedUser = await storage.getUser(taskData.assignedTo);
            
            // Only send email if user has task notifications enabled (or it's undefined which defaults to true)
            if (assignedUser && assignedUser.email && 
                (assignedUser.taskNotifications === undefined || assignedUser.taskNotifications === true)) {
              // Make sure the task exists before sending the email
              const updatedTask = await storage.getTask(id);
              if (updatedTask) {
                // Send email notification
                await sendTaskAssignmentEmail(
                  assignedUser.email,
                  assignedUser.fullName,
                  updatedTask.id,
                  updatedTask.title,
                  updatedTask.description || '',
                  updatedTask.dueDate || undefined
                );
              }
              console.log(`Task reassignment email sent to ${assignedUser.email}`);
            } else {
              console.log(`Task reassignment email not sent - user has disabled notifications`);
            }
          } catch (emailError) {
            console.error("Failed to send task reassignment email:", emailError);
            // Continue with response even if email fails
          }
        }
        
        return res.json(task);
      }
    } catch (error) {
      console.error("Error updating task:", error);
      return res.status(500).json({ message: "Failed to update task" });
    }
  });



  // Workshop Activities route
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const entityType = req.query.entityType as string;
      const entityId = req.query.entityId ? parseInt(req.query.entityId as string) : undefined;
      
      let activities;
      
      if (userId) {
        activities = await storage.getActivityByUser(userId, limit);
      } else if (entityType && entityId) {
        activities = await storage.getActivityByEntity(entityType, entityId);
      } else {
        activities = await storage.getAllActivities(limit);
      }
      
      return res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      return res.status(500).json({ message: "Failed to fetch activities" });
    }
  });
  
  // Analytics summary route
  app.get("/api/analytics/summary", async (req: Request, res: Response) => {
    const jobs = await storage.getAllJobs();
    const customers = await storage.getAllCustomers();
    const tasks = await storage.getAllTasks();
    const pendingTasks = await storage.getPendingTasks();
    const activeJobs = await storage.getActiveJobs();
    
    // Calculate completed jobs this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const completedThisWeek = jobs.filter(job => 
      job.status === 'completed' && 
      job.completedAt && 
      new Date(job.completedAt) >= startOfWeek
    ).length;
    
    // Calculate average repair time (in days) for completed jobs
    const completedJobs = jobs.filter(job => 
      job.status === 'completed' && 
      job.completedAt
    );
    
    let totalRepairTime = 0;
    completedJobs.forEach(job => {
      const startDate = new Date(job.createdAt);
      const endDate = new Date(job.completedAt!);
      const repairTime = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24); // in days
      totalRepairTime += repairTime;
    });
    
    const avgRepairTime = completedJobs.length > 0 ? (totalRepairTime / completedJobs.length).toFixed(1) : 0;
    
    // Calculate customer satisfaction (mock data - in a real app this would come from ratings)
    const satisfaction = 94;
    
    // Calculate parts availability (mock data - in a real app this would come from inventory)
    const partsAvailability = 87;
    
    // Calculate monthly growth (mock data - in a real app this would be calculated from historical data)
    const monthlyGrowth = 12.3;
    
    // Get data for jobs by equipment type
    const equipmentTypes = await storage.getAllEquipmentTypes();
    // Load all equipment first
    const allEquipment = await storage.getAllEquipment();
    
    const jobsByEquipmentType = equipmentTypes.map(type => {
      const typeJobs = jobs.filter(job => {
        if (!job.equipmentId) return false;
        const equipment = allEquipment.find(eq => eq.id === job.equipmentId);
        return equipment?.typeId === type.id;
      });
      
      return {
        name: type.name,
        count: typeJobs.length
      };
    });
    
    return res.json({
      activeJobs: activeJobs.length,
      activeCustomers: customers.length,
      pendingTasks: pendingTasks.length,
      completedThisWeek,
      avgRepairTime,
      customerSatisfaction: satisfaction,
      partsAvailability,
      monthlyGrowth,
      jobsByEquipmentType
    });
  });
  
  // Message routes
  app.get("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const { folder = "inbox" } = req.query;
      
      let messages: Message[] = [];
      if (folder === "inbox") {
        messages = await storage.getMessagesByRecipient(userId);
      } else if (folder === "sent") {
        messages = await storage.getMessagesBySender(userId);
      } else if (folder === "job" && req.query.jobId) {
        messages = await storage.getMessagesByJob(Number(req.query.jobId));
      }
      
      // Enhance messages with sender and recipient information
      const enhancedMessages = await Promise.all(
        messages.map(async (message) => {
          const sender = await storage.getUser(message.senderId);
          const recipient = await storage.getUser(message.recipientId);
          return {
            ...message,
            sender: sender ? { 
              id: sender.id, 
              fullName: sender.fullName,
              username: sender.username,
              role: sender.role
            } : null,
            recipient: recipient ? { 
              id: recipient.id, 
              fullName: recipient.fullName,
              username: recipient.username,
              role: recipient.role
            } : null,
          };
        })
      );
      
      res.json(enhancedMessages);
    } catch (error) {
      console.error("Error retrieving messages:", error);
      res.status(500).json({ message: "Failed to retrieve messages" });
    }
  });
  
  app.get("/api/messages/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const messageId = parseInt(req.params.id);
      
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Only allow access if user is sender or recipient
      if (message.senderId !== userId && message.recipientId !== userId) {
        return res.status(403).json({ message: "Unauthorized access to message" });
      }
      
      // Mark as read if user is recipient and message is unread
      if (message.recipientId === userId && !message.isRead) {
        await storage.markMessageAsRead(messageId);
      }
      
      // Get sender and recipient info
      const sender = await storage.getUser(message.senderId);
      const recipient = await storage.getUser(message.recipientId);
      
      // Get related job if any
      let relatedJob = null;
      if (message.relatedJobId) {
        relatedJob = await storage.getJob(message.relatedJobId);
      }
      
      // Get attachments
      const attachments = await storage.getAttachmentsByMessage(messageId);
      
      const enhancedMessage = {
        ...message,
        sender: sender ? { 
          id: sender.id, 
          fullName: sender.fullName,
          username: sender.username,
          role: sender.role
        } : null,
        recipient: recipient ? { 
          id: recipient.id, 
          fullName: recipient.fullName,
          username: recipient.username,
          role: recipient.role
        } : null,
        relatedJob: relatedJob ? {
          id: relatedJob.id,
          jobId: relatedJob.jobId,
          status: relatedJob.status,
          description: relatedJob.description
        } : null,
        attachments
      };
      
      res.json(enhancedMessage);
    } catch (error) {
      console.error("Error retrieving message:", error);
      res.status(500).json({ message: "Failed to retrieve message" });
    }
  });
  
  app.post("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      
      // Validate message data
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: userId
      });
      
      const newMessage = await storage.createMessage(messageData);
      

      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error creating message:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create message" });
    }
  });
  
  app.post("/api/messages/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const messageId = parseInt(req.params.id);
      
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Only recipient can mark as read
      if (message.recipientId !== userId) {
        return res.status(403).json({ message: "Only recipient can mark message as read" });
      }
      
      const updatedMessage = await storage.markMessageAsRead(messageId);
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });
  
  app.delete("/api/messages/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const messageId = parseInt(req.params.id);
      
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Only sender or recipient can delete
      if (message.senderId !== userId && message.recipientId !== userId) {
        return res.status(403).json({ message: "Unauthorized to delete this message" });
      }
      
      // Delete message and its attachments
      const result = await storage.deleteMessage(messageId);
      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });
  
  app.get("/api/messages/unread-count", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error retrieving unread message count:", error);
      res.status(500).json({ message: "Failed to retrieve unread message count" });
    }
  });
  
  // Cleanup old messages (admin only)
  app.post("/api/messages/cleanup", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Default to 7 days if not specified
      const days = req.body.days ? parseInt(req.body.days) : 7;
      
      // Validate days parameter
      if (isNaN(days) || days < 1) {
        return res.status(400).json({ message: "Invalid days parameter, must be a positive number" });
      }
      
      // Run cleanup
      const deletedCount = await storage.cleanupOldMessages(days);
      

      
      res.json({ 
        success: true, 
        deletedCount, 
        message: `Successfully deleted ${deletedCount} messages older than ${days} days` 
      });
    } catch (error) {
      console.error("Error cleaning up old messages:", error);
      res.status(500).json({ message: "Failed to clean up old messages" });
    }
  });

  // Callback Request routes
  
  // 1. First, define all the routes without path parameters
  
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
      
      res.json(callbacks);
    } catch (error) {
      console.error("Error retrieving callback requests:", error);
      res.status(500).json({ message: "Failed to retrieve callback requests" });
    }
  });
  
  // Get deleted callbacks (must be before /:id routes so Express doesn't treat "deleted" as an ID)
  app.get("/api/callbacks/deleted", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const deletedCallbacks = await storage.getDeletedCallbackRequests();
      res.json(deletedCallbacks);
    } catch (error) {
      console.error("Error fetching deleted callbacks:", error);
      res.status(500).json({ message: "Failed to fetch deleted callbacks" });
    }
  });
  
  // Create a new callback
  app.post("/api/callbacks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const callbackData = insertCallbackRequestSchema.parse(req.body);
      
      // Validate assignee exists
      const assignee = await storage.getUser(callbackData.assignedTo);
      if (!assignee) {
        return res.status(400).json({ message: "Assigned user not found" });
      }
      
      const callback = await storage.createCallbackRequest(callbackData);
      res.status(201).json(callback);
    } catch (error) {
      console.error("Error creating callback request:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
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
        message: `Successfully purged ${purgedCount} expired callbacks`,
        count: purgedCount
      });
    } catch (error) {
      console.error("Error purging expired callbacks:", error);
      res.status(500).json({ message: "Failed to purge expired callbacks" });
    }
  });
  
  // 2. Now define the parameterized routes
  
  // Update a callback
  app.put("/api/callbacks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate ID is a number
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid callback ID" });
      }
      
      const callback = await storage.getCallbackRequest(id);
      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      const callbackData = req.body;
      const updatedCallback = await storage.updateCallbackRequest(id, callbackData);
      res.json(updatedCallback);
    } catch (error) {
      console.error("Error updating callback request:", error);
      res.status(500).json({ message: "Failed to update callback request" });
    }
  });
  
  // Complete a callback
  app.post("/api/callbacks/:id/complete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      
      // Validate ID is a number
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid callback ID" });
      }
      
      const callback = await storage.getCallbackRequest(id);
      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      const completedCallback = await storage.completeCallbackRequest(id, notes);
      res.json(completedCallback);
    } catch (error) {
      console.error("Error completing callback request:", error);
      res.status(500).json({ message: "Failed to complete callback request" });
    }
  });
  

  
  // Get a single callback by ID
  app.get("/api/callbacks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate ID is a number
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid callback ID" });
      }
      
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
  
  // Permanently delete a callback
  app.delete("/api/callbacks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const callback = await storage.getCallbackRequest(id);
      
      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      // Permanently delete the callback instead of soft-deleting
      const result = await storage.permanentlyDeleteCallback(id);
      
      if (result) {
        res.json({ success: true, message: "Callback request permanently deleted", id });
      } else {
        res.status(500).json({ message: "Failed to delete callback request" });
      }
    } catch (error) {
      console.error("Error deleting callback request:", error);
      res.status(500).json({ message: "Failed to delete callback request" });
    }
  });
  
  // Restore a deleted callback
  app.post("/api/callbacks/:id/restore", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const callback = await storage.getCallbackRequest(id);
      
      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      if (callback.status !== 'deleted') {
        return res.status(400).json({ message: "Callback is not in deleted state" });
      }
      
      const restoredCallback = await storage.restoreDeletedCallback(id);
      res.json(restoredCallback);
    } catch (error) {
      console.error("Error restoring callback request:", error);
      res.status(500).json({ message: "Failed to restore callback request" });
    }
  });
  
  // Permanently delete a callback
  app.delete("/api/callbacks/:id/permanent", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const callback = await storage.getCallbackRequest(id);
      
      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }
      
      const result = await storage.permanentlyDeleteCallback(id);
      
      if (result) {
        res.json({ success: true, message: "Callback request permanently deleted" });
      } else {
        res.status(500).json({ message: "Failed to permanently delete callback" });
      }
    } catch (error) {
      console.error("Error permanently deleting callback request:", error);
      res.status(500).json({ message: "Failed to permanently delete callback request" });
    }
  });
  
  // Purge expired deleted callbacks
  app.post("/api/callbacks/purge-expired", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const purgedCount = await storage.purgeExpiredDeletedCallbacks();
      res.json({ 
        success: true, 
        message: `Successfully purged ${purgedCount} expired callbacks`,
        count: purgedCount
      });
    } catch (error) {
      console.error("Error purging expired callbacks:", error);
      res.status(500).json({ message: "Failed to purge expired callbacks" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
