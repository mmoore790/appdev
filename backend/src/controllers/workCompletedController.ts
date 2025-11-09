import { Router, Request, Response, NextFunction } from "express";
import { workCompletedService } from "../services/domains/workCompletedService";
import { isAuthenticated } from "../auth";

export class WorkCompletedController {
  public readonly router = Router();

  constructor() {
    this.router.get("/:jobId", isAuthenticated, this.listWorkEntries);
    this.router.post("/", isAuthenticated, this.createWorkEntry);
    this.router.put("/:id", isAuthenticated, this.updateWorkEntry);
    this.router.delete("/:id", isAuthenticated, this.deleteWorkEntry);
  }

  private async listWorkEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = Number(req.params.jobId);
      const entries = await workCompletedService.listByJob(jobId);
      res.json(entries);
    } catch (error) {
      next(error);
    }
  }

  private async createWorkEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await workCompletedService.createWorkEntry(req.body);
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  }

  private async updateWorkEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const entry = await workCompletedService.updateWorkEntry(id, req.body);

      if (!entry) {
        return res.status(404).json({ message: "Work completed entry not found" });
      }

      res.json(entry);
    } catch (error) {
      next(error);
    }
  }

  private async deleteWorkEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const deleted = await workCompletedService.deleteWorkEntry(id);

      if (!deleted) {
        return res.status(404).json({ message: "Work completed entry not found" });
      }

      res.json({ message: "Work completed entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const workCompletedController = new WorkCompletedController();
