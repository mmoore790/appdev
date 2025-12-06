import { InsertTimeEntry, TimeEntry } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class TimeEntryRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    return this.store.getAllTimeEntries(businessId, startDate, endDate);
  }

  findById(id: number, businessId: number): Promise<TimeEntry | undefined> {
    return this.store.getTimeEntry(id, businessId);
  }

  findByUser(userId: number, businessId: number, startDate?: string, endDate?: string): Promise<TimeEntry[]> {
    return this.store.getTimeEntriesByUser(userId, businessId, startDate, endDate);
  }

  findByJob(jobId: number, businessId: number): Promise<TimeEntry[]> {
    return this.store.getTimeEntriesByJob(jobId, businessId);
  }

  create(data: InsertTimeEntry): Promise<TimeEntry> {
    return this.store.createTimeEntry(data);
  }

  update(id: number, data: Partial<InsertTimeEntry>, businessId: number): Promise<TimeEntry | undefined> {
    return this.store.updateTimeEntry(id, data, businessId);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteTimeEntry(id, businessId);
  }
}

export const timeEntryRepository = new TimeEntryRepository();

