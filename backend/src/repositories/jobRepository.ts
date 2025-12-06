import { InsertJob, Job } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class JobRepository {
  constructor(private readonly store: IStorage = storage) {}

  generateNextJobId(businessId: number): Promise<string> {
    return this.store.generateNextJobId(businessId);
  }

  findById(id: number, businessId: number): Promise<Job | undefined> {
    return this.store.getJob(id, businessId);
  }

  findAll(businessId: number): Promise<Job[]> {
    return this.store.getAllJobs(businessId);
  }

  findActive(businessId: number): Promise<Job[]> {
    return this.store.getActiveJobs(businessId);
  }

  create(data: InsertJob): Promise<Job> {
    return this.store.createJob(data);
  }

  update(id: number, data: Partial<Job>, businessId: number): Promise<Job | undefined> {
    return this.store.updateJob(id, data, businessId);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteJob(id, businessId);
  }
}

export const jobRepository = new JobRepository();
