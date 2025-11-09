import { InsertTask, Task } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class TaskRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(): Promise<Task[]> {
    return this.store.getAllTasks();
  }

  findPending(): Promise<Task[]> {
    return this.store.getPendingTasks();
  }

  findById(id: number): Promise<Task | undefined> {
    return this.store.getTask(id);
  }

  findByAssignee(assigneeId: number): Promise<Task[]> {
    return this.store.getTasksByAssignee(assigneeId);
  }

  create(data: InsertTask): Promise<Task> {
    return this.store.createTask(data);
  }

  update(id: number, data: Partial<Task>): Promise<Task | undefined> {
    return this.store.updateTask(id, data);
  }

  complete(id: number): Promise<Task | undefined> {
    return this.store.completeTask(id);
  }
}

export const taskRepository = new TaskRepository();
