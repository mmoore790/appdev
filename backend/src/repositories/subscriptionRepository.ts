import { db } from "../db";
import { subscriptions, InsertSubscription, Subscription } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class SubscriptionRepository {
  async findByEmail(email: string): Promise<Subscription | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.email, email))
      .limit(1);
    
    return result[0];
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);
    
    return result[0];
  }

  async findById(id: number): Promise<Subscription | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    
    return result[0];
  }

  async create(data: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .returning();
    
    return subscription;
  }

  async update(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updated] = await db
      .update(subscriptions)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, id))
      .returning();
    
    return updated;
  }

  async updateByEmail(email: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updated] = await db
      .update(subscriptions)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.email, email))
      .returning();
    
    return updated;
  }

  async linkToBusiness(email: string, businessId: number): Promise<Subscription | undefined> {
    return this.updateByEmail(email, { businessId, accountCreated: true });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
