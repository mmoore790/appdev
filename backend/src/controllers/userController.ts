import { Router, Request, Response, NextFunction } from "express";
import { insertUserSchema } from "@shared/schema";
import { userService } from "../services/domains/userService";
import { isAuthenticated } from "../auth";
import { z } from "zod";

export class UserController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listUsers);
    this.router.get("/:id", isAuthenticated, this.getUser);
    this.router.post("/", isAuthenticated, this.createUser);
  }

  private async listUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.listUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  private async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const user = await userService.getUserById(id);

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
      const data = insertUserSchema.parse(req.body);
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
