import { InsertOrder, Order } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class OrderRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number, businessId: number): Promise<Order | undefined> {
    return this.store.getOrder(id, businessId);
  }

  findByNumber(orderNumber: string, businessId: number): Promise<Order | undefined> {
    return this.store.getOrderByNumber(orderNumber, businessId);
  }

  findAll(businessId: number): Promise<Order[]> {
    return this.store.getAllOrders(businessId);
  }

  findByStatus(status: string, businessId: number): Promise<Order[]> {
    return this.store.getOrdersByStatus(status, businessId);
  }

  findByCustomer(customerId: number, businessId: number): Promise<Order[]> {
    return this.store.getOrdersByCustomer(customerId, businessId);
  }

  findByJob(jobId: number, businessId: number): Promise<Order[]> {
    return this.store.getOrdersByJob(jobId, businessId);
  }

  search(businessId: number, query: string): Promise<Order[]> {
    return this.store.searchOrders(businessId, query);
  }

  create(data: InsertOrder): Promise<Order> {
    return this.store.createOrder(data);
  }

  update(id: number, data: Partial<Order>, businessId: number): Promise<Order | undefined> {
    return this.store.updateOrder(id, data, businessId);
  }

  updateStatus(
    id: number,
    newStatus: string,
    changedBy: number,
    businessId: number,
    changeReason?: string,
    notes?: string,
    metadata?: Record<string, unknown>
  ): Promise<Order | undefined> {
    return this.store.updateOrderStatus(id, newStatus, changedBy, businessId, changeReason, notes, metadata);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteOrder(id, businessId);
  }
}

export const orderRepository = new OrderRepository();

