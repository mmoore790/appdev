import { Customer, InsertCustomer } from "@shared/schema";
import { IStorage, storage } from "../storage";

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export class CustomerRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number, limit?: number, offset?: number): Promise<Customer[]> {
    return this.store.getAllCustomers(businessId, limit, offset);
  }

  countAll(businessId: number): Promise<number> {
    return this.store.countAllCustomers(businessId);
  }

  findById(id: number, businessId: number): Promise<Customer | undefined> {
    return this.store.getCustomer(id, businessId);
  }

  create(data: InsertCustomer): Promise<Customer> {
    return this.store.createCustomer(data);
  }

  update(id: number, data: Partial<InsertCustomer>, businessId: number): Promise<Customer | undefined> {
    return this.store.updateCustomer(id, data, businessId);
  }

  delete(id: number, businessId: number): Promise<boolean> {
    return this.store.deleteCustomer(id, businessId);
  }
}

export const customerRepository = new CustomerRepository();
