import { InsertCallbackRequest } from "@shared/schema";
import { callbackRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

interface CallbackFilters {
  assignedTo?: number;
  customerId?: number;
  status?: "pending" | "completed";
  fromDate?: Date;
  toDate?: Date;
}

class CallbackService {
  async listCallbacks(filters: CallbackFilters = {}) {
    let callbacks;

    if (filters.assignedTo != null) {
      callbacks = await callbackRepository.findByAssignee(filters.assignedTo);
    } else if (filters.customerId != null) {
      callbacks = await callbackRepository.findByCustomer(filters.customerId);
    } else if (filters.status === "pending") {
      callbacks = await callbackRepository.findPending();
    } else if (filters.status === "completed") {
      callbacks = await callbackRepository.findCompleted();
    } else {
      callbacks = await callbackRepository.findAll();
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

  listDeletedCallbacks() {
    return callbackRepository.findDeleted();
  }

  getCallbackById(id: number) {
    return callbackRepository.findById(id);
  }

  async createCallback(data: InsertCallbackRequest, actorUserId?: number) {
    const callback = await callbackRepository.create(data);

    await logActivity({
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

    return callback;
  }

  updateCallback(id: number, data: Partial<InsertCallbackRequest>) {
    return callbackRepository.update(id, data as any);
  }

  async completeCallback(id: number, notes: string | undefined, actorUserId?: number) {
    const callback = await callbackRepository.complete(id, notes);
    if (!callback) {
      return undefined;
    }

    await logActivity({
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

  softDeleteCallback(id: number) {
    return callbackRepository.softDelete(id);
  }

  restoreCallback(id: number) {
    return callbackRepository.restore(id);
  }

  permanentlyDeleteCallback(id: number) {
    return callbackRepository.hardDelete(id);
  }

  purgeExpiredDeletedCallbacks() {
    return callbackRepository.purgeExpired();
  }
}

export const callbackService = new CallbackService();
