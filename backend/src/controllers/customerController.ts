import { Router, Request, Response, NextFunction } from "express";
import { insertCustomerSchema } from "@shared/schema";
import { customerService } from "../services/domains/customerService";
import { isAuthenticated } from "../auth";
import { z } from "zod";

export class CustomerController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listCustomers);
    this.router.get("/:id", isAuthenticated, this.getCustomer);
    this.router.post("/", isAuthenticated, this.createCustomer);
    this.router.put("/:id", isAuthenticated, this.updateCustomer);
    this.router.delete("/:id", isAuthenticated, this.deleteCustomer);
  }

  private async listCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const customers = await customerService.listCustomers(search);
      res.json(customers);
    } catch (error) {
      next(error);
    }
  }

  private async getCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const customer = await customerService.getCustomerById(id);

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      next(error);
    }
  }

  private async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const actorId = (req.session as any)?.userId ?? undefined;
      const customer = await customerService.createCustomer(data, actorId);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid customer data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const data = insertCustomerSchema.partial().parse(req.body);
      const actorId = (req.session as any)?.userId ?? undefined;
      const updated = await customerService.updateCustomer(id, data, actorId);

      if (!updated) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid customer data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const deleted = await customerService.deleteCustomer(id);

      if (!deleted) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
