import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { jobSheetService } from "../services/domains/jobSheetService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "../utils/requestHelpers";
import { uploadPublicFile } from "../services/fileStorageService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export class JobSheetController {
  public readonly router = Router();

  constructor() {
    // Labour Entries
    this.router.get("/:jobId/labour", isAuthenticated, this.listLabourEntries);
    this.router.post("/:jobId/labour", isAuthenticated, this.createLabourEntry);
    this.router.put("/labour/:id", isAuthenticated, this.updateLabourEntry);
    this.router.delete("/labour/:id", isAuthenticated, this.deleteLabourEntry);

    // Parts Used
    this.router.get("/:jobId/parts", isAuthenticated, this.listPartsUsed);
    this.router.post("/:jobId/parts", isAuthenticated, this.createPartUsed);
    this.router.put("/parts/:id", isAuthenticated, this.updatePartUsed);
    this.router.delete("/parts/:id", isAuthenticated, this.deletePartUsed);

    // Job Notes
    this.router.get("/:jobId/notes", isAuthenticated, this.getJobNote);
    this.router.post("/:jobId/notes", isAuthenticated, this.createOrUpdateJobNote);
    this.router.delete("/:jobId/notes", isAuthenticated, this.deleteJobNote);

    // Job Internal Notes (multiple timestamped notes per job)
    this.router.get("/:jobId/internal-notes", isAuthenticated, this.listJobInternalNotes);
    this.router.post("/:jobId/internal-notes", isAuthenticated, this.createJobInternalNote);

    // Job Attachments
    this.router.get("/:jobId/attachments", isAuthenticated, this.listJobAttachments);
    this.router.post("/:jobId/attachments", isAuthenticated, upload.single("file"), this.createJobAttachment);
    this.router.delete("/attachments/:id", isAuthenticated, this.deleteJobAttachment);
  }

  // Labour Entries
  private async listLabourEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const entries = await jobSheetService.listLabourEntries(jobId, businessId);
      res.json(entries);
    } catch (error) {
      next(error);
    }
  }

  private async createLabourEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const data = { ...req.body, businessId, jobId };
      const entry = await jobSheetService.createLabourEntry(data);
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  }

  private async updateLabourEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const entry = await jobSheetService.updateLabourEntry(id, req.body, businessId);

      if (!entry) {
        return res.status(404).json({ message: "Labour entry not found" });
      }

      res.json(entry);
    } catch (error) {
      next(error);
    }
  }

  private async deleteLabourEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const deleted = await jobSheetService.deleteLabourEntry(id, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Labour entry not found" });
      }

      res.json({ message: "Labour entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // Parts Used
  private async listPartsUsed(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const parts = await jobSheetService.listPartsUsed(jobId, businessId);
      res.json(parts);
    } catch (error) {
      next(error);
    }
  }

  private async createPartUsed(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const data = { ...req.body, businessId, jobId };
      const part = await jobSheetService.createPartUsed(data);
      res.status(201).json(part);
    } catch (error) {
      next(error);
    }
  }

  private async updatePartUsed(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const part = await jobSheetService.updatePartUsed(id, req.body, businessId);

      if (!part) {
        return res.status(404).json({ message: "Part used entry not found" });
      }

      res.json(part);
    } catch (error) {
      next(error);
    }
  }

  private async deletePartUsed(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const deleted = await jobSheetService.deletePartUsed(id, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Part used entry not found" });
      }

      res.json({ message: "Part used entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // Job Notes
  private async getJobNote(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const note = await jobSheetService.getJobNote(jobId, businessId);
      res.json(note || null);
    } catch (error) {
      next(error);
    }
  }

  private async createOrUpdateJobNote(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const data = { ...req.body, businessId, jobId };
      const note = await jobSheetService.createOrUpdateJobNote(data);
      res.json(note);
    } catch (error) {
      next(error);
    }
  }

  private async deleteJobNote(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const deleted = await jobSheetService.deleteJobNote(jobId, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Job note not found" });
      }

      res.json({ message: "Job note deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // Job Internal Notes
  private async listJobInternalNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const notes = await jobSheetService.listJobInternalNotes(jobId, businessId);
      res.json(notes);
    } catch (error) {
      next(error);
    }
  }

  private async createJobInternalNote(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const data = { ...req.body, businessId, jobId, userId };
      const note = await jobSheetService.createJobInternalNote(data);
      res.status(201).json(note);
    } catch (error) {
      next(error);
    }
  }

  // Job Attachments
  private async listJobAttachments(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const attachments = await jobSheetService.listJobAttachments(jobId, businessId);
      res.json(attachments);
    } catch (error) {
      next(error);
    }
  }

  private async createJobAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded. Send the file in a multipart field named 'file'." });
      }
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      const uploadedBy = getUserIdFromRequest(req);
      const fileBuffer = Buffer.isBuffer(req.file.buffer) ? req.file.buffer : Buffer.from(req.file.buffer as ArrayBuffer);
      const publicUrl = await uploadPublicFile(fileBuffer, req.file.mimetype, {
        businessId,
        folder: "job-attachments",
        filename: req.file.originalname,
      });
      const data = {
        businessId,
        jobId,
        fileName: req.file.originalname,
        fileUrl: publicUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy,
      };
      const attachment = await jobSheetService.createJobAttachment(data);
      res.status(201).json(attachment);
    } catch (error) {
      next(error);
    }
  }

  private async deleteJobAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const deleted = await jobSheetService.deleteJobAttachment(id, businessId);

      if (!deleted) {
        return res.status(404).json({ message: "Job attachment not found" });
      }

      res.json({ message: "Job attachment deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const jobSheetController = new JobSheetController();








