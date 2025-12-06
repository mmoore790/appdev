import { CallbackRequest, InsertCallbackRequest } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class CallbackRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number, businessId: number): Promise<CallbackRequest | undefined> {
    return this.store.getCallbackRequest(id, businessId);
  }

  findByCustomer(customerId: number, businessId: number): Promise<CallbackRequest[]> {
    return this.store.getCallbackRequestsByCustomer(customerId, businessId);
  }

  findByAssignee(assigneeId: number, businessId: number): Promise<CallbackRequest[]> {
    return this.store.getCallbackRequestsByAssignee(assigneeId, businessId);
  }

  findPending(businessId: number): Promise<CallbackRequest[]> {
    return this.store.getPendingCallbackRequests(businessId);
  }

  findCompleted(businessId: number): Promise<CallbackRequest[]> {
    return this.store.getCompletedCallbackRequests(businessId);
  }

  findAll(businessId: number): Promise<CallbackRequest[]> {
    return this.store.getAllCallbackRequests(businessId);
  }

  findDeleted(businessId: number): Promise<CallbackRequest[]> {
    return this.store.getDeletedCallbackRequests(businessId);
  }

  create(data: InsertCallbackRequest): Promise<CallbackRequest> {
    return this.store.createCallbackRequest(data);
  }

  update(id: number, data: Partial<CallbackRequest>, businessId: number): Promise<CallbackRequest | undefined> {
    return this.store.updateCallbackRequest(id, data, businessId);
  }

  complete(id: number, businessId: number, notes?: string): Promise<CallbackRequest | undefined> {
    return this.store.completeCallbackRequest(id, businessId, notes);
  }

  softDelete(id: number, businessId: number): Promise<CallbackRequest | undefined> {
    return this.store.markCallbackAsDeleted(id, businessId);
  }

  restore(id: number, businessId: number): Promise<CallbackRequest | undefined> {
    return this.store.restoreDeletedCallback(id, businessId);
  }

  hardDelete(id: number, businessId: number): Promise<boolean> {
    return this.store.permanentlyDeleteCallback(id, businessId);
  }

  purgeExpired(businessId: number): Promise<number> {
    return this.store.purgeExpiredDeletedCallbacks(businessId);
  }
}

export const callbackRepository = new CallbackRepository();
