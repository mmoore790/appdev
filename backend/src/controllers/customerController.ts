import { Router, Request, Response, NextFunction } from "express";
import { insertCustomerSchema } from "@shared/schema";
import { customerService } from "../services/domains/customerService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";
import { storage } from "../storage";
import { EmailService } from "../services/emailService";

const emailServiceInstance = new EmailService();

export class CustomerController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listCustomers);
    this.router.get("/export/csv", isAuthenticated, this.exportCustomersCSV);
    this.router.get("/check-email", isAuthenticated, this.checkEmailExists);
    this.router.get("/:id/details", isAuthenticated, this.getCustomerDetails);
    this.router.post("/:id/send-email", isAuthenticated, this.sendQuickEmail);
    this.router.get("/:id", isAuthenticated, this.getCustomer);
    this.router.post("/", isAuthenticated, this.createCustomer);
    this.router.put("/:id", isAuthenticated, this.updateCustomer);
    this.router.delete("/:id", isAuthenticated, this.deleteCustomer);
  }

  private async listCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const search = req.query.search ? String(req.query.search) : undefined;
      const page = req.query.page ? Math.max(1, parseInt(String(req.query.page), 10)) : 1;
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10))) : 25;
      
      const result = await customerService.listCustomers(businessId, search, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const customer = await customerService.getCustomerById(id, businessId);

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
      const businessId = getBusinessIdFromRequest(req);
      const data = insertCustomerSchema.parse({ ...req.body, businessId });
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
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const data = insertCustomerSchema.partial().parse(req.body);
      const actorId = (req.session as any)?.userId ?? undefined;
      const updated = await customerService.updateCustomer(id, data, businessId, actorId);

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
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const deleted = await customerService.deleteCustomer(id, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  private async checkEmailExists(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const email = req.query.email as string;

      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      const existingCustomer = await storage.getCustomerByEmail(email, businessId);
      
      if (existingCustomer) {
        return res.json({ exists: true, customer: { id: existingCustomer.id, name: existingCustomer.name } });
      }

      res.json({ exists: false });
    } catch (error) {
      next(error);
    }
  }

  private async getCustomerDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const customer = await customerService.getCustomerById(id, businessId);

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Get email history
      const emailHistory = customer.email 
        ? await storage.getEmailHistoryByEmail(customer.email, businessId)
        : [];

      // Get callbacks by customer ID
      const callbacksByCustomer = await storage.getCallbackRequestsByCustomer(id, businessId);

      // Get callbacks by phone number if phone exists
      const callbacksByPhone = customer.phone 
        ? await storage.getCallbackRequestsByPhone(customer.phone, businessId)
        : [];

      // Combine and deduplicate callbacks
      const allCallbacks = [...callbacksByCustomer, ...callbacksByPhone];
      const uniqueCallbacks = Array.from(
        new Map(allCallbacks.map(cb => [cb.id, cb])).values()
      );

      // Get jobs by customer ID
      const jobsByCustomerId = await storage.getAllJobs(businessId);
      const jobsByCustomer = jobsByCustomerId.filter(job => job.customerId === id);

      // Get jobs by phone number if phone exists
      const jobsByPhone = customer.phone 
        ? await storage.getJobsByCustomerPhone(customer.phone, businessId)
        : [];

      // Get jobs by email if email exists
      const jobsByEmail = customer.email 
        ? await storage.getJobsByCustomerEmail(customer.email, businessId)
        : [];

      // Combine and deduplicate jobs
      const allJobs = [...jobsByCustomer, ...jobsByPhone, ...jobsByEmail];
      const uniqueJobs = Array.from(
        new Map(allJobs.map(job => [job.id, job])).values()
      );

      res.json({
        customer,
        emailHistory,
        callbacks: uniqueCallbacks.sort((a, b) => 
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        ),
        jobs: uniqueJobs.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  private async exportCustomersCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const search = req.query.search ? String(req.query.search) : undefined;
      // For export, fetch all customers (no pagination)
      const result = await customerService.listCustomers(businessId, search, 1, 10000);
      const customers = result.data;

      // Generate CSV
      const headers = ["Name", "Email", "Phone", "Address", "Notes"];
      const rows = customers.map(c => [
        c.name || "",
        c.email || "",
        c.phone || "",
        c.address || "",
        c.notes || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => 
          row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const cellStr = String(cell || "");
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="customers-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  private async sendQuickEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const { subject, body } = req.body;
      const actorId = (req.session as any)?.userId ?? undefined;

      if (!subject || !body) {
        return res.status(400).json({ message: "Subject and body are required" });
      }

      const customer = await customerService.getCustomerById(id, businessId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (!customer.email) {
        return res.status(400).json({ message: "Customer does not have an email address" });
      }

      // Send email
      const emailSent = await emailServiceInstance.sendGenericEmail({
        from: emailServiceInstance.getFromAddress(),
        to: customer.email,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });

      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send email" });
      }

      // Record in email history (normalize email to lowercase for consistency)
      await storage.createEmailHistory({
        businessId,
        customerId: customer.id,
        customerEmail: customer.email.toLowerCase(),
        subject,
        body,
        emailType: "manual",
        sentBy: actorId ?? null,
        metadata: null,
      });

      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
