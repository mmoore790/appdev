import { Router, Request, Response, NextFunction } from "express";
import {
  insertPaymentRequestSchema,
  jobPaymentRequestSchema,
  recordPaymentSchema,
} from "@shared/schema";
import { paymentService } from "../services/domains/paymentService";
import StripeService from "../stripe-service";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";

export class PaymentController {
  public readonly router = Router();

  constructor() {
    this.router.get("/payment-requests", isAuthenticated, this.listPaymentRequests);
    this.router.get(
      "/payment-requests/job/:jobId",
      isAuthenticated,
      this.listPaymentRequestsForJob
    );
    this.router.post("/payment-requests", isAuthenticated, this.createPaymentRequest);
    this.router.get(
      "/payment-requests/:id/status",
      isAuthenticated,
      this.getPaymentRequestStatus
    );
    this.router.put("/payment-requests/:id", isAuthenticated, this.updatePaymentRequest);

    this.router.post(
      "/jobs/:jobId/payments/record",
      isAuthenticated,
      this.recordJobPayment
    );
    this.router.post(
      "/jobs/:jobId/payments/request",
      isAuthenticated,
      this.createJobPaymentRequest
    );
    this.router.get(
      "/jobs/:jobId/payments",
      isAuthenticated,
      this.getJobPaymentHistory
    );
    this.router.post(
      "/jobs/:jobId/payments/refresh",
      isAuthenticated,
      this.refreshJobPayments
    );

    this.router.get("/stripe/status", isAuthenticated, this.getStripeStatus);
    this.router.get(
      "/stripe/session/:sessionId",
      isAuthenticated,
      this.getStripeSessionDetails
    );

    this.router.post("/stripe/webhook", this.handleStripeWebhook);
    this.router.post("/jobs/payments/webhook", this.handleLegacyWebhook);
  }

  private async listPaymentRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const requests = await paymentService.listPaymentRequests(businessId);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  }

  private async listPaymentRequestsForJob(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const requests = await paymentService.listPaymentRequestsByJob(jobId, businessId);
      res.json(requests);
    } catch (error) {
      next(error);
    }
  }

  private async createPaymentRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const payload = insertPaymentRequestSchema.parse({ ...req.body, businessId });
      const actorId = (req.session as any).userId || 1;
      const result = await paymentService.createPaymentRequest(payload, actorId);

      if (result.error) {
        res.status(201).json({
          ...result.paymentRequest,
          error: result.error,
        });
      } else {
        res.status(201).json(result.paymentRequest);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid payment data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async getPaymentRequestStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const status = await paymentService.getPaymentStatus(id, businessId);

      if (!status) {
        return res.status(404).json({ message: "Payment request not found" });
      }

      res.json(status);
    } catch (error) {
      next(error);
    }
  }

  private async updatePaymentRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const updated = await paymentService.updatePaymentRequest(id, req.body, businessId);

      if (!updated) {
        return res.status(404).json({ message: "Payment request not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  private async recordJobPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = Number(req.params.jobId);
      const actorId = req.session.userId;

      if (!actorId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const payload = recordPaymentSchema.parse(req.body);
      const result = await paymentService.recordJobPayment(jobId, payload, actorId);

      if (!result) {
        return res.status(500).json({ message: "Failed to record payment" });
      }

      res.json({ message: "Payment recorded successfully", job: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid payment data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async createJobPaymentRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const actorId = req.session.userId;

      if (!actorId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const payload = jobPaymentRequestSchema.parse(req.body);
      const result = await paymentService.createJobPaymentRequest(jobId, payload, businessId, actorId);

      res.json({
        message: result.error
          ? "Payment request created (email sent without payment link)"
          : "Payment request created successfully",
        paymentRequest: result.paymentRequest,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid payment data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async getJobPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const history = await paymentService.getJobPaymentHistory(jobId, businessId);

      if (!history) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  private async refreshJobPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const result = await paymentService.refreshJobPaymentStatuses(jobId, businessId);
      res.json({
        message: `Payment status refreshed. ${result.updatedCount} requests updated, ${result.paidRequests} payments completed.`,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  private async getStripeStatus(_req: Request, res: Response) {
    const configured = StripeService.isConfigured();
    res.json({
      configured,
      message: configured
        ? "Stripe integration is configured and ready"
        : "Stripe integration requires STRIPE_SECRET_KEY environment variable",
    });
  }

  private async getStripeSessionDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const sessionId = req.params.sessionId;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const details = await paymentService.getStripeSessionDetails(sessionId, businessId);
      res.json(details);
    } catch (error) {
      if (error instanceof Error && error.message === "Stripe integration not configured") {
        return res.status(503).json({ message: error.message });
      }
      next(error);
    }
  }

  private async handleStripeWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.handleStripeWebhook(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  private async handleLegacyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.handleLegacyWebhook(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
