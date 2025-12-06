import { InsertTimeEntry, TimeEntry } from "@shared/schema";
import { timeEntryRepository } from "../../repositories";
import { notificationService } from "../notificationService";

export class TimeEntryService {
  async listTimeEntries(businessId: number, filter?: { userId?: number; jobId?: number; startDate?: string; endDate?: string }) {
    if (filter?.userId != null) {
      return timeEntryRepository.findByUser(filter.userId, businessId, filter.startDate, filter.endDate);
    }
    if (filter?.jobId != null) {
      return timeEntryRepository.findByJob(filter.jobId, businessId);
    }
    return timeEntryRepository.findAll(businessId, filter?.startDate, filter?.endDate);
  }

  getTimeEntryById(id: number, businessId: number) {
    return timeEntryRepository.findById(id, businessId);
  }

  async createTimeEntry(data: InsertTimeEntry) {
    const entry = await timeEntryRepository.create(data);

    // Create notification if calendar entry is assigned to a user (and not created by themselves)
    if (entry.userId && entry.createdBy !== entry.userId) {
      try {
        await notificationService.notifyCalendarAssignment(
          entry.id,
          entry.title,
          entry.userId,
          entry.businessId,
          entry.startTime,
          entry.createdBy || undefined
        );
      } catch (error) {
        console.error("Error creating calendar assignment notification:", error);
      }
    }

    return entry;
  }

  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>, businessId: number) {
    const currentEntry = await timeEntryRepository.findById(id, businessId);
    if (!currentEntry) {
      return undefined;
    }

    const updatedEntry = await timeEntryRepository.update(id, data, businessId);
    if (!updatedEntry) {
      return undefined;
    }

    // If userId changed, notify the new user
    if (data.userId && data.userId !== currentEntry.userId) {
      try {
        await notificationService.notifyCalendarAssignment(
          updatedEntry.id,
          updatedEntry.title,
          updatedEntry.userId,
          businessId,
          updatedEntry.startTime,
          updatedEntry.createdBy || undefined
        );
      } catch (error) {
        console.error("Error creating calendar reassignment notification:", error);
      }
    }

    return updatedEntry;
  }

  async deleteTimeEntry(id: number, businessId: number) {
    return timeEntryRepository.delete(id, businessId);
  }
}

export const timeEntryService = new TimeEntryService();

