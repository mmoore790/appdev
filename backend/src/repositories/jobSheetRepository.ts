import { InsertLabourEntry, LabourEntry, InsertPartUsed, PartUsed, InsertJobNote, JobNote, InsertJobAttachment, JobAttachment } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class JobSheetRepository {
  constructor(private readonly store: IStorage = storage) {}

  // Labour Entries
  findLabourEntriesByJob(jobId: number, businessId: number): Promise<LabourEntry[]> {
    return this.store.getLabourEntriesByJobId(jobId, businessId);
  }

  createLabourEntry(data: InsertLabourEntry): Promise<LabourEntry> {
    return this.store.createLabourEntry(data);
  }

  updateLabourEntry(id: number, data: Partial<InsertLabourEntry>, businessId: number): Promise<LabourEntry | undefined> {
    return this.store.updateLabourEntry(id, data, businessId);
  }

  deleteLabourEntry(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteLabourEntry(id, businessId);
  }

  // Parts Used
  findPartsUsedByJob(jobId: number, businessId: number): Promise<PartUsed[]> {
    return this.store.getPartsUsedByJobId(jobId, businessId);
  }

  createPartUsed(data: InsertPartUsed): Promise<PartUsed> {
    return this.store.createPartUsed(data);
  }

  updatePartUsed(id: number, data: Partial<InsertPartUsed>, businessId: number): Promise<PartUsed | undefined> {
    return this.store.updatePartUsed(id, data, businessId);
  }

  deletePartUsed(id: number, businessId: number): Promise<boolean> {
    return this.store.deletePartUsed(id, businessId);
  }

  // Job Notes
  findJobNoteByJob(jobId: number, businessId: number): Promise<JobNote | undefined> {
    return this.store.getJobNoteByJobId(jobId, businessId);
  }

  createOrUpdateJobNote(data: InsertJobNote): Promise<JobNote> {
    return this.store.createOrUpdateJobNote(data);
  }

  deleteJobNote(jobId: number, businessId: number): Promise<boolean> {
    return this.store.deleteJobNote(jobId, businessId);
  }

  // Job Attachments
  findJobAttachmentsByJob(jobId: number, businessId: number): Promise<JobAttachment[]> {
    return this.store.getJobAttachmentsByJobId(jobId, businessId);
  }

  createJobAttachment(data: InsertJobAttachment): Promise<JobAttachment> {
    return this.store.createJobAttachment(data);
  }

  deleteJobAttachment(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteJobAttachment(id, businessId);
  }
}

export const jobSheetRepository = new JobSheetRepository();






