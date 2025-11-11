import { InsertPartOnOrder, PartOnOrder } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class PartOrderRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number): Promise<PartOnOrder | undefined> {
    return this.store.getPartOnOrder(id);
  }

  findAll(): Promise<PartOnOrder[]> {
    return this.store.getAllPartsOnOrder();
  }

  findByStatus(status: string): Promise<PartOnOrder[]> {
    return this.store.getPartsOnOrderByStatus(status);
  }

  findOverdue(daysSinceOrder?: number): Promise<PartOnOrder[]> {
    return this.store.getOverduePartsOnOrder(daysSinceOrder);
  }

  findByJob(jobId: number): Promise<PartOnOrder[]> {
    return this.store.getPartsOnOrderByJob(jobId);
  }

  create(data: InsertPartOnOrder): Promise<PartOnOrder> {
    return this.store.createPartOnOrder(data);
  }

  update(id: number, data: Partial<PartOnOrder>): Promise<PartOnOrder | undefined> {
    return this.store.updatePartOnOrder(id, data);
  }

  markArrived(id: number, updatedBy: number, actualDeliveryDate?: string, actualCost?: number, notes?: string) {
    return this.store.markPartAsArrived(id, updatedBy, actualDeliveryDate, actualCost, notes);
  }

  markCollected(id: number, updatedBy: number) {
    return this.store.markPartAsCollected(id, updatedBy);
  }

  notifyCustomer(id: number, updatedBy: number): Promise<boolean> {
    return this.store.notifyCustomerPartReady(id, updatedBy);
  }
}

export const partOrderRepository = new PartOrderRepository();
