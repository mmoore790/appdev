import { InsertUser, User } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class UserRepository {
  constructor(private readonly store: IStorage = storage) {}

  findAll(): Promise<User[]> {
    return this.store.getAllUsers();
  }

  findById(id: number): Promise<User | undefined> {
    return this.store.getUser(id);
  }

  findByUsername(username: string): Promise<User | undefined> {
    return this.store.getUserByUsername(username);
  }

  findByRole(role: string): Promise<User[]> {
    return this.store.getUsersByRole(role);
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
