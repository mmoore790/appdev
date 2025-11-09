import { Router, Request, Response, NextFunction } from "express";
import { insertJobSchema } from "@shared/schema";
import { jobService } from "../services/domains/jobService";
import { isAuthenticated } from "../auth";
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
      const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
      const assignedTo = req.query.assignedTo ? Number(req.query.assignedTo) : undefined;
      const jobs = await jobService.listJobs({ customerId, assignedTo });
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

      const identifier = req.params.id;
      const numericId = Number(identifier);

      let job = Number.isNaN(numericId)
        ? await jobService.getJobByJobCode(identifier)
        : await jobService.getJobById(numericId);

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
      const payload = insertJobSchema.parse(req.body);
      const actorId = (req.session as any)?.userId ?? undefined;
      const job = await jobService.createJob(payload, actorId);
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
      const id = Number(req.params.id);
      const actorId = (req.session as any)?.userId ?? undefined;
      const updated = await jobService.updateJob(id, req.body, actorId);

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
      const id = Number(req.params.id);
      const actorId = (req.session as any)?.userId ?? undefined;
      const deleted = await jobService.deleteJob(id, actorId);

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

  private async generateJobId(_req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = await jobService.generateNextJobId();
      res.json({ jobId });
    } catch (error) {
      next(error);
    }
  }

  private async getPublicJobTracker(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId, email } = req.query;

      if (!jobId || !email) {
        return res.status(400).json({ message: "Job ID and email are required" });
      }

      const result = await jobService.getPublicJobTracker(
        String(jobId),
        String(email)
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
