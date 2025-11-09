import { InsertUser } from "@shared/schema";
import { userRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

class UserService {
  async listUsers() {
    return userRepository.findAll();
  }

  async getUserById(id: number) {
    return userRepository.findById(id);
  }

  async createUser(data: InsertUser, actorUserId?: number) {
    const newUser = await userRepository.create(data);

    await logActivity({
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
}

export const userService = new UserService();
