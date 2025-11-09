import { Customer, InsertCustomer } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class CustomerRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(): Promise<Customer[]> {
    return this.store.getAllCustomers();
  }

  findById(id: number): Promise<Customer | undefined> {
    return this.store.getCustomer(id);
  }

  create(data: InsertCustomer): Promise<Customer> {
    return this.store.createCustomer(data);
  }

  update(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    return this.store.updateCustomer(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.store.deleteCustomer(id);
  }
}

export const customerRepository = new CustomerRepository();
