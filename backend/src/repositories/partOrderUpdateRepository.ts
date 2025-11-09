import { InsertPartOrderUpdate, PartOrderUpdate } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class PartOrderUpdateRepository {
  constructor(private readonly store: IStorage = storage) {}

  findByPart(partOrderId: number): Promise<PartOrderUpdate[]> {
    return this.store.getPartOrderUpdates(partOrderId);
  }

  create(data: InsertPartOrderUpdate): Promise<PartOrderUpdate> {
    return this.store.createPartOrderUpdate(data);
  }
}

export const partOrderUpdateRepository = new PartOrderUpdateRepository();
