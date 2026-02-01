import { InsertUser } from "@shared/schema";
import { userRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

class UserService {
  async listUsers(businessId: number) {
    return userRepository.findAll(businessId);
  }

  async getUserById(id: number, businessId: number) {
    return userRepository.findById(id, businessId);
  }

  async createUser(data: InsertUser, actorUserId?: number) {
    const newUser = await userRepository.create(data);

    await logActivity({
      businessId: newUser.businessId,
      userId: actorUserId ?? null,
      activityType: "user_created",
      description: getActivityDescription("user_created", "user", newUser.id, {
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
      }),
      entityType: "user",
      entityId: newUser.id,
      metadata: {
        username: newUser.username,
        role: newUser.role,
      },
    });

    return newUser;
  }

  async updateUser(
    id: number,
    businessId: number,
    data: Partial<InsertUser>,
    actorUserId?: number
  ) {
    const existing = await userRepository.findById(id, businessId);
    if (!existing) return undefined;
    const updated = await userRepository.update(id, data);
    if (updated && actorUserId) {
      await logActivity({
        businessId,
        userId: actorUserId,
        activityType: "user_updated",
        description: getActivityDescription("user_updated", "user", id, {
          username: updated.username,
          fullName: updated.fullName,
          role: updated.role,
        }),
        entityType: "user",
        entityId: id,
        metadata: { changes: Object.keys(data) },
      });
    }
    return updated;
  }

  async deactivateUser(id: number, businessId: number, actorUserId?: number) {
    const existing = await userRepository.findById(id, businessId);
    if (!existing) return false;
    const ok = await userRepository.deactivate(id);
    if (ok && actorUserId) {
      await logActivity({
        businessId,
        userId: actorUserId,
        activityType: "user_deactivated",
        description: getActivityDescription("user_deactivated", "user", id, {
          username: existing.username,
          fullName: existing.fullName,
        }),
        entityType: "user",
        entityId: id,
        metadata: { username: existing.username },
      });
    }
    return ok;
  }
}

export const userService = new UserService();
