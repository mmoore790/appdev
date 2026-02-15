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
import { storage } from "../storage";
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
    this.router.get(
      "/jobs/:jobId/payments/:paymentId/proof",
      isAuthenticated,
      this.getJobPaymentProof
    );
    this.router.get(
      "/jobs/:jobId/payments/:paymentId/details",
      isAuthenticated,
      this.getJobPaymentDetails
    );
    this.router.post(
      "/jobs/:jobId/payments/refresh",
      isAuthenticated,
      this.refreshJobPayments
    );

    this.router.get("/payments/config", this.getPaymentsConfig);
    this.router.get("/payments/receipt/:sessionId", this.downloadPaymentReceipt);
    this.router.get("/payments/receipt/by-intent/:paymentIntentId", this.downloadPaymentReceiptByIntent);
    this.router.post("/payments/init", this.initPayment);
    this.router.get("/stripe/status", isAuthenticated, this.getStripeStatus);
    this.router.get(
      "/stripe/session/:sessionId",
      isAuthenticated,
      this.getStripeSessionDetails
    );
    this.router.get("/stripe/connect/status", isAuthenticated, this.getConnectStatus);
    this.router.post("/stripe/connect/onboard", isAuthenticated, this.connectOnboard);
    this.router.post("/stripe/connect/login-link", isAuthenticated, this.connectLoginLink);

    this.router.get("/boltdown-pay/balance", isAuthenticated, this.getBoltdownPayBalance);
    this.router.get("/boltdown-pay/transactions", isAuthenticated, this.getBoltdownPayTransactions);
    this.router.get("/boltdown-pay/payouts", isAuthenticated, this.getBoltdownPayPayouts);
    this.router.post("/boltdown-pay/account-session", isAuthenticated, this.createBoltdownPayAccountSession);

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

  private async getJobPaymentProof(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const paymentId = Number(req.params.paymentId);
      const result = await paymentService.getJobPaymentProofUrl(jobId, paymentId, businessId);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
        if (
          error.message.includes("only available") ||
          error.message.includes("not available") ||
          error.message.includes("try again")
        ) {
          return res.status(400).json({ message: error.message });
        }
      }
      next(error);
    }
  }

  private async getJobPaymentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const paymentId = Number(req.params.paymentId);
      const details = await paymentService.getJobPaymentDetails(jobId, paymentId, businessId);
      res.json(details);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
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

  /**
   * Public endpoint so the /pay page can load Stripe.js when the frontend
   * is built without VITE_STRIPE_PUBLIC_KEY. Set STRIPE_PUBLISHABLE_KEY in backend .env (pk_test_... or pk_live_...).
   */
  private async getPaymentsConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const key = process.env.STRIPE_PUBLISHABLE_KEY?.trim() || "";
      res.json({ stripePublishableKey: key });
    } catch (error) {
      next(error);
    }
  }

  private async downloadPaymentReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.sessionId;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      const { buffer, filename } = await paymentService.generatePublicPaymentReceipt(sessionId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  private async downloadPaymentReceiptByIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentIntentId = req.params.paymentIntentId;
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      const { buffer, filename } = await paymentService.generatePublicPaymentReceiptByPaymentIntent(paymentIntentId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  private async initPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { checkoutReference } = req.body || {};
      const ref = checkoutReference ?? req.query?.checkoutReference;
      if (!ref || typeof ref !== "string") {
        return res.status(400).json({ error: "Checkout reference is required" });
      }
      const decoded = decodeURIComponent(ref.trim());
      const result = await paymentService.initPaymentForCheckout(decoded);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getBoltdownPayBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business?.stripeAccountId) {
        return res.json({
          available: [],
          pending: [],
          configured: false,
          message: "Boltdown Pay not set up",
        });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Payments not configured" });
      }
      const balance = await stripeService.getConnectBalance(business.stripeAccountId);
      res.json({ ...balance, configured: true });
    } catch (error) {
      next(error);
    }
  }

  private async getBoltdownPayTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business?.stripeAccountId) {
        return res.json({ transactions: [], configured: false });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Payments not configured" });
      }
      const limit = Math.min(parseInt(String(req.query.limit || "20")) || 20, 100);
      const transactions = await stripeService.getConnectBalanceTransactions(
        business.stripeAccountId,
        { limit }
      );
      res.json({
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          fee: t.fee,
          net: t.net,
          type: t.type,
          status: t.status,
          created: new Date(t.created * 1000).toISOString(),
          description: t.description,
        })),
        configured: true,
      });
    } catch (error) {
      next(error);
    }
  }

  private async getBoltdownPayPayouts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business?.stripeAccountId) {
        return res.json({ payouts: [], configured: false });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Payments not configured" });
      }
      const limit = Math.min(parseInt(String(req.query.limit || "10")) || 10, 50);
      const payouts = await stripeService.getConnectPayouts(business.stripeAccountId, { limit });
      res.json({
        payouts: payouts.map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrival_date: p.arrival_date,
          created: new Date(p.created * 1000).toISOString(),
          method: p.method,
        })),
        configured: true,
      });
    } catch (error) {
      next(error);
    }
  }

  private async createBoltdownPayAccountSession(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business?.stripeAccountId) {
        return res.status(400).json({ message: "Boltdown Pay not set up" });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Payments not configured" });
      }
      const { client_secret } = await stripeService.createAccountSession(business.stripeAccountId);
      res.json({ client_secret });
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

  private async getConnectStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.json({
          connected: false,
          configured: false,
          message: "Stripe is not configured for this platform",
        });
      }
      if (!business.stripeAccountId) {
        return res.json({
          connected: false,
          configured: true,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          status: "not_started",
        });
      }
      const account = await stripeService.retrieveConnectAccount(business.stripeAccountId);
      const status = account.charges_enabled
        ? "charges_enabled"
        : account.details_submitted
          ? "pending"
          : "onboarding";
      await storage.updateBusiness(businessId, { stripeAccountStatus: status });
      res.json({
        connected: true,
        configured: true,
        stripeAccountId: business.stripeAccountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        status,
      });
    } catch (error) {
      next(error);
    }
  }

  private async connectOnboard(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }
      let accountId = business.stripeAccountId;
      if (!accountId) {
        const account = await stripeService.createConnectExpressAccount({
          email: business.email || undefined,
          businessName: business.name,
        });
        accountId = account.id;
        await storage.updateBusiness(businessId, {
          stripeAccountId: accountId,
          stripeAccountStatus: "pending",
        });
      } else {
        const account = await stripeService.retrieveConnectAccount(accountId);
        if (account.charges_enabled) {
          return res.json({
            url: null,
            ready: true,
            message: "Stripe payments are already set up",
          });
        }
      }
      const returnPath = "/settings";
      if (!accountId) {
        return res.status(500).json({ message: "Failed to get Connect account" });
      }
      const url = await stripeService.createAccountLink(accountId, returnPath);
      res.json({ url, ready: false });
    } catch (error) {
      next(error);
    }
  }

  private async connectLoginLink(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business?.stripeAccountId) {
        return res.status(400).json({ message: "Stripe Connect account not set up" });
      }
      const stripeService = StripeService.fromEnvironment();
      if (!stripeService) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }
      const url = await stripeService.createConnectLoginLink(business.stripeAccountId);
      res.json({ url });
    } catch (error) {
      next(error);
    }
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
