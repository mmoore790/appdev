import { InsertWorkCompleted, WorkCompleted } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class WorkCompletedRepository {
  constructor(private readonly store: IStorage = storage) {}

  findByJob(jobId: number, businessId: number): Promise<WorkCompleted[]> {
    return this.store.getWorkCompletedByJobId(jobId, businessId);
  }

  create(data: InsertWorkCompleted): Promise<WorkCompleted> {
    return this.store.createWorkCompleted(data);
  }

  update(id: number, data: Partial<InsertWorkCompleted>, businessId: number): Promise<WorkCompleted | undefined> {
    return this.store.updateWorkCompleted(id, data, businessId);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteWorkCompleted(id, businessId);
  }
}

export const workCompletedRepository = new WorkCompletedRepository();
