import { InsertLabourEntry, InsertPartUsed, InsertJobNote, InsertJobAttachment } from "@shared/schema";
import { jobSheetRepository } from "../../repositories";
import { jobService } from "./jobService";

class JobSheetService {
  // Labour Entries
  listLabourEntries(jobId: number, businessId: number) {
    return jobSheetRepository.findLabourEntriesByJob(jobId, businessId);
  }

  async createLabourEntry(data: InsertLabourEntry) {
    const normalised = this.normaliseLabourData(data);
    const entry = await jobSheetRepository.createLabourEntry(normalised);
    
    // Update job's updatedAt timestamp
    if (entry.jobId) {
      await jobService.touchJob(entry.jobId, entry.businessId);
    }
    
    return entry;
  }

  async updateLabourEntry(id: number, data: Partial<InsertLabourEntry>, businessId: number) {
    const normalised = this.normaliseLabourData(data);
    const updated = await jobSheetRepository.updateLabourEntry(id, normalised, businessId);
    
    if (updated?.jobId) {
      await jobService.touchJob(updated.jobId, businessId);
    }
    
    return updated;
  }

  async deleteLabourEntry(id: number, businessId: number) {
    return jobSheetRepository.deleteLabourEntry(id, businessId);
  }

  // Parts Used
  listPartsUsed(jobId: number, businessId: number) {
    return jobSheetRepository.findPartsUsedByJob(jobId, businessId);
  }

  async createPartUsed(data: InsertPartUsed) {
    const normalised = this.normalisePartUsedData(data);
    const part = await jobSheetRepository.createPartUsed(normalised);
    
    if (part.jobId) {
      await jobService.touchJob(part.jobId, part.businessId);
    }
    
    return part;
  }

  async updatePartUsed(id: number, data: Partial<InsertPartUsed>, businessId: number) {
    const normalised = this.normalisePartUsedData(data);
    const updated = await jobSheetRepository.updatePartUsed(id, normalised, businessId);
    
    if (updated?.jobId) {
      await jobService.touchJob(updated.jobId, businessId);
    }
    
    return updated;
  }

  async deletePartUsed(id: number, businessId: number) {
    return jobSheetRepository.deletePartUsed(id, businessId);
  }

  // Job Notes
  getJobNote(jobId: number, businessId: number) {
    return jobSheetRepository.findJobNoteByJob(jobId, businessId);
  }

  async createOrUpdateJobNote(data: InsertJobNote) {
    const note = await jobSheetRepository.createOrUpdateJobNote(data);
    
    if (note.jobId) {
      await jobService.touchJob(note.jobId, note.businessId);
    }
    
    return note;
  }

  async deleteJobNote(jobId: number, businessId: number) {
    return jobSheetRepository.deleteJobNote(jobId, businessId);
  }

  // Job Attachments
  listJobAttachments(jobId: number, businessId: number) {
    return jobSheetRepository.findJobAttachmentsByJob(jobId, businessId);
  }

  async createJobAttachment(data: InsertJobAttachment) {
    const attachment = await jobSheetRepository.createJobAttachment(data);
    
    if (attachment.jobId) {
      await jobService.touchJob(attachment.jobId, attachment.businessId);
    }
    
    return attachment;
  }

  async deleteJobAttachment(id: number, businessId: number) {
    return jobSheetRepository.deleteJobAttachment(id, businessId);
  }

  // Data normalization helpers
  private normaliseLabourData<T extends Partial<InsertLabourEntry>>(data: T): T {
    const normalised = { ...data };

    // Convert time spent (hours or minutes) to minutes
    if (normalised.timeSpent != null) {
      const time = typeof normalised.timeSpent === "string"
        ? parseFloat(normalised.timeSpent)
        : Number(normalised.timeSpent);
      if (!Number.isNaN(time)) {
        // Assume input is in hours if > 10, otherwise minutes
        (normalised as any).timeSpent = time > 10 ? Math.round(time) : Math.round(time * 60);
      }
    }

    // Convert cost to pence (legacy field)
    if (normalised.cost != null) {
      const cost = typeof normalised.cost === "string"
        ? parseFloat(normalised.cost)
        : Number(normalised.cost);
      if (!Number.isNaN(cost)) {
        (normalised as any).cost = Math.round(cost * 100);
      }
    }

    // Convert costExcludingVat to pence
    if (normalised.costExcludingVat != null) {
      const cost = typeof normalised.costExcludingVat === "string"
        ? parseFloat(normalised.costExcludingVat)
        : Number(normalised.costExcludingVat);
      if (!Number.isNaN(cost)) {
        (normalised as any).costExcludingVat = Math.round(cost * 100);
      }
    }

    // Convert costIncludingVat to pence
    if (normalised.costIncludingVat != null) {
      const cost = typeof normalised.costIncludingVat === "string"
        ? parseFloat(normalised.costIncludingVat)
        : Number(normalised.costIncludingVat);
      if (!Number.isNaN(cost)) {
        (normalised as any).costIncludingVat = Math.round(cost * 100);
      }
    }

    return normalised;
  }

  private normalisePartUsedData<T extends Partial<InsertPartUsed>>(data: T): T {
    const normalised = { ...data };

    // Convert cost to pence (legacy field)
    if (normalised.cost != null) {
      const cost = typeof normalised.cost === "string"
        ? parseFloat(normalised.cost)
        : Number(normalised.cost);
      if (!Number.isNaN(cost)) {
        (normalised as any).cost = Math.round(cost * 100);
      }
    }

    // Convert costExcludingVat to pence
    if (normalised.costExcludingVat != null) {
      const cost = typeof normalised.costExcludingVat === "string"
        ? parseFloat(normalised.costExcludingVat)
        : Number(normalised.costExcludingVat);
      if (!Number.isNaN(cost)) {
        (normalised as any).costExcludingVat = Math.round(cost * 100);
      }
    }

    // Convert costIncludingVat to pence
    if (normalised.costIncludingVat != null) {
      const cost = typeof normalised.costIncludingVat === "string"
        ? parseFloat(normalised.costIncludingVat)
        : Number(normalised.costIncludingVat);
      if (!Number.isNaN(cost)) {
        (normalised as any).costIncludingVat = Math.round(cost * 100);
      }
    }

    return normalised;
  }
}

export const jobSheetService = new JobSheetService();
