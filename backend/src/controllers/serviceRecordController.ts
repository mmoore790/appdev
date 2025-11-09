import { Router, Request, Response, NextFunction } from "express";
import { insertServiceSchema } from "@shared/schema";
import { serviceRecordService } from "../services/domains/serviceRecordService";
import { isAuthenticated } from "../auth";
import { z } from "zod";

export class ServiceRecordController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listServices);
    this.router.get("/:id", isAuthenticated, this.getService);
    this.router.post("/", isAuthenticated, this.createService);
    this.router.put("/:id", isAuthenticated, this.updateService);
  }

  private async listServices(_req: Request, res: Response, next: NextFunction) {
    try {
      const services = await serviceRecordService.listServices();
      res.json(services);
    } catch (error) {
      next(error);
    }
  }

  private async getService(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const service = await serviceRecordService.getServiceById(id);

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      res.json(service);
    } catch (error) {
      next(error);
    }
  }

  private async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const data = insertServiceSchema.parse(req.body);
      const actorId = (req.session as any)?.userId ?? undefined;
      const service = await serviceRecordService.createService(data, actorId);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid service data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const data = insertServiceSchema.parse(req.body);
      const service = await serviceRecordService.updateService(id, data);
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid service data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }
}

export const serviceRecordController = new ServiceRecordController();
