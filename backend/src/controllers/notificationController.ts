import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "../utils/requestHelpers";
import { notificationRepository } from "../repositories/notificationRepository";
import { formatDistanceToNow } from "date-fns";

export class NotificationController {
  public readonly router = Router();

  constructor() {
    this.router.use(isAuthenticated);
    this.router.get("/", this.getNotifications);
    this.router.post("/:id/read", this.markAsRead);
    this.router.post("/read-all", this.markAllAsRead);
    this.router.delete("/", this.deleteAll); // Must come before /:id route
    this.router.delete("/:id", this.deleteNotification);
  }

  private async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const unreadOnly = req.query.unreadOnly === "true";

      // Get notifications from database
      const notifications = await notificationRepository.findByUser(userId, businessId, unreadOnly);

      // Add relative time and format
      const enrichedNotifications = notifications.slice(0, 50).map(notif => ({
        id: `notification-${notif.id}`,
        type: notif.type,
        title: notif.title,
        description: notif.description || "",
        link: notif.link || this.getDefaultLink(notif.type, notif.entityId),
        timestamp: notif.createdAt,
        priority: notif.priority as "high" | "normal",
        icon: notif.type,
        entityId: notif.entityId,
        isRead: notif.isRead,
        relativeTime: formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }),
      }));

      // Count unread
      const unreadCount = notifications.filter(n => !n.isRead).length;

      res.json({
        notifications: enrichedNotifications,
        unreadCount,
        totalCount: notifications.length,
      });
    } catch (error) {
      next(error);
    }
  }

  private getDefaultLink(type: string, entityId: number): string {
    switch (type) {
      case "job":
        return `/workshop/jobs/${entityId}`;
      case "callback":
        return `/callbacks`;
      case "task":
        return `/tasks`;
      case "calendar":
        return `/calendar`;
      case "message":
        return `/messages`;
      default:
        return `/dashboard`;
    }
  }

  private async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const notification = await notificationRepository.markAsRead(id, businessId, userId);

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      next(error);
    }
  }

  private async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);

      const count = await notificationRepository.markAllAsRead(userId, businessId);

      res.json({ success: true, message: "All notifications marked as read", count });
    } catch (error) {
      next(error);
    }
  }

  private async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const deleted = await notificationRepository.delete(id, businessId, userId);

      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      next(error);
    }
  }

  private async deleteAll(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);

      const count = await notificationRepository.deleteAll(userId, businessId);

      res.json({ success: true, message: "All notifications deleted", count });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();

