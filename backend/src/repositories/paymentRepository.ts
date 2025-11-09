import { InsertPaymentRequest, PaymentRequest } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class PaymentRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number): Promise<PaymentRequest | undefined> {
    return this.store.getPaymentRequest(id);
  }

  findByReference(reference: string): Promise<PaymentRequest | undefined> {
    return this.store.getPaymentRequestByReference(reference);
  }

  findByJob(jobId: number): Promise<PaymentRequest[]> {
    return this.store.getPaymentRequestsByJob(jobId);
  }

  findAll(): Promise<PaymentRequest[]> {
    return this.store.getAllPaymentRequests();
  }

  create(data: InsertPaymentRequest): Promise<PaymentRequest> {
    return this.store.createPaymentRequest(data);
  }

  update(id: number, data: Partial<PaymentRequest>): Promise<PaymentRequest | undefined> {
    return this.store.updatePaymentRequest(id, data);
  }

  updateStatus(id: number, status: string, transactionData?: any): Promise<PaymentRequest | undefined> {
    return this.store.updatePaymentStatus(id, status, transactionData);
  }

  recordJobPayment(jobId: number, paymentData: any, recordedBy: number) {
    return this.store.recordJobPayment(jobId, paymentData, recordedBy);
  }

  createJobPaymentRequest(jobId: number, requestData: any, createdBy: number) {
    return this.store.createJobPaymentRequest(jobId, requestData, createdBy);
  }

  completeJobPaymentFromStripe(paymentRequestId: number) {
    return this.store.completeJobPaymentFromStripe(paymentRequestId);
  }

  markJobAsPaid(jobId: number, paymentData: any, recordedBy: number) {
    return this.store.markJobAsPaid(jobId, paymentData, recordedBy);
  }

  getJobPaymentStatus(jobId: number) {
    return this.store.getJobPaymentStatus(jobId);
  }
}

export const paymentRepository = new PaymentRepository();
