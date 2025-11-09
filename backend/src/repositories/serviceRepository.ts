import { InsertService, Service } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class ServiceRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(): Promise<Service[]> {
    return this.store.getAllServices();
  }

  findById(id: number): Promise<Service | undefined> {
    return this.store.getService(id);
  }

  findByJob(jobId: number): Promise<Service[]> {
    return this.store.getServicesByJob(jobId);
  }

  findByEquipment(equipmentId: number): Promise<Service[]> {
    return this.store.getServicesByEquipment(equipmentId);
  }

  create(data: InsertService): Promise<Service> {
    return this.store.createService(data);
  }

  update(id: number, data: InsertService): Promise<Service> {
    return this.store.updateService(id, data);
  }
}

export const serviceRepository = new ServiceRepository();
