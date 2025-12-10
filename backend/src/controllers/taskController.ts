import { Router, Request, Response, NextFunction } from "express";
import { insertTaskSchema } from "@shared/schema";
import { taskService, InvalidTaskStatusError } from "../services/domains/taskService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
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
      const businessId = getBusinessIdFromRequest(req);
      const userId = (req.session as any)?.userId;
      console.log(`[TaskController] listTasks - userId: ${userId}, businessId: ${businessId}`);
      
      const assignedTo = req.query.assignedTo ? Number(req.query.assignedTo) : undefined;
      const pendingOnly = req.query.pendingOnly === "true";
      const tasks = await taskService.listTasks(businessId, { assignedTo, pendingOnly });
      
      console.log(`[TaskController] listTasks - Returning ${tasks.length} tasks for businessId: ${businessId}`);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  }

  private async getTask(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const task = await taskService.getTaskById(id, businessId);

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
      const businessId = getBusinessIdFromRequest(req);
      console.log(`[TaskController] createTask - businessId: ${businessId}, body:`, JSON.stringify(req.body, null, 2));
      
      const data = insertTaskSchema.parse({ ...req.body, businessId });
      console.log(`[TaskController] createTask - Parsed data:`, JSON.stringify(data, null, 2));
      
      const actorId = (req.session as any)?.userId ?? undefined;
      const task = await taskService.createTask(data, actorId);
      
      console.log(`[TaskController] createTask - Task created successfully with ID: ${task.id}`);
      res.status(201).json(task);
    } catch (error) {
      console.error(`[TaskController] createTask - Error:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid task data",
          errors: error.errors,
        });
      }
      if (error instanceof InvalidTaskStatusError) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  private async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid task identifier" });
      }
      const actorId = (req.session as any)?.userId ?? undefined;
      const updated = await taskService.updateTask(id, req.body, businessId, actorId);

      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof InvalidTaskStatusError) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
}

export const taskController = new TaskController();
