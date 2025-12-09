import { db } from "../db";
import { notifications, InsertNotification, Notification } from "@shared/schema";
import { eq, and, desc, or, isNull } from "drizzle-orm";

export class NotificationRepository {
  async create(data: InsertNotification): Promise<Notification> {
    // Ensure metadata is properly typed for Drizzle
    const insertData = {
      ...data,
      metadata: data.metadata === undefined ? null : (data.metadata as Record<string, unknown> | null),
    };
    const [notification] = await db.insert(notifications).values(insertData).returning();
    return notification;
  }

  async findById(id: number, businessId: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.businessId, businessId)))
      .limit(1);
    return notification;
  }

  async findByUser(userId: number, businessId: number, unreadOnly: boolean = false): Promise<Notification[]> {
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.businessId, businessId),
    ];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));
  }

  async findByEntity(entityType: string, entityId: number, businessId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.entityType, entityType),
          eq(notifications.entityId, entityId),
          eq(notifications.businessId, businessId)
        )
      );
  }

  async markAsRead(id: number, businessId: number, userId: number): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.businessId, businessId),
          eq(notifications.userId, userId)
        )
      )
      .returning();
    return notification;
  }

  async markAllAsRead(userId: number, businessId: number): Promise<number> {
    const result = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.businessId, businessId),
          eq(notifications.isRead, false)
        )
      );
    return result.rowCount || 0;
  }

  async delete(id: number, businessId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.businessId, businessId),
          eq(notifications.userId, userId)
        )
      );
    return (result.rowCount || 0) > 0;
  }

  async deleteByEntity(entityType: string, entityId: number, businessId: number): Promise<number> {
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.entityType, entityType),
          eq(notifications.entityId, entityId),
          eq(notifications.businessId, businessId)
        )
      );
    return result.rowCount || 0;
  }

  async getUnreadCount(userId: number, businessId: number): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.businessId, businessId),
          eq(notifications.isRead, false)
        )
      );
    return result.length;
  }

  async deleteAll(userId: number, businessId: number): Promise<number> {
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.businessId, businessId)
        )
      );
    return result.rowCount || 0;
  }
}

export const notificationRepository = new NotificationRepository();

