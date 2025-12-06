import { Router, Request, Response, NextFunction } from "express";
import { insertCallbackRequestSchema } from "@shared/schema";
import { callbackService } from "../services/domains/callbackService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";

export class CallbackController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listCallbacks);
    this.router.get("/deleted", isAuthenticated, this.listDeletedCallbacks);
    this.router.post("/", isAuthenticated, this.createCallback);
    this.router.post("/purge-expired", isAuthenticated, this.purgeExpired);
    this.router.get("/:id", isAuthenticated, this.getCallback);
    this.router.put("/:id", isAuthenticated, this.updateCallback);
    this.router.post("/:id/complete", isAuthenticated, this.completeCallback);
    this.router.delete("/:id", isAuthenticated, this.softDeleteCallback);
    this.router.post("/:id/restore", isAuthenticated, this.restoreCallback);
    this.router.delete("/:id/permanent", isAuthenticated, this.permanentDeleteCallback);
  }

  private async listCallbacks(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = (req.session as any)?.userId;
      console.log(`[CallbackController] listCallbacks - userId: ${userId}, businessId: ${businessId}`);
      
      const assignedTo = req.query.assignedTo ? Number(req.query.assignedTo) : undefined;
      const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
      const status =
        req.query.status === "pending" || req.query.status === "completed"
          ? req.query.status
          : undefined;

      const fromDate = req.query.fromDate ? new Date(String(req.query.fromDate)) : undefined;
      const toDate = req.query.toDate ? new Date(String(req.query.toDate)) : undefined;

      const callbacks = await callbackService.listCallbacks(businessId, {
        assignedTo,
        customerId,
        status,
        fromDate,
        toDate,
      });

      console.log(`[CallbackController] listCallbacks - Returning ${callbacks.length} callbacks for businessId: ${businessId}`);
      res.json(callbacks);
    } catch (error) {
      next(error);
    }
  }

  private async listDeletedCallbacks(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const callbacks = await callbackService.listDeletedCallbacks(businessId);
      res.json(callbacks);
    } catch (error) {
      next(error);
    }
  }

  private async getCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const callback = await callbackService.getCallbackById(id, businessId);

      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }

      res.json(callback);
    } catch (error) {
      next(error);
    }
  }

  private async createCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const data = insertCallbackRequestSchema.parse({ ...req.body, businessId });
      const actorId = (req.session as any)?.userId ?? undefined;
      const callback = await callbackService.createCallback(data, actorId);
      res.status(201).json(callback);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid callback data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const callback = await callbackService.updateCallback(id, req.body, businessId);

      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }

      res.json(callback);
    } catch (error) {
      next(error);
    }
  }

  private async completeCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const { notes } = req.body;
      const actorId = (req.session as any)?.userId ?? undefined;
      const callback = await callbackService.completeCallback(id, businessId, notes, actorId);

      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }

      res.json(callback);
    } catch (error) {
      next(error);
    }
  }

  private async softDeleteCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const callback = await callbackService.softDeleteCallback(id, businessId);

      if (!callback) {
        return res.status(404).json({ message: "Callback request not found" });
      }

      res.json({ message: "Callback request deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  private async restoreCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const callback = await callbackService.restoreCallback(id, businessId);

      if (!callback) {
        return res.status(404).json({ message: "Deleted callback request not found" });
      }

      res.json(callback);
    } catch (error) {
      next(error);
    }
  }

  private async permanentDeleteCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const deleted = await callbackService.permanentlyDeleteCallback(id, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Callback request not found" });
      }

      res.json({ message: "Callback request permanently deleted" });
    } catch (error) {
      next(error);
    }
  }

  private async purgeExpired(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const purgedCount = await callbackService.purgeExpiredDeletedCallbacks(businessId);
      res.json({
        success: true,
        purgedCount,
        message: `Successfully purged ${purgedCount} expired deleted callbacks`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const callbackController = new CallbackController();
