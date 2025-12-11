import { InsertCustomer } from "@shared/schema";
import { customerRepository, equipmentRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { PaginatedResult } from "../../repositories/customerRepository";

type CustomerWithMatchReason = {
  id: number;
  businessId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  matchReason?: string | null;
};

class CustomerService {
  async listCustomers(
    businessId: number, 
    search?: string,
    page: number = 1,
    limit: number = 25
  ): Promise<PaginatedResult<CustomerWithMatchReason>> {
    // When searching, we need to fetch all customers to search through equipment
    // When not searching, we can use server-side pagination
    if (!search) {
      const offset = (page - 1) * limit;
      const [customers, total] = await Promise.all([
        customerRepository.findAll(businessId, limit, offset),
        customerRepository.countAll(businessId)
      ]);

      return {
        data: customers.map(c => ({ ...c, matchReason: null })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // With search, fetch all customers (needed for equipment search)
    const allCustomers = await customerRepository.findAll(businessId);
    const term = search.toLowerCase();
    const searchTerm = search.trim();
    
    // Get all equipment for this business to search through
    const allEquipment = await equipmentRepository.findAll(businessId);
    
    // Find customer IDs that match via equipment
    const matchingCustomerIds = new Set<number>();
    const customerMatchReasons = new Map<number, string>();
    
    for (const equipment of allEquipment) {
      const matchesMakeModel = equipment.makeModel?.toLowerCase().includes(term);
      const matchesSerial = equipment.serialNumber?.toLowerCase().includes(term);
      
      if (matchesMakeModel || matchesSerial) {
        matchingCustomerIds.add(equipment.customerId);
        
        // Build match reason
        let matchText = '';
        if (matchesMakeModel && equipment.makeModel) {
          matchText = equipment.makeModel;
        } else if (matchesSerial && equipment.serialNumber) {
          matchText = `serial ${equipment.serialNumber}`;
        }
        
        // Update or set match reason (prefer make/model over serial)
        const existingReason = customerMatchReasons.get(equipment.customerId);
        if (!existingReason) {
          customerMatchReasons.set(equipment.customerId, matchText);
        } else if (matchesMakeModel) {
          // If we have a make/model match, prefer it over serial number matches
          const existingIsSerial = existingReason.startsWith('serial');
          if (existingIsSerial) {
            customerMatchReasons.set(equipment.customerId, matchText);
          }
        }
      }
    }
    
    // Filter customers by name, email, phone, or equipment match
    const filteredCustomers = allCustomers.filter((customer) => {
      const matchesName = customer.name.toLowerCase().includes(term);
      const matchesEmail = !!customer.email && customer.email.toLowerCase().includes(term);
      const matchesPhone = !!customer.phone && customer.phone.includes(searchTerm);
      const matchesEquipment = matchingCustomerIds.has(customer.id);
      
      return matchesName || matchesEmail || matchesPhone || matchesEquipment;
    });
    
    // Add match reasons and apply pagination
    const customersWithReasons = filteredCustomers.map((customer) => {
      const matchReason = customerMatchReasons.get(customer.id);
      return {
        ...customer,
        matchReason: matchReason ? `has ${matchReason} registered` : null,
      };
    });

    const total = customersWithReasons.length;
    const offset = (page - 1) * limit;
    const paginatedData = customersWithReasons.slice(offset, offset + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  getCustomerById(id: number, businessId: number) {
    return customerRepository.findById(id, businessId);
  }

  async createCustomer(data: InsertCustomer, actorUserId?: number) {
    const customer = await customerRepository.create(data);

    await logActivity({
      businessId: customer.businessId,
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
    businessId: number,
    actorUserId?: number
  ) {
    const customer = await customerRepository.update(id, data, businessId);
    if (!customer) {
      return undefined;
    }

    await logActivity({
      businessId: businessId,
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

  deleteCustomer(id: number, businessId: number) {
    return customerRepository.delete(id, businessId);
  }
}

export const customerService = new CustomerService();
