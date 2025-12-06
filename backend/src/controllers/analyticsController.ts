import { Router, Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/domains/analyticsService";
import { pdfService } from "../services/pdfService";
import { isAuthenticated, isAdmin } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";

export class AnalyticsController {
  public readonly router = Router();

  constructor() {
    this.router.get("/summary", isAuthenticated, this.getSummary);
    this.router.get("/callbacks", isAuthenticated, isAdmin, this.getCallbackAnalytics);
    this.router.get("/callbacks/report", isAuthenticated, isAdmin, this.getCallbackReport);
  }

  private async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = (req.session as any).userId;
      const summary = await analyticsService.getSummary(userId, businessId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }

  private async getCallbackAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;

      console.log("[Analytics] Fetching callback analytics", { fromDate, toDate, businessId });
      const analytics = await analyticsService.getCallbackAnalytics(businessId, {
        fromDate,
        toDate,
      });
      console.log("[Analytics] Callback analytics fetched", {
        totalCallbacks: analytics.summary?.totalCallbacks,
        staffCount: analytics.staffPerformance?.length,
      });
      res.json(analytics);
    } catch (error) {
      console.error("[Analytics] Error fetching callback analytics:", error);
      next(error);
    }
  }

  private async getCallbackReport(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;

      const pdfBuffer = await pdfService.generateCallbackReport(businessId, {
        fromDate,
        toDate,
      });

      const dateRange = fromDate && toDate
        ? `${fromDate.toISOString().split("T")[0]}_to_${toDate.toISOString().split("T")[0]}`
        : "all_time";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="callback-report-${dateRange}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
