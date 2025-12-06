import { InsertTask, Task } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class TaskRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number): Promise<Task[]> {
    return this.store.getAllTasks(businessId);
  }

  findPending(businessId: number): Promise<Task[]> {
    return this.store.getPendingTasks(businessId);
  }

  findById(id: number, businessId: number): Promise<Task | undefined> {
    return this.store.getTask(id, businessId);
  }

  findByAssignee(assigneeId: number, businessId: number): Promise<Task[]> {
    return this.store.getTasksByAssignee(assigneeId, businessId);
  }

  create(data: InsertTask): Promise<Task> {
    return this.store.createTask(data);
  }

  update(id: number, data: Partial<Task>, businessId: number): Promise<Task | undefined> {
    return this.store.updateTask(id, data, businessId);
  }

  complete(id: number, businessId: number): Promise<Task | undefined> {
    return this.store.completeTask(id, businessId);
  }
}

export const taskRepository = new TaskRepository();
