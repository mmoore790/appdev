import { Router, Request, Response, NextFunction } from "express";
import { insertTimeEntrySchema } from "@shared/schema";
import { timeEntryService } from "../services/domains/timeEntryService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";

export class TimeEntryController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listTimeEntries);
    this.router.get("/:id", isAuthenticated, this.getTimeEntry);
    this.router.post("/", isAuthenticated, this.createTimeEntry);
    this.router.put("/:id", isAuthenticated, this.updateTimeEntry);
    this.router.delete("/:id", isAuthenticated, this.deleteTimeEntry);
  }

  private async listTimeEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const jobId = req.query.jobId ? Number(req.query.jobId) : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      const entries = await timeEntryService.listTimeEntries(businessId, { userId, jobId, startDate, endDate });
      res.json(entries);
    } catch (error) {
      next(error);
    }
  }

  private async getTimeEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const entry = await timeEntryService.getTimeEntryById(id, businessId);

      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }

      res.json(entry);
    } catch (error) {
      next(error);
    }
  }

  private async createTimeEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const data = insertTimeEntrySchema.parse({ ...req.body, businessId });
      const actorId = (req.session as any)?.userId ?? undefined;
      const entry = await timeEntryService.createTimeEntry({
        ...data,
        createdBy: data.createdBy ?? actorId,
      });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid time entry data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateTimeEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid time entry identifier" });
      }
      
      const updated = await timeEntryService.updateTimeEntry(id, req.body, businessId);

      if (!updated) {
        return res.status(404).json({ message: "Time entry not found" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid time entry data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async deleteTimeEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid time entry identifier" });
      }
      
      const deleted = await timeEntryService.deleteTimeEntry(id, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Time entry not found" });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const timeEntryController = new TimeEntryController();

