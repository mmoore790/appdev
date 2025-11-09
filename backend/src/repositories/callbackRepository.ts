import { CallbackRequest, InsertCallbackRequest } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class CallbackRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number): Promise<CallbackRequest | undefined> {
    return this.store.getCallbackRequest(id);
  }

  findByCustomer(customerId: number): Promise<CallbackRequest[]> {
    return this.store.getCallbackRequestsByCustomer(customerId);
  }

  findByAssignee(assigneeId: number): Promise<CallbackRequest[]> {
    return this.store.getCallbackRequestsByAssignee(assigneeId);
  }

  findPending(): Promise<CallbackRequest[]> {
    return this.store.getPendingCallbackRequests();
  }

  findCompleted(): Promise<CallbackRequest[]> {
    return this.store.getCompletedCallbackRequests();
  }

  findAll(): Promise<CallbackRequest[]> {
    return this.store.getAllCallbackRequests();
  }

  findDeleted(): Promise<CallbackRequest[]> {
    return this.store.getDeletedCallbackRequests();
  }

  create(data: InsertCallbackRequest): Promise<CallbackRequest> {
    return this.store.createCallbackRequest(data);
  }

  update(id: number, data: Partial<CallbackRequest>): Promise<CallbackRequest | undefined> {
    return this.store.updateCallbackRequest(id, data);
  }

  complete(id: number, notes?: string): Promise<CallbackRequest | undefined> {
    return this.store.completeCallbackRequest(id, notes);
  }

  softDelete(id: number): Promise<CallbackRequest | undefined> {
    return this.store.markCallbackAsDeleted(id);
  }

  restore(id: number): Promise<CallbackRequest | undefined> {
    return this.store.restoreDeletedCallback(id);
  }

  hardDelete(id: number): Promise<boolean> {
    return this.store.permanentlyDeleteCallback(id);
  }

  purgeExpired(): Promise<number> {
    return this.store.purgeExpiredDeletedCallbacks();
  }
}

export const callbackRepository = new CallbackRepository();
