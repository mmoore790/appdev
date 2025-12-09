import { InsertOrderItem, OrderItem } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class OrderItemRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number, businessId: number): Promise<OrderItem | undefined> {
    return this.store.getOrderItem(id, businessId);
  }

  findByOrder(orderId: number, businessId: number): Promise<OrderItem[]> {
    return this.store.getOrderItems(orderId, businessId);
  }

  create(data: InsertOrderItem): Promise<OrderItem> {
    return this.store.createOrderItem(data);
  }

  update(id: number, data: Partial<OrderItem>, businessId: number): Promise<OrderItem | undefined> {
    return this.store.updateOrderItem(id, data, businessId);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteOrderItem(id, businessId);
  }

  deleteByOrder(orderId: number, businessId: number): Promise<boolean> {
    return this.store.deleteOrderItemsByOrder(orderId, businessId);
  }
}

export const orderItemRepository = new OrderItemRepository();



