import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { insertBusinessSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { uploadPublicFile } from "../services/fileStorageService";

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const updateBusinessSchema = insertBusinessSchema.partial();

export class BusinessController {
  public readonly router = Router();

  constructor() {
    this.router.use(isAuthenticated);

    this.router.get("/me", this.getCurrentBusiness);
    this.router.put("/me", this.updateCurrentBusiness);
    this.router.post(
      "/logo",
      upload.single("logo"),
      this.uploadLogoForCurrentBusiness
    );
  }

  private async getCurrentBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const business = await storage.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      res.json(business);
    } catch (error) {
      next(error);
    }
  }

  private async updateCurrentBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const parsed = updateBusinessSchema.parse(req.body) as Record<string, unknown>;
      // Only master dashboard can change subscription and user limit; strip them from business profile updates
      delete parsed.subscriptionTier;
      delete parsed.userLimit;
      const updates = parsed as Parameters<typeof storage.updateBusiness>[1];

      const updated = await storage.updateBusiness(businessId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Business not found" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid business data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async uploadLogoForCurrentBusiness(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);

      if (!req.file) {
        return res.status(400).json({ message: "Logo file is required" });
      }

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      const contentType = req.file.mimetype || "image/png";
      
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ 
          message: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}` 
        });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "File size exceeds 5MB limit" });
      }

      const fileBuffer = req.file.buffer;

      console.log(`Uploading logo for business ${businessId}, size: ${req.file.size} bytes, type: ${contentType}`);

      const logoUrl = await uploadPublicFile(fileBuffer, contentType, {
        businessId,
        folder: "business-logos",
        filename: req.file.originalname,
      });

      console.log(`Logo uploaded successfully, URL: ${logoUrl}`);

      const updated = await storage.updateBusiness(businessId, { logoUrl });
      if (!updated) {
        console.error(`Failed to update business ${businessId} with logoUrl: ${logoUrl}`);
        return res.status(404).json({ message: "Business not found" });
      }

      console.log(`Business ${businessId} updated with logoUrl: ${updated.logoUrl}`);
      res.json({ logoUrl: updated.logoUrl || logoUrl });
    } catch (error: any) {
      console.error("Logo upload error:", error);
      return res.status(500).json({ 
        message: error.message || "Failed to upload logo",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  }
}

export const businessController = new BusinessController();


