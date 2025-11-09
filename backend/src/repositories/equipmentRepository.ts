import { Equipment, InsertEquipment } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class EquipmentRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(): Promise<Equipment[]> {
    return this.store.getAllEquipment();
  }

  findById(id: number): Promise<Equipment | undefined> {
    return this.store.getEquipment(id);
  }

  findByCustomer(customerId: number): Promise<Equipment[]> {
    return this.store.getEquipmentByCustomer(customerId);
  }

  create(data: InsertEquipment): Promise<Equipment> {
    return this.store.createEquipment(data);
  }

  update(id: number, data: InsertEquipment): Promise<Equipment> {
    return this.store.updateEquipment(id, data);
  }
}

export const equipmentRepository = new EquipmentRepository();
