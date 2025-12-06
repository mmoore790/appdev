import { Router, Request, Response, NextFunction } from "express";
import { insertUserSchema, users } from "@shared/schema";
import { userService } from "../services/domains/userService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";
import { db } from "../db";
import { eq } from "drizzle-orm";

export class UserController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listUsers);
    this.router.get("/:id", isAuthenticated, this.getUser);
    this.router.post("/", isAuthenticated, this.createUser);
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
      
      const actorId = (req.session as any)?.userId ?? undefined;
      const newUser = await userService.createUser(data, actorId);
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
}

export const userController = new UserController();
