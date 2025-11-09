import { Activity, InsertActivity } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class ActivityRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(limit?: number): Promise<Activity[]> {
    return this.store.getAllActivities(limit);
  }

  findByUser(userId: number, limit?: number): Promise<Activity[]> {
    return this.store.getActivityByUser(userId, limit);
  }

  findByEntity(entityType: string, entityId: number): Promise<Activity[]> {
    return this.store.getActivityByEntity(entityType, entityId);
  }

  create(data: InsertActivity): Promise<Activity> {
    return this.store.createActivity(data);
  }

  cleanupOld(limit: number): Promise<void> {
    return this.store.cleanupOldActivities(limit);
  }
}

export const activityRepository = new ActivityRepository();
