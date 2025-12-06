import { InsertService, Service } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class ServiceRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number): Promise<Service[]> {
    return this.store.getAllServices(businessId);
  }

  findById(id: number, businessId: number): Promise<Service | undefined> {
    return this.store.getService(id, businessId);
  }

  findByJob(jobId: number, businessId: number): Promise<Service[]> {
    return this.store.getServicesByJob(jobId, businessId);
  }

  findByEquipment(equipmentId: number, businessId: number): Promise<Service[]> {
    return this.store.getServicesByEquipment(equipmentId, businessId);
  }

  create(data: InsertService): Promise<Service> {
    return this.store.createService(data);
  }

  update(id: number, data: InsertService, businessId: number): Promise<Service> {
    return this.store.updateService(id, data, businessId);
  }
}

export const serviceRepository = new ServiceRepository();
