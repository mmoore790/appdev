import { InsertTask, Task } from "@shared/schema";
import { taskRepository, userRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

class TaskService {
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
    const task = await taskRepository.create(data);

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
        priority: task.priority,
      }),
      entityType: "task",
      entityId: task.id,
      metadata: {
        taskTitle: task.title,
        assignedTo: task.assignedTo,
        assignedToName,
        priority: task.priority,
        dueDate: task.dueDate,
      },
    });

    return task;
  }

  async updateTask(id: number, data: Partial<Task>, actorUserId?: number) {
    const currentTask = await taskRepository.findById(id);
    if (!currentTask) {
      return undefined;
    }

    const updatedTask = await taskRepository.update(id, data);
    if (!updatedTask) {
      return undefined;
    }

    if (currentTask.status !== "completed" && updatedTask.status === "completed") {
      await logActivity({
        userId: actorUserId ?? null,
        activityType: "task_completed",
        description: getActivityDescription("task_completed", "task", updatedTask.id, {
          taskTitle: updatedTask.title,
        }),
        entityType: "task",
        entityId: updatedTask.id,
        metadata: {
          taskTitle: updatedTask.title,
          completionTime: new Date().toISOString(),
        },
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
          changes: Object.keys(data).join(", "),
        }),
        entityType: "task",
        entityId: updatedTask.id,
        metadata: {
          taskTitle: updatedTask.title,
          changedFields: Object.keys(data),
          oldStatus: currentTask.status,
          newStatus: updatedTask.status,
        },
      });
    }

    return updatedTask;
  }
}

export const taskService = new TaskService();
