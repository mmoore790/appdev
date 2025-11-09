import { InsertRegistrationRequest, RegistrationRequest } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class RegistrationRepository {
  constructor(private readonly store: IStorage = storage) {}

  create(data: InsertRegistrationRequest): Promise<RegistrationRequest> {
    return this.store.createRegistrationRequest(data);
  }

  findById(id: number): Promise<RegistrationRequest | undefined> {
    return this.store.getRegistrationRequest(id);
  }

  findAll(): Promise<RegistrationRequest[]> {
    return this.store.getAllRegistrationRequests();
  }

  findPending(): Promise<RegistrationRequest[]> {
    return this.store.getPendingRegistrationRequests();
  }

  updateStatus(id: number, status: string, reviewedBy: number, notes?: string) {
    return this.store.updateRegistrationRequestStatus(id, status, reviewedBy, notes);
  }
}

export const registrationRepository = new RegistrationRepository();
