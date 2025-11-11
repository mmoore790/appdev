import { InsertPartOnOrder } from "@shared/schema";
import {
  partOrderRepository,
  partOrderUpdateRepository,
} from "../../repositories";
import { sendPartReadyEmail } from "../emailService";

class PartOrderService {
  listPartOrders() {
    return partOrderRepository.findAll();
  }

  listPartOrdersByJob(jobId: number) {
    return partOrderRepository.findByJob(jobId);
  }

  listOverduePartOrders(daysSinceOrder?: number) {
    return partOrderRepository.findOverdue(daysSinceOrder);
  }

  getPartOrderById(id: number) {
    return partOrderRepository.findById(id);
  }

  createPartOrder(data: InsertPartOnOrder) {
    return partOrderRepository.create(data);
  }

  updatePartOrder(id: number, data: Partial<InsertPartOnOrder>) {
    return partOrderRepository.update(id, data as any);
  }

  markPartAsArrived(
    id: number,
    userId: number,
    options: { actualDeliveryDate?: string; actualCost?: number; notes?: string }
  ) {
    const { actualDeliveryDate, actualCost, notes } = options;
    return partOrderRepository.markArrived(
      id,
      userId,
      actualDeliveryDate,
      actualCost,
      notes
    );
  }

  markPartAsCollected(id: number, userId: number) {
    return partOrderRepository.markCollected(id, userId);
  }

  async notifyCustomerPartReady(id: number, userId: number) {
    const part = await partOrderRepository.findById(id);
    if (!part) {
      return { success: false, reason: "not_found" as const };
    }

    if (!part.isArrived) {
      return { success: false, reason: "not_arrived" as const };
    }

    if (!part.customerEmail) {
      return { success: false, reason: "missing_email" as const };
    }

    try {
      await sendPartReadyEmail(part);
    } catch (error) {
      console.error("Error sending customer notification email:", error);
      // continue even if email fails
    }

    const success = await partOrderRepository.notifyCustomer(id, userId);
    return { success, reason: success ? undefined : ("not_found" as const) };
  }

  listPartOrderUpdates(partOrderId: number) {
    return partOrderUpdateRepository.findByPart(partOrderId);
  }
}

export const partOrderService = new PartOrderService();
