import { InsertJobUpdate, JobUpdate } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class JobUpdateRepository {
  constructor(private readonly store: IStorage = storage) {}

  findByJob(jobId: number): Promise<JobUpdate[]> {
    return this.store.getJobUpdates(jobId);
  }

  findPublicByJob(jobId: number): Promise<JobUpdate[]> {
    return this.store.getPublicJobUpdates(jobId);
  }

  create(data: InsertJobUpdate): Promise<JobUpdate> {
    return this.store.createJobUpdate(data);
  }
}

export const jobUpdateRepository = new JobUpdateRepository();
