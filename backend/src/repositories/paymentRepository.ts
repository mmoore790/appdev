import { InsertPaymentRequest, PaymentRequest, Payment, InsertPayment } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class PaymentRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number, businessId: number): Promise<PaymentRequest | undefined> {
    return this.store.getPaymentRequest(id, businessId);
  }

  findByReference(reference: string, businessId: number): Promise<PaymentRequest | undefined> {
    return this.store.getPaymentRequestByReference(reference, businessId);
  }

  findByReferenceOnly(reference: string): Promise<PaymentRequest | undefined> {
    return this.store.getPaymentRequestByReferenceOnly(reference);
  }

  findByJob(jobId: number, businessId: number): Promise<PaymentRequest[]> {
    return this.store.getPaymentRequestsByJob(jobId, businessId);
  }

  findAll(businessId: number): Promise<PaymentRequest[]> {
    return this.store.getAllPaymentRequests(businessId);
  }

  create(data: InsertPaymentRequest): Promise<PaymentRequest> {
    return this.store.createPaymentRequest(data);
  }

  update(id: number, data: Partial<PaymentRequest>, businessId: number): Promise<PaymentRequest | undefined> {
    return this.store.updatePaymentRequest(id, data, businessId);
  }

  updateStatus(id: number, status: string, businessId: number, transactionData?: any): Promise<PaymentRequest | undefined> {
    return this.store.updatePaymentStatus(id, status, businessId, transactionData);
  }

  recordJobPayment(jobId: number, paymentData: any, recordedBy: number) {
    return this.store.recordJobPayment(jobId, paymentData, recordedBy);
  }

  createJobPaymentRequest(jobId: number, requestData: any, createdBy: number) {
    return this.store.createJobPaymentRequest(jobId, requestData, createdBy);
  }

  completeJobPaymentFromStripe(
    paymentRequestId: number,
    details?: {
      stripeReceiptUrl?: string;
      stripePaymentIntentId?: string;
      paidAt?: string;
      notes?: string;
      paymentMethod?: string;
    }
  ) {
    return this.store.completeJobPaymentFromStripe(paymentRequestId, details);
  }

  getPaymentsByJobId(jobId: number, businessId: number): Promise<Payment[]> {
    return this.store.getPaymentsByJobId(jobId, businessId);
  }

  getPaymentById(id: number, businessId: number): Promise<Payment | undefined> {
    return this.store.getPaymentById(id, businessId);
  }

  updatePaymentById(id: number, data: Partial<InsertPayment>, businessId: number): Promise<Payment | undefined> {
    return this.store.updatePaymentById(id, data, businessId);
  }

  getJobTotalCost(jobId: number, businessId: number): Promise<number> {
    return this.store.getJobTotalCost(jobId, businessId);
  }

  markJobAsPaid(jobId: number, paymentData: any, recordedBy: number) {
    return this.store.markJobAsPaid(jobId, paymentData, recordedBy);
  }

  getJobPaymentStatus(jobId: number) {
    return this.store.getJobPaymentStatus(jobId);
  }
}

export const paymentRepository = new PaymentRepository();
