import { InsertOrderStatusHistory, OrderStatusHistory } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class OrderStatusHistoryRepository {
  constructor(private readonly store: IStorage = storage) {}

  findByOrder(orderId: number, businessId: number): Promise<OrderStatusHistory[]> {
    return this.store.getOrderStatusHistory(orderId, businessId);
  }

  create(data: InsertOrderStatusHistory): Promise<OrderStatusHistory> {
    return this.store.createOrderStatusHistory(data);
  }
}

export const orderStatusHistoryRepository = new OrderStatusHistoryRepository();

