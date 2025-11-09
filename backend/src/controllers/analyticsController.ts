import { Router, Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/domains/analyticsService";
import { isAuthenticated } from "../auth";

export class AnalyticsController {
  public readonly router = Router();

  constructor() {
    this.router.get("/summary", isAuthenticated, this.getSummary);
  }

  private async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req.session as any).userId;
      const summary = await analyticsService.getSummary(userId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
