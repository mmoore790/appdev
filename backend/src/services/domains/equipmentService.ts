import { InsertEquipment } from "@shared/schema";
import { equipmentRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

class EquipmentService {
  listEquipment() {
    return equipmentRepository.findAll();
  }

  getEquipmentById(id: number) {
    return equipmentRepository.findById(id);
  }

  async createEquipment(data: InsertEquipment, actorUserId?: number) {
    const equipment = await equipmentRepository.create(data);

    const equipmentDetails = {
      serialNumber: equipment.serialNumber,
      typeId: equipment.typeId,
      customerId: equipment.customerId,
    };

    await logActivity({
      userId: actorUserId ?? null,
      activityType: "equipment_created",
      description: getActivityDescription(
        "equipment_created",
        "equipment",
        equipment.id,
        {
          equipmentName: equipmentDetails.serialNumber
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

  updateEquipment(id: number, data: InsertEquipment) {
    return equipmentRepository.update(id, data);
  }
}

export const equipmentService = new EquipmentService();
