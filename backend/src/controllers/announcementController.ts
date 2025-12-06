import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { isMaster } from "../auth";
import { logActivity } from "../services/activityService";

export class AnnouncementController {
  public readonly router = Router();

  constructor() {
    // Public endpoint for login page / marketing surfaces
    this.router.get("/public", this.getPublicAnnouncements);

    // Master-only management endpoints
    this.router.use(isMaster);
    this.router.get("/", this.getAllAnnouncements);
    this.router.post("/", this.createAnnouncement);
    this.router.put("/:id", this.updateAnnouncement);
    this.router.delete("/:id", this.deleteAnnouncement);
  }

  private async getPublicAnnouncements(req: Request, res: Response, next: NextFunction) {
    try {
      const audience = (req.query.audience as string) || "login";
      const announcements = await storage.getActiveAnnouncements(audience);
      res.json(announcements);
    } catch (error) {
      next(error);
    }
  }

  private async getAllAnnouncements(_req: Request, res: Response, next: NextFunction) {
    try {
      const announcements = await storage.getAnnouncements(true);
      res.json(announcements);
    } catch (error) {
      next(error);
    }
  }

  private async createAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, message, priority, audience, ctaText, ctaUrl, displayStart, displayEnd, isActive } = req.body;

      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;

      const announcement = await storage.createAnnouncement({
        title,
        message,
        priority: priority || "info",
        audience: audience || "login",
        ctaText,
        ctaUrl,
        displayStart,
        displayEnd,
        isActive: isActive ?? true,
        createdBy: userId,
      });

      if (userId && businessId) {
        await logActivity({
          businessId,
          userId,
          activityType: "master_create_announcement",
          description: `Created announcement: ${title}`,
          entityType: "announcement",
          entityId: announcement.id,
          metadata: { priority: announcement.priority, audience: announcement.audience },
        });
      }

      res.status(201).json(announcement);
    } catch (error) {
      next(error);
    }
  }

  private async updateAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const announcement = await storage.updateAnnouncement(id, {
        ...req.body,
      });

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;

      if (userId && businessId) {
        await logActivity({
          businessId,
          userId,
          activityType: "master_update_announcement",
          description: `Updated announcement: ${announcement.title}`,
          entityType: "announcement",
          entityId: announcement.id,
          metadata: { changes: req.body },
        });
      }

      res.json(announcement);
    } catch (error) {
      next(error);
    }
  }

  private async deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const deleted = await storage.deleteAnnouncement(id);

      if (!deleted) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      const userId = (req.session as any).userId;
      const businessId = (req.session as any).businessId;

      if (userId && businessId) {
        await logActivity({
          businessId,
          userId,
          activityType: "master_delete_announcement",
          description: `Deactivated announcement id ${id}`,
          entityType: "announcement",
          entityId: id,
        });
      }

      res.json({ message: "Announcement deactivated successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const announcementController = new AnnouncementController();

