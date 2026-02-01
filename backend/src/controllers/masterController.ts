import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { isMaster } from "../auth";
import { hashPassword } from "../auth";
import { InsertUser, InsertBusiness, customers, jobs, equipment, users as usersTable } from "@shared/schema";
import { logActivity } from "../services/activityService";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "../services/emailService";

export class MasterController {
  public readonly router = Router();

  constructor() {
    // All routes require master authentication
    this.router.use(isMaster);

    // Dashboard overview
    this.router.get("/dashboard/overview", this.getOverview);
    
    // Business management
    this.router.get("/businesses", this.getAllBusinesses);
    this.router.get("/businesses/:id", this.getBusiness);
    this.router.post("/businesses", this.createBusiness);
    this.router.put("/businesses/:id", this.updateBusiness);
    this.router.delete("/businesses/:id", this.deleteBusiness);
    this.router.delete("/businesses/:id/permanent", this.permanentlyDeleteBusiness);
    
    // User management
    this.router.get("/users", this.getAllUsers);
    this.router.get("/users/:id", this.getUser);
    this.router.post("/users", this.createUser);
    this.router.put("/users/:id", this.updateUser);
    this.router.delete("/users/:id", this.deactivateUser);
    
    // Analytics
    this.router.get("/analytics", this.getAnalytics);
  }

  private async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const [allBusinesses, allUsers] = await Promise.all([
        storage.getAllBusinessesIncludingInactive(),
        storage.getAllUsersAcrossAllBusinesses()
      ]);

      const activeBusinesses = allBusinesses.filter(b => b.isActive);
      const activeUsers = allUsers.filter(u => u.isActive);

      // Get business stats - only count active businesses for total
      const businessesByStatus = {
        active: activeBusinesses.length,
        inactive: allBusinesses.length - activeBusinesses.length,
        total: activeBusinesses.length // Only count active businesses
      };

      // Get user stats by role - only count active users
      const usersByRole = {
        master: activeUsers.filter(u => u.role === "master").length,
        admin: activeUsers.filter(u => u.role === "admin").length,
        staff: activeUsers.filter(u => u.role === "staff").length,
        mechanic: activeUsers.filter(u => u.role === "mechanic").length,
        total: activeUsers.length // Only count active users
      };

      res.json({
        businesses: businessesByStatus,
        users: usersByRole
      });
    } catch (error) {
      next(error);
    }
  }

  private async getAllBusinesses(req: Request, res: Response, next: NextFunction) {
    try {
      // Master dashboard should show all businesses including inactive by default
      const includeInactive = req.query.includeInactive !== "false"; // Default to true
      const businesses = includeInactive 
        ? await storage.getAllBusinessesIncludingInactive()
        : await storage.getAllBusinesses();
      
      // Get all users once to avoid multiple queries
      const allUsers = await storage.getAllUsersAcrossAllBusinesses();
      
      // Get user counts for each business (including inactive users for accurate counts)
      const businessesWithStats = businesses.map((business) => {
          const businessUsers = allUsers.filter(u => u.businessId === business.id);
          return {
            ...business,
            userCount: businessUsers.length,
            activeUserCount: businessUsers.filter(u => u.isActive).length
          };
      });

      res.json(businessesWithStats);
    } catch (error) {
      next(error);
    }
  }

  private async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const business = await storage.getBusiness(id);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      const users = await storage.getAllUsers(id);
      res.json({
        ...business,
        users: users.map(u => {
          const { password, ...userWithoutPassword } = u;
          return userWithoutPassword;
        })
      });
    } catch (error) {
      next(error);
    }
  }

  private async createBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, address, subscriptionTier, userLimit, textCredits } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Business name is required" });
      }

      // Check if business name already exists
      const existing = await storage.getBusinessByName(name);
      if (existing) {
        return res.status(400).json({ message: "Business name already exists" });
      }

      const businessData: InsertBusiness = {
        name,
        email,
        phone,
        address,
        subscriptionTier: subscriptionTier || undefined,
        userLimit: userLimit != null && userLimit !== "" ? Number(userLimit) : undefined,
        textCredits: textCredits != null && textCredits !== "" ? Number(textCredits) : 0,
      };

      const business = await storage.createBusiness(businessData);
      
      // Log activity
      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'master_create_business',
        description: `Master user created business: ${name}`,
        entityType: 'business',
        entityId: business.id,
        metadata: { businessName: name }
      });

      res.status(201).json(business);
    } catch (error) {
      next(error);
    }
  }

  private async updateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const { name, email, phone, address, isActive, subscriptionTier, userLimit, textCredits } = req.body;

      const business = await storage.getBusiness(id);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // If changing name, check for duplicates
      if (name && name !== business.name) {
        const existing = await storage.getBusinessByName(name);
        if (existing) {
          return res.status(400).json({ message: "Business name already exists" });
        }
      }

      const updateData: Partial<InsertBusiness> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (subscriptionTier !== undefined) updateData.subscriptionTier = subscriptionTier || undefined;
      if (userLimit !== undefined) updateData.userLimit = userLimit !== "" && userLimit != null ? Number(userLimit) : undefined;
      if (textCredits !== undefined) updateData.textCredits = textCredits !== "" && textCredits != null ? Number(textCredits) : 0;

      const updated = await storage.updateBusiness(id, updateData);
      
      // Handle isActive separately if provided
      if (isActive !== undefined) {
        if (!isActive) {
          await storage.deleteBusiness(id); // Soft delete
        } else {
          // Reactivate
          await storage.updateBusiness(id, {});
        }
      }

      // Log activity
      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'master_update_business',
        description: `Master user updated business: ${business.name}`,
        entityType: 'business',
        entityId: id,
        metadata: { changes: updateData }
      });

      res.json(updated || await storage.getBusiness(id));
    } catch (error) {
      next(error);
    }
  }

  private async deleteBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const business = await storage.getBusiness(id);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Get all users for this business before deactivating
      const allUsers = await storage.getAllUsersAcrossAllBusinesses();
      // Do not treat master users as belonging to any business – never deactivate them here
      const businessUsers = allUsers.filter(u => u.businessId === id && u.role !== "master");

      // Deactivate the business
      await storage.deleteBusiness(id);

      // Deactivate all users associated with this business
      for (const user of businessUsers) {
        await storage.deactivateUser(user.id);
      }

      // Log activity
      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'master_delete_business',
        description: `Master user deactivated business: ${business.name} and ${businessUsers.length} associated user(s)`,
        entityType: 'business',
        entityId: id,
        metadata: { 
          businessName: business.name,
          deactivatedUsersCount: businessUsers.length,
          deactivatedUserIds: businessUsers.map(u => u.id)
        }
      });

      res.json({ 
        message: "Business deactivated successfully",
        deactivatedUsersCount: businessUsers.length
      });
    } catch (error) {
      next(error);
    }
  }

  private async permanentlyDeleteBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const business = await storage.getBusiness(id);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Get counts before deletion for logging
      const allUsers = await storage.getAllUsersAcrossAllBusinesses();
      const businessUsers = allUsers.filter(u => u.businessId === id);
      
      // Get counts of other data
      const allCustomers = await db.select().from(customers).where(eq(customers.businessId, id));
      const allJobs = await db.select().from(jobs).where(eq(jobs.businessId, id));
      const allEquipment = await db.select().from(equipment).where(eq(equipment.businessId, id));

      // Permanently delete the business and all associated data
      await storage.permanentlyDeleteBusiness(id);

      // Log activity
      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'master_permanently_delete_business',
        description: `Master user permanently deleted business: ${business.name} and all associated data`,
        entityType: 'business',
        entityId: id,
        metadata: { 
          businessName: business.name,
          deletedUsersCount: businessUsers.length,
          deletedCustomersCount: allCustomers.length,
          deletedJobsCount: allJobs.length,
          deletedEquipmentCount: allEquipment.length
        }
      });

      res.json({ 
        message: "Business and all associated data permanently deleted",
        deletedUsersCount: businessUsers.length,
        deletedCustomersCount: allCustomers.length,
        deletedJobsCount: allJobs.length,
        deletedEquipmentCount: allEquipment.length
      });
    } catch (error: any) {
      console.error("Error permanently deleting business:", error);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error detail:", error?.detail);
      console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      next(error);
    }
  }

  private async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      // Fetch all users and all businesses in as few queries as possible to avoid
      // connection pool exhaustion and timeouts from per-user lookups
      const [users, businesses] = await Promise.all([
        storage.getAllUsersAcrossAllBusinesses(),
        storage.getAllBusinessesIncludingInactive()
      ]);

      // Build a quick lookup map for business names
      const businessNameById = new Map<number, string>();
      for (const business of businesses) {
        businessNameById.set(business.id, business.name);
      }

      const usersWithBusinesses = users.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          businessName: businessNameById.get(user.businessId) || "Unknown"
        };
      });

      res.json(usersWithBusinesses);
    } catch (error) {
      next(error);
    }
  }

  private async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const users = await storage.getAllUsersAcrossAllBusinesses();
      const user = users.find(u => u.id === id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const business = await storage.getBusiness(user.businessId);
      const { password, ...userWithoutPassword } = user;
      
      res.json({
        ...userWithoutPassword,
        business: business
      });
    } catch (error) {
      next(error);
    }
  }

  private async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, email, fullName, role, businessId } = req.body;

      if (!username || !password || !email || !fullName || !businessId) {
        return res.status(400).json({ 
          message: "Username, password, email, full name, and business ID are required" 
        });
      }

      // Verify business exists
      const business = await storage.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Check if email already exists across all businesses (all users, active or inactive)
        const [existingUserByEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      // Check if username already exists across all businesses (all users, active or inactive)
      const [existingUserByUsername] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const hashedPassword = await hashPassword(password);
      const userData: InsertUser = {
        username,
        password: hashedPassword,
        email,
        fullName,
        role: role || "staff",
        businessId,
        isActive: true
      };

      const user = await storage.createUser(userData);

      // Log activity
      const userId = (req.session as any).userId;
      const masterBusinessId = (req.session as any).businessId;
      await logActivity({
        businessId: masterBusinessId,
        userId: userId,
        activityType: 'master_create_user',
        description: `Master user created user: ${username} for business: ${business.name}`,
        entityType: 'user',
        entityId: user.id,
        metadata: { username, businessName: business.name, role }
      });

      // Send welcome email to the new user
      try {
        await sendWelcomeEmail(email, fullName, username, business);
      } catch (emailError) {
        // Log error but don't fail the user creation if email fails
        console.error("Failed to send welcome email:", emailError);
      }

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  }

  private async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const { username, email, fullName, role, isActive, businessId, password } = req.body;

      const users = await storage.getAllUsersAcrossAllBusinesses();
      const user = users.find(u => u.id === id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData: Partial<InsertUser> = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (businessId !== undefined) {
        // Verify new business exists
        const business = await storage.getBusiness(businessId);
        if (!business) {
          return res.status(404).json({ message: "Business not found" });
        }
        updateData.businessId = businessId;
      }

      // Master users are system-level and must not be deactivated, reassigned, or demoted
      if (user.role === "master") {
        if (role !== undefined && role !== "master") {
          return res.status(400).json({ message: "Master user role cannot be changed" });
        }
        if (isActive !== undefined && isActive === false) {
          return res.status(400).json({ message: "Master user cannot be deactivated" });
        }
        if (businessId !== undefined && businessId !== user.businessId) {
          return res.status(400).json({ message: "Master user is not associated with a business and cannot be reassigned" });
        }
      }

      // Handle password update - hash it if provided
      if (password !== undefined && password !== null && password !== "") {
        const hashedPassword = await hashPassword(password);
        updateData.password = hashedPassword;
      }

      // Check for conflicts if updating email or username
      if (email && email !== user.email) {
        // Check email across all businesses (all users, active or inactive)
        const existingUsersByEmail = await db.select().from(usersTable).where(eq(usersTable.email, email));
        if (existingUsersByEmail.length > 0 && existingUsersByEmail[0]?.id !== id) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      if (username && username !== user.username) {
        // Check username across all businesses (all users, active or inactive)
        const existingUsersByUsername = await db.select().from(usersTable).where(eq(usersTable.username, username));
        if (existingUsersByUsername.length > 0 && existingUsersByUsername[0]?.id !== id) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }

      const updated = await storage.updateUser(id, updateData);

      // Log activity
      const userId = (req.session as any).userId;
      const masterBusinessId = (req.session as any).businessId;
      await logActivity({
        businessId: masterBusinessId,
        userId: userId,
        activityType: 'master_update_user',
        description: `Master user updated user: ${user.username}`,
        entityType: 'user',
        entityId: id,
        metadata: { changes: updateData }
      });

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  }

  private async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const users = await storage.getAllUsersAcrossAllBusinesses();
      const user = users.find(u => u.id === id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "master") {
        return res.status(400).json({ message: "Master user cannot be deactivated" });
      }

      await storage.deactivateUser(id);

      // Log activity
      const userId = (req.session as any).userId;
      const masterBusinessId = (req.session as any).businessId;
      await logActivity({
        businessId: masterBusinessId,
        userId: userId,
        activityType: 'master_deactivate_user',
        description: `Master user deactivated user: ${user.username}`,
        entityType: 'user',
        entityId: id,
        metadata: { username: user.username }
      });

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      next(error);
    }
  }

  private async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const [allBusinesses, allUsers] = await Promise.all([
        storage.getAllBusinessesIncludingInactive(),
        storage.getAllUsersAcrossAllBusinesses()
      ]);

      const activeBusinesses = allBusinesses.filter(b => b.isActive);
      const activeUsers = allUsers.filter(u => u.isActive);

      // Business growth over time
      const businessGrowth = allBusinesses.reduce((acc: any, business) => {
        const date = new Date(business.createdAt).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      // User growth over time
      const userGrowth = activeUsers.reduce((acc: any, user) => {
        const date = new Date(user.createdAt).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      // Users per business - compute from already-fetched users to avoid N+1 queries
      const usersPerBusiness = activeBusinesses.map((business) => {
        const userCount = activeUsers.filter(u => u.businessId === business.id).length;
        return {
          businessId: business.id,
          businessName: business.name,
          userCount
        };
      });

      res.json({
        businesses: {
          total: allBusinesses.length,
          active: activeBusinesses.length,
          inactive: allBusinesses.length - activeBusinesses.length,
          growth: businessGrowth
        },
        users: {
          total: allUsers.length,
          active: activeUsers.length,
          inactive: allUsers.length - activeUsers.length,
          byRole: {
            master: activeUsers.filter(u => u.role === "master").length,
            admin: activeUsers.filter(u => u.role === "admin").length,
            staff: activeUsers.filter(u => u.role === "staff").length,
            mechanic: activeUsers.filter(u => u.role === "mechanic").length
          },
          growth: userGrowth
        },
        usersPerBusiness
      });
    } catch (error) {
      next(error);
    }
  }
}

export const masterController = new MasterController();


