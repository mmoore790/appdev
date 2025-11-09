import { InsertJob, Job } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class JobRepository {
  constructor(private readonly store: IStorage = storage) {}

  generateNextJobId(): Promise<string> {
    return this.store.generateNextJobId();
  }

  findById(id: number): Promise<Job | undefined> {
    return this.store.getJob(id);
  }

  findAll(): Promise<Job[]> {
    return this.store.getAllJobs();
  }

  findActive(): Promise<Job[]> {
    return this.store.getActiveJobs();
  }

  create(data: InsertJob): Promise<Job> {
    return this.store.createJob(data);
  }

  update(id: number, data: Partial<Job>): Promise<Job | undefined> {
    return this.store.updateJob(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.store.deleteJob(id);
  }
}

export const jobRepository = new JobRepository();
