import { InsertCallbackRequest } from "@shared/schema";
import { callbackRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { notificationService } from "../notificationService";

interface CallbackFilters {
  assignedTo?: number;
  customerId?: number;
  status?: "pending" | "completed";
  fromDate?: Date;
  toDate?: Date;
}

class CallbackService {
  /**
   * List all callbacks for a business.
   * 
   * IMPORTANT: All users within the same business can see ALL callbacks for that business.
   * This ensures transparency across the business. The assignedTo filter is optional and
   * only used for UI filtering purposes - it does not restrict data access.
   * 
   * @param businessId - The business ID (all callbacks for this business are returned)
   * @param filters - Optional filters for UI purposes (assignedTo, customerId, status, dates)
   * @returns All callbacks for the business, optionally filtered
   */
  async listCallbacks(businessId: number, filters: CallbackFilters = {}) {
    let callbacks;

    if (filters.assignedTo != null) {
      // Filter by assignee (still scoped to businessId for security)
      callbacks = await callbackRepository.findByAssignee(filters.assignedTo, businessId);
    } else if (filters.customerId != null) {
      callbacks = await callbackRepository.findByCustomer(filters.customerId, businessId);
    } else if (filters.status === "pending") {
      callbacks = await callbackRepository.findPending(businessId);
    } else if (filters.status === "completed") {
      callbacks = await callbackRepository.findCompleted(businessId);
    } else {
      // Return ALL callbacks for the business - all users can see all callbacks
      callbacks = await callbackRepository.findAll(businessId);
    }

    if (filters.fromDate && filters.toDate) {
      const from = filters.fromDate;
      const to = filters.toDate;

      callbacks = callbacks.filter((callback: any) => {
        const requestedAt = new Date(callback.requestedAt);
        return requestedAt >= from && requestedAt <= to;
      });
    }

    return callbacks;
  }

  listDeletedCallbacks(businessId: number) {
    return callbackRepository.findDeleted(businessId);
  }

  getCallbackById(id: number, businessId: number) {
    return callbackRepository.findById(id, businessId);
  }

  async createCallback(data: InsertCallbackRequest, actorUserId?: number) {
    const callback = await callbackRepository.create(data);

    await logActivity({
      businessId: callback.businessId,
      userId: actorUserId ?? null,
      activityType: "callback_created",
      description: getActivityDescription("callback_created", "callback", callback.id, {
        customerName: callback.customerName,
        phone: callback.phoneNumber,
        reason: callback.subject,
        details: callback.details,
        requestedTime: callback.requestedAt,
      }),
      entityType: "callback",
      entityId: callback.id,
      metadata: {
        customerName: callback.customerName,
        phone: callback.phoneNumber,
        reason: callback.subject,
        details: callback.details,
        requestedTime: callback.requestedAt,
      },
    });

    // Create notification if callback is assigned
    if (callback.assignedTo) {
      try {
        await notificationService.notifyCallbackAssignment(
          callback.id,
          callback.customerName,
          callback.subject,
          callback.assignedTo,
          callback.businessId,
          callback.priority
        );
      } catch (error) {
        console.error("Error creating callback assignment notification:", error);
      }
    }

    return callback;
  }

  async updateCallback(id: number, data: Partial<InsertCallbackRequest>, businessId: number) {
    const currentCallback = await callbackRepository.findById(id, businessId);
    if (!currentCallback) {
      return undefined;
    }

    // Check if assignment changed
    const assignmentChanged = data.assignedTo !== undefined && data.assignedTo !== currentCallback.assignedTo;

    const updatedCallback = await callbackRepository.update(id, data as any, businessId);
    if (!updatedCallback) {
      return undefined;
    }

    // Create notification if assignment changed
    if (assignmentChanged) {
      try {
        await notificationService.notifyCallbackReassignment(
          updatedCallback.id,
          updatedCallback.customerName,
          updatedCallback.subject,
          currentCallback.assignedTo,
          updatedCallback.assignedTo || null,
          businessId,
          updatedCallback.priority
        );
      } catch (error) {
        console.error("Error creating callback reassignment notification:", error);
      }
    }

    return updatedCallback;
  }

  async completeCallback(id: number, businessId: number, notes: string | undefined, actorUserId?: number) {
    const callback = await callbackRepository.complete(id, businessId, notes);
    if (!callback) {
      return undefined;
    }

    await logActivity({
      businessId: businessId,
      userId: actorUserId ?? null,
      activityType: "callback_completed",
      description: getActivityDescription("callback_completed", "callback", callback.id, {
        customerName: callback.customerName,
        phone: callback.phoneNumber,
        completionNotes: notes,
        completionTime: new Date().toISOString(),
      }),
      entityType: "callback",
      entityId: callback.id,
      metadata: {
        customerName: callback.customerName,
        phone: callback.phoneNumber,
        completionNotes: notes,
        completionTime: new Date().toISOString(),
      },
    });

    return callback;
  }

  softDeleteCallback(id: number, businessId: number) {
    return callbackRepository.softDelete(id, businessId);
  }

  restoreCallback(id: number, businessId: number) {
    return callbackRepository.restore(id, businessId);
  }

  permanentlyDeleteCallback(id: number, businessId: number) {
    return callbackRepository.hardDelete(id, businessId);
  }

  purgeExpiredDeletedCallbacks(businessId: number) {
    return callbackRepository.purgeExpired(businessId);
  }
}

export const callbackService = new CallbackService();
