import { Router, Request, Response, NextFunction } from "express";
import { insertTaskSchema } from "@shared/schema";
import { taskService } from "../services/domains/taskService";
import { isAuthenticated } from "../auth";
import { z } from "zod";

export class TaskController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listTasks);
    this.router.get("/:id", isAuthenticated, this.getTask);
    this.router.post("/", isAuthenticated, this.createTask);
    this.router.put("/:id", isAuthenticated, this.updateTask);
  }

  private async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const assignedTo = req.query.assignedTo ? Number(req.query.assignedTo) : undefined;
      const pendingOnly = req.query.pendingOnly === "true";
      const tasks = await taskService.listTasks({ assignedTo, pendingOnly });
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  }

  private async getTask(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const task = await taskService.getTaskById(id);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      next(error);
    }
  }

  private async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const data = insertTaskSchema.parse(req.body);
      const actorId = (req.session as any)?.userId ?? undefined;
      const task = await taskService.createTask(data, actorId);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid task data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const actorId = (req.session as any)?.userId ?? undefined;
      const updated = await taskService.updateTask(id, req.body, actorId);

      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
