import { Router, Request, Response, NextFunction } from "express";
import { insertUserSchema, users } from "@shared/schema";
import { userService } from "../services/domains/userService";
import { isAuthenticated, hashPassword } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { storage } from "../storage";

export class UserController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listUsers);
    this.router.get("/count/current", isAuthenticated, this.getUserCount);
    this.router.get("/:id", isAuthenticated, this.getUser);
    this.router.post("/", isAuthenticated, this.createUser);
    this.router.put("/:id", isAuthenticated, this.updateUser);
    this.router.delete("/:id", isAuthenticated, this.deactivateUser);
  }

  private async getUserCount(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      const userList = await userService.listUsers(businessId);
      const current = userList.length;
      const max = business?.userLimit ?? 999;
      const plan = business?.subscriptionTier ?? "—";
      const canAddMore = max === null || max === undefined || current < max;
      res.json({ current, max: max ?? 999, plan, canAddMore });
    } catch (error) {
      next(error);
    }
  }

  private async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const users = await userService.listUsers(businessId);
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  private async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const user = await userService.getUserById(id, businessId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  private async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      const existingUsers = await userService.listUsers(businessId);
      const maxAllowed = business?.userLimit ?? 999;
      if (maxAllowed !== null && maxAllowed !== undefined && existingUsers.length >= maxAllowed) {
        return res.status(403).json({
          message: "User limit reached. Contact Boltdown support to increase your limit.",
        });
      }

      const data = insertUserSchema.parse({ ...req.body, businessId });
      
      // Check if email already exists across all businesses (all users, active or inactive)
      if (data.email) {
        const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
        if (existingUserByEmail) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      // Check if username already exists across all businesses (all users, active or inactive)
      if (data.username) {
        const [existingUserByUsername] = await db.select().from(users).where(eq(users.username, data.username)).limit(1);
        if (existingUserByUsername) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }

      // Hash password using same method as master dashboard and registration (bcrypt)
      const userData = data.password
        ? { ...data, password: await hashPassword(data.password) }
        : data;

      const actorId = (req.session as any)?.userId ?? undefined;
      const newUser = await userService.createUser(userData, actorId);
      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid user data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const targetUser = await userService.getUserById(id, businessId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const { fullName, username, email, role, newPassword } = req.body as {
        fullName?: string;
        username?: string;
        email?: string;
        role?: string;
        newPassword?: string;
      };
      if (role === "master") {
        return res.status(400).json({ message: "Cannot set role to master from admin settings" });
      }
      if (username !== undefined && username !== targetUser.username) {
        const [existingByUsername] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (existingByUsername && existingByUsername.id !== id) {
          return res.status(400).json({ message: "Username already in use" });
        }
      }
      if (email !== undefined && email?.trim()) {
        const newEmail = email.trim();
        if (newEmail !== (targetUser.email || "").trim()) {
          const [existingByEmail] = await db.select().from(users).where(eq(users.email, newEmail)).limit(1);
          if (existingByEmail && existingByEmail.id !== id) {
            return res.status(400).json({ message: "Email already in use" });
          }
        }
      }

      const updateData: Partial<{ fullName: string; username: string; email: string | null; role: string; password: string }> = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email || null;
      if (role !== undefined) updateData.role = role;
      if (newPassword !== undefined && newPassword !== null && newPassword !== "") {
        updateData.password = await hashPassword(newPassword);
      }
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const actorId = (req.session as any)?.userId as number | undefined;
      const updated = await userService.updateUser(id, businessId, updateData, actorId);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (error) {
      next(error);
    }
  }

  private async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const targetUser = await userService.getUserById(id, businessId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const actorId = (req.session as any)?.userId as number | undefined;
      const ok = await userService.deactivateUser(id, businessId, actorId);
      if (!ok) {
        return res.status(400).json({ message: "User could not be removed (e.g. master or already inactive)" });
      }
      res.json({ message: "User removed successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
