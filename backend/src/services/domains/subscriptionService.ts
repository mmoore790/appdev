import { subscriptionRepository } from "../../repositories/subscriptionRepository";
import { storage } from "../../storage";
import { hashPassword } from "../../auth";
import { InsertUser, InsertBusiness } from "@shared/schema";
import { logActivity } from "../activityService";

export class SubscriptionService {
  /**
   * Verify if a subscription exists for the given email and is eligible for account creation
   */
  async verifySubscriptionForAccountCreation(email: string): Promise<{
    valid: boolean;
    subscription?: any;
    message?: string;
  }> {
    const subscription = await subscriptionRepository.findByEmail(email);

    if (!subscription) {
      return {
        valid: false,
        message: "No subscription found for this email address",
      };
    }

    // Check if account has already been created
    if (subscription.accountCreated) {
      return {
        valid: false,
        message: "An account has already been created for this subscription",
      };
    }

    // Check if subscription status is valid (active, trialing, or pending)
    const validStatuses = ["active", "trialing", "pending"];
    if (!validStatuses.includes(subscription.status)) {
      return {
        valid: false,
        message: `Subscription status is ${subscription.status}. Only active, trialing, or pending subscriptions can create accounts.`,
      };
    }

    return {
      valid: true,
      subscription,
    };
  }

  /**
   * Create business and admin user from subscription
   */
  async createAccountFromSubscription(
    email: string,
    businessName: string,
    username: string,
    password: string,
    fullName: string
  ): Promise<{
    success: boolean;
    businessId?: number;
    userId?: number;
    message?: string;
  }> {
    // Verify subscription first
    const verification = await this.verifySubscriptionForAccountCreation(email);
    if (!verification.valid || !verification.subscription) {
      return {
        success: false,
        message: verification.message || "Subscription verification failed",
      };
    }

    const subscription = verification.subscription;

    // Check if business name already exists
    const existingBusiness = await storage.getBusinessByName(businessName);
    if (existingBusiness) {
      return {
        success: false,
        message: "Business name already taken",
      };
    }

    // Check if email already exists as a user
    try {
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return {
          success: false,
          message: "An account with this email already exists",
        };
      }
    } catch (error) {
      // User doesn't exist, which is what we want
    }

    // Check if username already exists across all businesses
    try {
      const existingUserByUsername = await storage.getUserByUsernameAcrossAllBusinesses(username);
      if (existingUserByUsername) {
        return {
          success: false,
          message: "Username already taken",
        };
      }
    } catch (error) {
      // Username doesn't exist, which is what we want
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create business
    const businessData: InsertBusiness = {
      name: businessName,
      email: email,
    };

    const newBusiness = await storage.createBusiness(businessData);

    // Create admin user
    const userData: InsertUser = {
      username,
      password: hashedPassword,
      email,
      fullName,
      role: "admin",
      businessId: newBusiness.id,
      isActive: true,
    };

    const newUser = await storage.createUser(userData);

    // Link subscription to business
    await subscriptionRepository.linkToBusiness(email, newBusiness.id);

    // Log activity
    await logActivity({
      businessId: newBusiness.id,
      userId: newUser.id,
      activityType: "subscription_account_created",
      description: `Account created from subscription for ${email}`,
      entityType: "user",
      entityId: newUser.id,
      metadata: {
        username: newUser.username,
        email: newUser.email,
        businessName: newBusiness.name,
        subscriptionId: subscription.id,
        planName: subscription.planName,
      },
    });

    return {
      success: true,
      businessId: newBusiness.id,
      userId: newUser.id,
      message: "Account created successfully",
    };
  }
}

export const subscriptionService = new SubscriptionService();
