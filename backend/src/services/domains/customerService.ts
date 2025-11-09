import { InsertCustomer } from "@shared/schema";
import { customerRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

class CustomerService {
  async listCustomers(search?: string) {
    const customers = await customerRepository.findAll();

    if (!search) {
      return customers;
    }

    const term = search.toLowerCase();
    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(term) ||
        (!!customer.email && customer.email.toLowerCase().includes(term)) ||
        (!!customer.phone && customer.phone.includes(search))
      );
    });
  }

  getCustomerById(id: number) {
    return customerRepository.findById(id);
  }

  async createCustomer(data: InsertCustomer, actorUserId?: number) {
    const customer = await customerRepository.create(data);

    await logActivity({
      userId: actorUserId ?? null,
      activityType: "customer_created",
      description: getActivityDescription(
        "customer_created",
        "customer",
        customer.id,
        {
          customerName: customer.name,
          email: customer.email,
          phone: customer.phone,
        }
      ),
      entityType: "customer",
      entityId: customer.id,
      metadata: {
        customerName: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    });

    return customer;
  }

  async updateCustomer(
    id: number,
    data: Partial<InsertCustomer>,
    actorUserId?: number
  ) {
    const customer = await customerRepository.update(id, data);
    if (!customer) {
      return undefined;
    }

    await logActivity({
      userId: actorUserId ?? null,
      activityType: "customer_updated",
      description: getActivityDescription(
        "customer_updated",
        "customer",
        customer.id,
        {
          customerName: customer.name,
          changes: Object.keys(data).join(", "),
        }
      ),
      entityType: "customer",
      entityId: customer.id,
      metadata: {
        customerName: customer.name,
        updatedFields: Object.keys(data),
      },
    });

    return customer;
  }

  deleteCustomer(id: number) {
    return customerRepository.delete(id);
  }
}

export const customerService = new CustomerService();
