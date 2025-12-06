import { Router, Request, Response, NextFunction } from "express";
import { getRecentActivities, cleanupOldActivities } from "../services/activityService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";

export class ActivityController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listActivities);
  }

  private async listActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const activities = await getRecentActivities(businessId, limit);
      await cleanupOldActivities(50);
      res.json(activities);
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
