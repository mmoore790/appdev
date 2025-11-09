import { Router, Request, Response, NextFunction } from "express";
import { insertPartOnOrderSchema } from "@shared/schema";
import { partOrderService } from "../services/domains/partOrderService";
import { isAuthenticated } from "../auth";
import { z } from "zod";

function formatPart(part: any) {
  if (!part) return part;
  return {
    ...part,
    estimatedCost: part.estimatedCost != null ? part.estimatedCost / 100 : null,
    actualCost: part.actualCost != null ? part.actualCost / 100 : null,
  };
}

export class PartOrderController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listParts);
    this.router.get("/overdue", isAuthenticated, this.listOverdueParts);
    this.router.get("/:id", isAuthenticated, this.getPart);
    this.router.post("/", isAuthenticated, this.createPart);
    this.router.put("/:id", isAuthenticated, this.updatePart);
    this.router.post("/:id/arrived", isAuthenticated, this.markArrived);
    this.router.post("/:id/collected", isAuthenticated, this.markCollected);
    this.router.post("/:id/notify-customer", isAuthenticated, this.notifyCustomer);
    this.router.get("/:id/updates", isAuthenticated, this.listUpdates);
  }

  private async listParts(_req: Request, res: Response, next: NextFunction) {
    try {
      const parts = await partOrderService.listPartOrders();
      res.json(parts.map(formatPart));
    } catch (error) {
      next(error);
    }
  }

  private async listOverdueParts(req: Request, res: Response, next: NextFunction) {
    try {
      const daysSince = req.query.days ? Number(req.query.days) : undefined;
      const parts = await partOrderService.listOverduePartOrders(daysSince);
      res.json(parts.map(formatPart));
    } catch (error) {
      next(error);
    }
  }

  private async getPart(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }

      const part = await partOrderService.getPartOrderById(id);
      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      res.json(formatPart(part));
    } catch (error) {
      next(error);
    }
  }

  private async createPart(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req.session as any)?.userId;
      const data = insertPartOnOrderSchema.parse({
        ...req.body,
        createdBy: actorId,
      });
      const part = await partOrderService.createPartOrder(data);
      res.status(201).json(formatPart(part));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  }

  private async updatePart(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }

      const actorId = (req.session as any)?.userId;
      const part = await partOrderService.updatePartOrder(id, {
        ...req.body,
        updatedBy: actorId,
      });

      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      res.json(formatPart(part));
    } catch (error) {
      next(error);
    }
  }

  private async markArrived(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }

      const actorId = (req.session as any)?.userId;
      const { actualDeliveryDate, actualCost, notes } = req.body;

      const part = await partOrderService.markPartAsArrived(id, actorId, {
        actualDeliveryDate,
        actualCost,
        notes,
      });

      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      res.json(formatPart(part));
    } catch (error) {
      next(error);
    }
  }

  private async markCollected(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }

      const actorId = (req.session as any)?.userId;
      const part = await partOrderService.markPartAsCollected(id, actorId);

      if (!part) {
        return res.status(404).json({ message: "Part not found" });
      }

      res.json(formatPart(part));
    } catch (error) {
      next(error);
    }
  }

  private async notifyCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }

      const actorId = (req.session as any)?.userId;
      const { success, reason } = await partOrderService.notifyCustomerPartReady(id, actorId);

      if (!success) {
        switch (reason) {
          case "not_found":
            return res.status(404).json({ message: "Part not found" });
          case "not_arrived":
            return res.status(400).json({ message: "Part has not arrived yet" });
          case "missing_email":
            return res.status(400).json({ message: "No customer email on file" });
        }
      }

      res.json({ message: "Customer notified successfully" });
    } catch (error) {
      next(error);
    }
  }

  private async listUpdates(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid part ID" });
      }

      const updates = await partOrderService.listPartOrderUpdates(id);
      res.json(updates);
    } catch (error) {
      next(error);
    }
  }
}

export const partOrderController = new PartOrderController();
