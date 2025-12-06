import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { schedulerService } from "../services/schedulerService";

export class ReportController {
  public readonly router = Router();

  constructor() {
    this.router.post(
      "/callbacks/weekly",
      isAuthenticated,
      isAdmin,
      this.triggerWeeklyCallbackReport
    );
  }

  private async triggerWeeklyCallbackReport(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const success = await schedulerService.triggerWeeklyCallbackReport(businessId);
      if (success) {
        res.json({
          message: "Weekly callback report sent successfully",
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          message: "Failed to send weekly callback report",
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
