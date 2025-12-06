import { Customer, InsertCustomer } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class CustomerRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number): Promise<Customer[]> {
    return this.store.getAllCustomers(businessId);
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
