import { InsertWorkCompleted } from "@shared/schema";
import { workCompletedRepository } from "../../repositories";

class WorkCompletedService {
  listByJob(jobId: number) {
    return workCompletedRepository.findByJob(jobId);
  }

  async createWorkEntry(data: InsertWorkCompleted) {
    const normalised = this.normaliseWorkData(data);
    return workCompletedRepository.create(normalised);
  }

  async updateWorkEntry(id: number, data: Partial<InsertWorkCompleted>) {
    const normalised = this.normaliseWorkData(data);
    return workCompletedRepository.update(id, normalised);
  }

  deleteWorkEntry(id: number) {
    return workCompletedRepository.delete(id);
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
