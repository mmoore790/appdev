import { Router, Request, Response, NextFunction } from "express";
import { insertJobSchema } from "@shared/schema";
import { jobService } from "../services/domains/jobService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";

export class JobController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listJobs);
    this.router.get("/:id", isAuthenticated, this.getJob);
    this.router.post("/", isAuthenticated, this.createJob);
    this.router.put("/:id", isAuthenticated, this.updateJob);
    this.router.delete("/:id", isAuthenticated, this.deleteJob);
  }

  private async listJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = (req.session as any)?.userId;
      console.log(`[JobController] listJobs - userId: ${userId}, businessId: ${businessId}`);
      
      const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
      const assignedTo = req.query.assignedTo ? Number(req.query.assignedTo) : undefined;
      const jobs = await jobService.listJobs(businessId, { customerId, assignedTo });
      
      console.log(`[JobController] listJobs - Returning ${jobs.length} jobs for businessId: ${businessId}`);
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  }

  private async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      const businessId = getBusinessIdFromRequest(req);
      const identifier = req.params.id;
      const numericId = Number(identifier);

      let job = Number.isNaN(numericId)
        ? await jobService.getJobByJobCode(identifier, businessId)
        : await jobService.getJobById(numericId, businessId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      next(error);
    }
  }

  private async createJob(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      console.log(`[JobController] createJob - businessId from request: ${businessId}, type: ${typeof businessId}`);
      console.log(`[JobController] createJob - req.body:`, JSON.stringify(req.body, null, 2));
      const payload = insertJobSchema.parse({ ...req.body, businessId });
      console.log(`[JobController] createJob - Parsed payload:`, JSON.stringify(payload, null, 2));
      console.log(`[JobController] createJob - businessId in payload: ${(payload as any).businessId}`);
      const actorId = (req.session as any)?.userId ?? undefined;
      const job = await jobService.createJob(payload, actorId);
      console.log(`[JobController] createJob - Created job:`, JSON.stringify({ id: job.id, jobId: job.jobId, businessId: job.businessId }, null, 2));
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid job data",
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  private async updateJob(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const actorId = (req.session as any)?.userId ?? undefined;
      const updated = await jobService.updateJob(id, req.body, businessId, actorId);

      if (!updated) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  private async deleteJob(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      const actorId = (req.session as any)?.userId ?? undefined;
      const deleted = await jobService.deleteJob(id, businessId, actorId);

      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export class JobUtilityController {
  public readonly router = Router();

  constructor() {
    this.router.get("/generate-job-id", this.generateJobId);
    this.router.get("/public/job-tracker", this.getPublicJobTracker);
  }

  private async generateJobId(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = await jobService.generateNextJobId(businessId);
      res.json({ jobId });
    } catch (error) {
      next(error);
    }
  }

  private async getPublicJobTracker(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId, email, businessId: businessIdParam } = req.query;

      if (!jobId || !email) {
        return res.status(400).json({ message: "Job ID and email are required" });
      }

      // For public tracker, businessId should come from query param or we need to search
      // For now, require businessId in query for public access
      if (!businessIdParam) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      const businessId = Number(businessIdParam);
      const result = await jobService.getPublicJobTracker(
        String(jobId),
        String(email),
        businessId
      );

      if (result === null) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (result === undefined) {
        return res.status(403).json({ message: "Email does not match the job record" });
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
export const jobUtilityController = new JobUtilityController();
