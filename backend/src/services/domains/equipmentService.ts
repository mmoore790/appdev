import { InsertEquipment } from "@shared/schema";
import { equipmentRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { storage } from "../../storage";

class EquipmentService {
  listEquipment(businessId: number) {
    return equipmentRepository.findAll(businessId);
  }

  getEquipmentById(id: number, businessId: number) {
    return equipmentRepository.findById(id, businessId);
  }

  getEquipmentByCustomer(customerId: number, businessId: number) {
    return equipmentRepository.findByCustomer(customerId, businessId);
  }

  /**
   * Calculate warranty expiry date based on purchase date and duration
   */
  private calculateWarrantyExpiry(
    purchaseDate: string | null | undefined,
    warrantyDurationMonths: number | null | undefined
  ): string | null {
    if (!purchaseDate || !warrantyDurationMonths) {
      return null;
    }

    const purchase = new Date(purchaseDate);
    const expiry = new Date(purchase);
    expiry.setMonth(expiry.getMonth() + warrantyDurationMonths);
    return expiry.toISOString();
  }

  /**
   * Check if serial number is unique within the business
   */
  async checkSerialNumberUnique(
    serialNumber: string,
    businessId: number,
    excludeId?: number
  ): Promise<boolean> {
    const existing = await storage.getEquipmentBySerialNumber(serialNumber, businessId);
    if (!existing) {
      return true;
    }
    // If updating, exclude the current equipment
    if (excludeId && existing.id === excludeId) {
      return true;
    }
    return false;
  }

  async createEquipment(data: InsertEquipment, actorUserId?: number) {
    // Check for unique serial number
    const isUnique = await this.checkSerialNumberUnique(
      data.serialNumber,
      data.businessId
    );
    if (!isUnique) {
      throw new Error(`Serial number "${data.serialNumber}" already exists in this business`);
    }

    // Calculate warranty expiry date if purchase date and duration are provided
    const warrantyExpiryDate = this.calculateWarrantyExpiry(
      data.purchaseDate ?? null,
      data.warrantyDurationMonths ?? null
    );

    const equipmentData = {
      ...data,
      warrantyExpiryDate: warrantyExpiryDate ?? data.warrantyExpiryDate ?? null,
    };

    const equipment = await equipmentRepository.create(equipmentData);

    const equipmentDetails = {
      serialNumber: equipment.serialNumber,
      makeModel: equipment.makeModel,
      customerId: equipment.customerId,
    };

    await logActivity({
      businessId: equipment.businessId,
      userId: actorUserId ?? null,
      activityType: "equipment_created",
      description: getActivityDescription(
        "equipment_created",
        "equipment",
        equipment.id,
        {
          equipmentName: equipmentDetails.makeModel
            ? equipmentDetails.makeModel
            : equipmentDetails.serialNumber
            ? `Serial ${equipmentDetails.serialNumber}`
            : `Equipment ${equipment.id}`,
          ...equipmentDetails,
        }
      ),
      entityType: "equipment",
      entityId: equipment.id,
      metadata: {
        ...equipmentDetails,
      },
    });

    return equipment;
  }

  async updateEquipment(id: number, data: InsertEquipment, businessId: number) {
    // Check for unique serial number if serial number is being updated
    if (data.serialNumber) {
      const isUnique = await this.checkSerialNumberUnique(
        data.serialNumber,
        businessId,
        id
      );
      if (!isUnique) {
        throw new Error(`Serial number "${data.serialNumber}" already exists in this business`);
      }
    }

    // Recalculate warranty expiry if purchase date or duration changed
    const existingEquipment = await equipmentRepository.findById(id, businessId);
    if (!existingEquipment) {
      throw new Error("Equipment not found");
    }

    const purchaseDate = data.purchaseDate ?? existingEquipment.purchaseDate ?? null;
    const warrantyDurationMonths = data.warrantyDurationMonths ?? existingEquipment.warrantyDurationMonths ?? null;

    const warrantyExpiryDate = this.calculateWarrantyExpiry(
      purchaseDate,
      warrantyDurationMonths
    );

    const updateData = {
      ...data,
      warrantyExpiryDate: warrantyExpiryDate ?? data.warrantyExpiryDate ?? existingEquipment.warrantyExpiryDate ?? null,
    };

    return equipmentRepository.update(id, updateData, businessId);
  }

  async deleteEquipment(id: number, businessId: number, actorUserId?: number) {
    const existingEquipment = await equipmentRepository.findById(id, businessId);
    if (!existingEquipment) {
      throw new Error("Equipment not found");
    }

    const equipmentDetails = {
      serialNumber: existingEquipment.serialNumber,
      makeModel: existingEquipment.makeModel,
      customerId: existingEquipment.customerId,
    };

    const deleted = await equipmentRepository.delete(id, businessId);
    
    if (deleted) {
      await logActivity({
        businessId,
        userId: actorUserId ?? null,
        activityType: "equipment_deleted",
        description: getActivityDescription(
          "equipment_deleted",
          "equipment",
          id,
          {
            equipmentName: equipmentDetails.makeModel
              ? equipmentDetails.makeModel
              : equipmentDetails.serialNumber
              ? `Serial ${equipmentDetails.serialNumber}`
              : `Equipment ${id}`,
            ...equipmentDetails,
          }
        ),
        entityType: "equipment",
        entityId: id,
        metadata: {
          ...equipmentDetails,
        },
      });
    }

    return deleted;
  }
}

export const equipmentService = new EquipmentService();
