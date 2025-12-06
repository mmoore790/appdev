import { Activity, InsertActivity } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class ActivityRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number, limit?: number): Promise<Activity[]> {
    return this.store.getAllActivities(businessId, limit);
  }

  findByUser(userId: number, businessId: number, limit?: number): Promise<Activity[]> {
    return this.store.getActivityByUser(userId, businessId, limit);
  }

  findByEntity(entityType: string, entityId: number, businessId: number): Promise<Activity[]> {
    return this.store.getActivityByEntity(entityType, entityId, businessId);
  }

  create(data: InsertActivity): Promise<Activity> {
    return this.store.createActivity(data);
  }

  cleanupOld(limit: number): Promise<void> {
    return this.store.cleanupOldActivities(limit);
  }
}

export const activityRepository = new ActivityRepository();
