import { InsertUser, User } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class UserRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(businessId: number): Promise<User[]> {
    return this.store.getAllUsers(businessId);
  }

  findById(id: number, businessId: number): Promise<User | undefined> {
    return this.store.getUser(id, businessId);
  }

  findByUsername(username: string, businessId: number): Promise<User | undefined> {
    return this.store.getUserByUsername(username, businessId);
  }

  findByRole(role: string, businessId: number): Promise<User[]> {
    return this.store.getUsersByRole(role, businessId);
  }

  create(data: InsertUser): Promise<User> {
    return this.store.createUser(data);
  }

  update(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    return this.store.updateUser(id, data);
  }

  deactivate(id: number): Promise<boolean> {
    return this.store.deactivateUser(id);
  }
}

export const userRepository = new UserRepository();
