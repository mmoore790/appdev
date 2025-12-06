import { InsertWorkCompleted } from "@shared/schema";
import { workCompletedRepository } from "../../repositories";
import { jobService } from "./jobService";

class WorkCompletedService {
  listByJob(jobId: number, businessId: number) {
    return workCompletedRepository.findByJob(jobId, businessId);
  }

  async createWorkEntry(data: InsertWorkCompleted) {
    const normalised = this.normaliseWorkData(data);
    const workEntry = await workCompletedRepository.create(normalised);
    
    // Update job's updatedAt timestamp
    if (workEntry.jobId) {
      await jobService.touchJob(workEntry.jobId, workEntry.businessId);
    }
    
    return workEntry;
  }

  async updateWorkEntry(id: number, data: Partial<InsertWorkCompleted>, businessId: number) {
    const normalised = this.normaliseWorkData(data);
    const updated = await workCompletedRepository.update(id, normalised, businessId);
    
    // Update job's updatedAt timestamp if work entry has a jobId
    // The updated entry should contain the jobId
    if (updated && (updated as any).jobId) {
      await jobService.touchJob((updated as any).jobId, businessId);
    } else if (data.jobId) {
      // Fallback to data.jobId if updated doesn't have it
      await jobService.touchJob(data.jobId, businessId);
    }
    
    return updated;
  }

  deleteWorkEntry(id: number, businessId: number) {
    return workCompletedRepository.delete(id, businessId);
  }

  private normaliseWorkData<T extends Partial<InsertWorkCompleted>>(data: T): T {
    const normalised = { ...data };

    if (normalised.laborHours != null) {
      const hours = typeof normalised.laborHours === "string"
        ? parseFloat(normalised.laborHours)
        : Number(normalised.laborHours);
      if (!Number.isNaN(hours)) {
        (normalised as any).laborHours = Math.round(hours * 60);
      }
    }

    if (normalised.partsCost != null) {
      const cost = typeof normalised.partsCost === "string"
        ? parseFloat(normalised.partsCost)
        : Number(normalised.partsCost);
      if (!Number.isNaN(cost)) {
        (normalised as any).partsCost = Math.round(cost * 100);
      }
    }

    return normalised;
  }
}

export const workCompletedService = new WorkCompletedService();
