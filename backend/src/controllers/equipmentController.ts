import { Router, Request, Response, NextFunction } from "express";
import { insertEquipmentSchema } from "@shared/schema";
import { equipmentService } from "../services/domains/equipmentService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";

export class EquipmentController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listEquipment);
    this.router.get("/customer/:customerId", isAuthenticated, this.getEquipmentByCustomer);
    this.router.get("/:id", isAuthenticated, this.getEquipment);
    this.router.post("/", isAuthenticated, this.createEquipment);
    this.router.put("/:id", isAuthenticated, this.updateEquipment);
    this.router.delete("/:id", isAuthenticated, this.deleteEquipment);
  }

  private async listEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const equipment = await equipmentService.listEquipment(businessId);
      res.json(equipment);
    } catch (error) {
      next(error);
    }
  }

  private async getEquipmentByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const customerId = Number(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }

      const equipment = await equipmentService.getEquipmentByCustomer(customerId, businessId);
      res.json(equipment);
    } catch (error) {
      next(error);
    }
  }

  private async getEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const equipment = await equipmentService.getEquipmentById(id, businessId);

      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      res.json(equipment);
    } catch (error) {
      next(error);
    }
  }

  private async createEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const data = insertEquipmentSchema.parse({ ...req.body, businessId });
      const actorId = (req.session as any)?.userId ?? undefined;
      const equipment = await equipmentService.createEquipment(data, actorId);
      res.status(201).json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid equipment data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const data = insertEquipmentSchema.parse(req.body);
      const equipment = await equipmentService.updateEquipment(id, data, businessId);
      res.json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid equipment data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async deleteEquipment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const actorId = (req.session as any)?.userId ?? undefined;
      const deleted = await equipmentService.deleteEquipment(id, businessId, actorId);

      if (!deleted) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      res.json({ message: "Equipment deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const equipmentController = new EquipmentController();
