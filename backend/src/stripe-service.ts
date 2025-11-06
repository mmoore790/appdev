/**
 * Stripe Payment Integration Service
 * 
 * This service handles Stripe payment integration including:
 * - Creating checkout sessions
 * - Checking payment status
 * - Managing payment intents
 */

import Stripe from 'stripe';

interface CheckoutSessionData {
  amount: number; // Amount in pence
  currency: string;
  description: string;
  customerEmail: string;
  checkoutReference: string;
}

export class StripeService {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-07-30.basil',
    });
  }

  /**
   * Create a checkout session for hosted payments
   */
  async createCheckoutSession(data: CheckoutSessionData): Promise<Stripe.Checkout.Session> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: data.currency.toLowerCase(),
            product_data: {
              name: data.description,
              description: `Reference: ${data.checkoutReference}`
            },
            unit_amount: data.amount, // Amount in pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.customerEmail,
      success_url: `https://${process.env.REPLIT_DOMAINS || 'localhost:5000'}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${process.env.REPLIT_DOMAINS || 'localhost:5000'}/payments/cancel`,
      metadata: {
        checkoutReference: data.checkoutReference,
      },
    });

    return session;
  }

  /**
   * Retrieve checkout session details
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * List checkout sessions by metadata
   */
  async listCheckoutSessions(checkoutReference?: string): Promise<Stripe.Checkout.Session[]> {
    const sessions = await this.stripe.checkout.sessions.list({
      limit: 100,
    });

    if (checkoutReference) {
      return sessions.data.filter(session => 
        session.metadata?.checkoutReference === checkoutReference
      );
    }

    return sessions.data;
  }

  /**
   * Check if Stripe is configured
   */
  static isConfigured(): boolean {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.VITE_STRIPE_PUBLIC_KEY);
  }

  /**
   * Create Stripe service instance from environment variables
   */
  static fromEnvironment(): StripeService | null {
    if (!StripeService.isConfigured()) {
      return null;
    }

    return new StripeService(process.env.STRIPE_SECRET_KEY!);
  }

  /**
   * Get payment status from checkout session
   */
  getPaymentStatus(session: Stripe.Checkout.Session): 'pending' | 'paid' | 'failed' {
    switch (session.payment_status) {
      case 'paid':
        return 'paid';
      case 'unpaid':
        return 'pending';
      default:
        return 'failed';
    }
  }
}

export default StripeService;