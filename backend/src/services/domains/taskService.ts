import { InsertTask, Task } from "@shared/schema";
import { taskRepository, userRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

const TASK_STATUS_VALUES = [
  "pending",
  "in_progress",
  "review",
  "completed",
  "archived",
  "deleted"
] as const;

type BoardTaskStatus = (typeof TASK_STATUS_VALUES)[number];

const TASK_STATUS_SET = new Set<string>(TASK_STATUS_VALUES);

const STATUS_ALIASES: Record<string, BoardTaskStatus> = {
  todo: "pending",
  to_do: "pending",
  backlog: "pending",
  "in-progress": "in_progress",
  inprogress: "in_progress",
  reviewing: "review",
  review_pending: "review",
  done: "completed",
  complete: "completed",
  finished: "completed"
};

export class InvalidTaskStatusError extends Error {
  constructor(status: unknown) {
    super(`Unsupported task status: ${String(status)}`);
    this.name = "InvalidTaskStatusError";
  }
}

const normalizeTaskStatus = (status: unknown): BoardTaskStatus => {
  if (typeof status !== "string") {
    throw new InvalidTaskStatusError(status);
  }

  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (TASK_STATUS_SET.has(normalized)) {
    return normalized as BoardTaskStatus;
  }

  const alias = STATUS_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  throw new InvalidTaskStatusError(status);
};

export class TaskService {
  async listTasks(filter?: { assignedTo?: number; pendingOnly?: boolean }) {
    if (filter?.assignedTo != null) {
      return taskRepository.findByAssignee(filter.assignedTo);
    }
    if (filter?.pendingOnly) {
      return taskRepository.findPending();
    }
    return taskRepository.findAll();
  }

  getTaskById(id: number) {
    return taskRepository.findById(id);
  }

  async createTask(data: InsertTask, actorUserId?: number) {
    const status = data.status ? normalizeTaskStatus(data.status) : "pending";
    const task = await taskRepository.create({ ...data, status });

    let assignedToName = "";
    if (task.assignedTo) {
      try {
        const assignedUser = await userRepository.findById(task.assignedTo);
        if (assignedUser) {
          assignedToName = assignedUser.fullName || assignedUser.username;
        }
      } catch (error) {
        console.error("Error fetching assigned user for task activity log:", error);
      }
    }

    await logActivity({
      userId: actorUserId ?? null,
      activityType: "task_created",
      description: getActivityDescription("task_created", "task", task.id, {
        taskTitle: task.title,
        assignedTo: task.assignedTo,
        assignedToName,
        priority: task.priority
      }),
      entityType: "task",
      entityId: task.id,
      metadata: {
        taskTitle: task.title,
        assignedTo: task.assignedTo,
        assignedToName,
        priority: task.priority,
        dueDate: task.dueDate
      }
    });

    return task;
  }

  async updateTask(id: number, data: Partial<Task>, actorUserId?: number) {
    const currentTask = await taskRepository.findById(id);
    if (!currentTask) {
      return undefined;
    }

    const preparedUpdate = this.prepareTaskUpdate(data, currentTask);
    if (Object.keys(preparedUpdate).length === 0) {
      // Nothing meaningful to update
      return currentTask;
    }

    const updatedTask = await taskRepository.update(id, preparedUpdate);
    if (!updatedTask) {
      return undefined;
    }

    // Log key changes
    if (currentTask.status !== "completed" && updatedTask.status === "completed") {
      await logActivity({
        userId: actorUserId ?? null,
        activityType: "task_completed",
        description: getActivityDescription("task_completed", "task", updatedTask.id, {
          taskTitle: updatedTask.title
        }),
        entityType: "task",
        entityId: updatedTask.id,
        metadata: {
          taskTitle: updatedTask.title,
          completionTime: new Date().toISOString()
        }
      });
    } else if (
      currentTask.status !== updatedTask.status ||
      currentTask.title !== updatedTask.title
    ) {
      await logActivity({
        userId: actorUserId ?? null,
        activityType: "task_updated",
        description: getActivityDescription("task_updated", "task", updatedTask.id, {
          taskTitle: updatedTask.title,
          changes: Object.keys(preparedUpdate).join(", ")
        }),
        entityType: "task",
        entityId: updatedTask.id,
        metadata: {
          taskTitle: updatedTask.title,
          changedFields: Object.keys(preparedUpdate),
          oldStatus: currentTask.status,
          newStatus: updatedTask.status
        }
      });
    }

    return updatedTask;
  }

  /**
   * Ensures we always persist an explicit status update, even if
   * it normalizes to the same string as the existing one.
   */
  private prepareTaskUpdate(data: Partial<Task>, currentTask: Task): Partial<Task> {
    if (!data || Object.keys(data).length === 0) return {};

    const draft: Partial<Task> = { ...data };

    if ("status" in draft) {
      const rawStatus = draft.status;
      if (rawStatus == null) {
        throw new InvalidTaskStatusError(rawStatus);
      }

      const normalizedStatus = normalizeTaskStatus(rawStatus);
      draft.status = normalizedStatus;

      // Handle completion timestamps
      if (normalizedStatus === "completed") {
        if (!draft.completedAt) {
          draft.completedAt = new Date().toISOString();
        }
      } else if (normalizedStatus === "archived") {
        if (draft.completedAt == null && currentTask.completedAt) {
          draft.completedAt = currentTask.completedAt;
        }
      } else {
        draft.completedAt = null;
      }
    }

    // Remove undefined values
    const cleaned = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v !== undefined)
    );

    // ✅ Always persist status when provided, even if unchanged
    if ("status" in draft) {
      cleaned.status = draft.status ?? null; // Default to null if undefined
    }

    return cleaned;
  }
}

export const taskService = new TaskService();

