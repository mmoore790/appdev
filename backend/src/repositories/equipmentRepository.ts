import { Equipment, InsertEquipment } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class EquipmentRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number): Promise<Equipment[]> {
    return this.store.getAllEquipment(businessId);
  }

  findById(id: number, businessId: number): Promise<Equipment | undefined> {
    return this.store.getEquipment(id, businessId);
  }

  findByCustomer(customerId: number, businessId: number): Promise<Equipment[]> {
    return this.store.getEquipmentByCustomer(customerId, businessId);
  }

  create(data: InsertEquipment): Promise<Equipment> {
    return this.store.createEquipment(data);
  }

  update(id: number, data: InsertEquipment, businessId: number): Promise<Equipment> {
    return this.store.updateEquipment(id, data, businessId);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteEquipment(id, businessId);
  }
}

export const equipmentRepository = new EquipmentRepository();
