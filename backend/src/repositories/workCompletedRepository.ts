import { InsertWorkCompleted, WorkCompleted } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class WorkCompletedRepository {
  constructor(private readonly store: IStorage = storage) {}

  findByJob(jobId: number): Promise<WorkCompleted[]> {
    return this.store.getWorkCompletedByJobId(jobId);
  }

  create(data: InsertWorkCompleted): Promise<WorkCompleted> {
    return this.store.createWorkCompleted(data);
  }

  update(id: number, data: Partial<InsertWorkCompleted>): Promise<WorkCompleted | undefined> {
    return this.store.updateWorkCompleted(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.store.deleteWorkCompleted(id);
  }
}

export const workCompletedRepository = new WorkCompletedRepository();
