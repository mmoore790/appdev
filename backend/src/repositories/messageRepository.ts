import { InsertMessage, Message, MessageThread, InsertMessageThread } from "@shared/schema";
import { IStorage, storage } from "../storage";

export class MessageRepository {
  constructor(private readonly store: IStorage = storage) {}

  findById(id: number, businessId: number): Promise<Message | undefined> {
    return this.store.getMessage(id, businessId);
  }

  findByUser(userId: number, businessId: number): Promise<Message[]> {
    return this.store.getMessagesByUser(userId, businessId);
  }

  getConversation(userId1: number, userId2: number, businessId: number): Promise<Message[]> {
    return this.store.getConversation(userId1, userId2, businessId);
  }

  getSupportConversation(masterUserId: number, otherUserId: number): Promise<Message[]> {
    return this.store.getSupportConversation(masterUserId, otherUserId);
  }

  getGroupConversation(threadId: number, userId: number, businessId: number): Promise<Message[]> {
    return this.store.getGroupConversation(threadId, userId, businessId);
  }

  getAllConversations(userId: number, businessId: number): Promise<Array<{ otherUser: any; lastMessage: Message; unreadCount: number }>> {
    return this.store.getAllConversations(userId, businessId);
  }

  getUserThreads(userId: number, businessId: number): Promise<Array<{ thread: MessageThread; participants: any[]; lastMessage: Message; unreadCount: number }>> {
    return this.store.getUserThreads(userId, businessId);
  }

  getThread(threadId: number, businessId: number): Promise<MessageThread | undefined> {
    return this.store.getThread(threadId, businessId);
  }

  updateThread(threadId: number, businessId: number, data: Partial<InsertMessageThread>): Promise<MessageThread | undefined> {
    return this.store.updateThread(threadId, businessId, data);
  }

  create(data: InsertMessage): Promise<Message> {
    return this.store.createMessage(data);
  }

  markAsRead(id: number, userId: number, businessId: number): Promise<Message | undefined> {
    return this.store.markMessageAsRead(id, userId, businessId);
  }

  markConversationAsRead(userId: number, otherUserId: number, businessId: number): Promise<number> {
    return this.store.markConversationAsRead(userId, otherUserId, businessId);
  }

  markGroupConversationAsRead(threadId: number, userId: number, businessId: number): Promise<number> {
    return this.store.markGroupConversationAsRead(threadId, userId, businessId);
  }

  delete(id: number, userId: number, businessId: number): Promise<boolean> {
    return this.store.deleteMessage(id, userId, businessId);
  }
}

export const messageRepository = new MessageRepository();

