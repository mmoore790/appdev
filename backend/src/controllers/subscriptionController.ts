import { Router, Request, Response, NextFunction } from "express";
import { subscriptionService } from "../services/domains/subscriptionService";
import { z } from "zod";

const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const createAccountSchema = z.object({
  email: z.string().email("Invalid email address"),
  businessName: z.string().min(1, "Business name is required").max(255, "Business name is too long"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Full name is required").max(255, "Full name is too long"),
});

export class SubscriptionController {
  public readonly router = Router();

  constructor() {
    // Public endpoint - verify subscription by email
    this.router.post("/verify-email", this.verifyEmail);
    
    // Public endpoint - create account from subscription
    this.router.post("/create-account", this.createAccount);
  }

  private verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = verifyEmailSchema.parse(req.body);

      const verification = await subscriptionService.verifySubscriptionForAccountCreation(email);

      if (!verification.valid) {
        return res.status(400).json({
          valid: false,
          message: verification.message,
        });
      }

      // Return subscription details (without sensitive info)
      const { subscription } = verification;
      return res.json({
        valid: true,
        subscription: {
          email: subscription.email,
          planName: subscription.planName,
          status: subscription.status,
          accountCreated: subscription.accountCreated,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          valid: false,
          message: error.errors[0].message,
        });
      }
      console.error("Error verifying subscription email:", error);
      next(error);
    }
  };

  private createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, businessName, username, password, fullName } = createAccountSchema.parse(req.body);

      const result = await subscriptionService.createAccountFromSubscription(
        email,
        businessName,
        username,
        password,
        fullName
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(201).json({
        success: true,
        message: result.message,
        businessId: result.businessId,
        userId: result.userId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0].message,
        });
      }
      console.error("Error creating account from subscription:", error);
      next(error);
    }
  };
}

export const subscriptionController = new SubscriptionController();
