import { InsertTask, Task } from "@shared/schema";
import { taskRepository, userRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { notificationService } from "../notificationService";

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
  /**
   * List all tasks for a business.
   * 
   * IMPORTANT: All users within the same business can see ALL tasks for that business.
   * This ensures transparency across the business. The assignedTo filter is optional and
   * only used for UI filtering purposes - it does not restrict data access.
   * 
   * @param businessId - The business ID (all tasks for this business are returned)
   * @param filter - Optional filters for UI purposes (assignedTo, pendingOnly)
   * @returns All tasks for the business, optionally filtered
   */
  async listTasks(businessId: number, filter?: { assignedTo?: number; pendingOnly?: boolean }) {
    if (filter?.assignedTo != null) {
      // Filter by assignee (still scoped to businessId for security)
      return taskRepository.findByAssignee(filter.assignedTo, businessId);
    }
    if (filter?.pendingOnly) {
      return taskRepository.findPending(businessId);
    }
    // Return ALL tasks for the business - all users can see all tasks
    return taskRepository.findAll(businessId);
  }

  getTaskById(id: number, businessId: number) {
    return taskRepository.findById(id, businessId);
  }

  async createTask(data: InsertTask, actorUserId?: number) {
    const status = data.status ? normalizeTaskStatus(data.status) : "pending";
    const task = await taskRepository.create({ ...data, status });

    let assignedToName = "";
    if (task.assignedTo) {
      try {
        const assignedUser = await userRepository.findById(task.assignedTo, task.businessId);
        if (assignedUser) {
          assignedToName = assignedUser.fullName || assignedUser.username;
        }
      } catch (error) {
        console.error("Error fetching assigned user for task activity log:", error);
      }
    }

    await logActivity({
      businessId: task.businessId,
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

    // Create notification if task is assigned
    if (task.assignedTo) {
      try {
        await notificationService.notifyTaskAssignment(
          task.id,
          task.title,
          task.assignedTo,
          task.businessId,
          task.priority,
          task.dueDate || undefined
        );
      } catch (error) {
        console.error("Error creating task assignment notification:", error);
      }
    }

    return task;
  }

  async updateTask(id: number, data: Partial<Task>, businessId: number, actorUserId?: number) {
    const currentTask = await taskRepository.findById(id, businessId);
    if (!currentTask) {
      return undefined;
    }

    // Check if assignment changed
    const assignmentChanged = data.assignedTo !== undefined && data.assignedTo !== currentTask.assignedTo;

    const preparedUpdate = this.prepareTaskUpdate(data, currentTask);
    if (Object.keys(preparedUpdate).length === 0) {
      // Nothing meaningful to update
      return currentTask;
    }

    const updatedTask = await taskRepository.update(id, preparedUpdate, businessId);
    if (!updatedTask) {
      return undefined;
    }

    // Create notification if assignment changed
    if (assignmentChanged) {
      try {
        await notificationService.notifyTaskReassignment(
          updatedTask.id,
          updatedTask.title,
          currentTask.assignedTo,
          updatedTask.assignedTo || null,
          businessId,
          updatedTask.priority,
          updatedTask.dueDate || undefined
        );
      } catch (error) {
        console.error("Error creating task reassignment notification:", error);
      }
    }

    // Log key changes
    if (currentTask.status !== "completed" && updatedTask.status === "completed") {
      await logActivity({
        businessId: businessId,
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
        businessId: businessId,
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

