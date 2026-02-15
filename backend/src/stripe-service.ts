/**
 * Stripe Payment Integration Service
 *
 * Handles Stripe payment integration and optional Stripe Connect (Express) per business:
 * - Checkout sessions (platform or destination charges to connected accounts)
 * - Connect: Express account creation, onboarding links, status, login links
 */

import Stripe from 'stripe';

const FRONTEND_ORIGIN = (() => {
  const domain = process.env.FRONTEND_DOMAIN || process.env.FRONTEND_URL?.replace(/^https?:\/\//, '') || process.env.REPLIT_DOMAINS || 'localhost:5173';
  if (domain.includes('://')) return domain;
  const isLocalhost = /^localhost(:\d+)?$/.test(domain) || /^127\.0\.0\.1(:\d+)?$/.test(domain);
  const protocol = isLocalhost ? 'http' : 'https';
  return `${protocol}://${domain}`;
})();

interface CheckoutSessionData {
  amount: number; // Amount in pence
  currency: string;
  description: string;
  customerEmail: string;
  checkoutReference: string;
  businessId?: number;
  paymentRequestId?: number;
  jobId?: number;
  /** When set, create a destination charge to this Connect account and take platform fee */
  connect?: {
    stripeAccountId: string;
    businessId: number;
  };
}

interface CreatePaymentIntentData {
  amount: number;
  currency: string;
  description: string;
  checkoutReference: string;
  customerEmail?: string;
  businessId?: number;
  paymentRequestId?: number;
  jobId?: number;
  connect?: { stripeAccountId: string; businessId: number };
}

export class StripeService {
  private stripe: Stripe;

    constructor(secretKey: string) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil',
      });
  }

  /**
   * Platform fee in basis points (0.4% = 40). From env STRIPE_PLATFORM_FEE_BPS, default 40.
   */
  getPlatformFeeBps(): number {
    const bps = process.env.STRIPE_PLATFORM_FEE_BPS;
    if (bps === undefined || bps === '') return 40;
    const n = parseInt(bps, 10);
    return Number.isNaN(n) || n < 0 ? 40 : n;
  }

  /**
   * Create a checkout session for hosted payments.
   * If data.connect is set, creates a destination charge to the connected account with platform fee.
   */
  async createCheckoutSession(data: CheckoutSessionData): Promise<Stripe.Checkout.Session> {
    const baseUrl = FRONTEND_ORIGIN;
    const metadata: Record<string, string> = {
      checkoutReference: data.checkoutReference,
    };
    if (data.businessId) metadata.businessId = String(data.businessId);
    if (data.paymentRequestId) metadata.paymentRequestId = String(data.paymentRequestId);
    if (data.jobId) metadata.jobId = String(data.jobId);
    if (data.connect && !metadata.businessId) {
      metadata.businessId = String(data.connect.businessId);
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: data.currency.toLowerCase(),
            product_data: {
              name: data.description,
              description: `Reference: ${data.checkoutReference}`,
            },
            unit_amount: data.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: data.customerEmail,
      success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payments/cancel`,
      metadata,
    };

    if (data.connect) {
      const feeBps = this.getPlatformFeeBps();
      const applicationFeeAmount = Math.round((data.amount * feeBps) / 10000);
      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: data.connect.stripeAccountId,
        },
      };
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    return session;
  }

  /**
   * Retrieve checkout session details
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

    async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges.data']
      });
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
   * Check if Stripe is configured (backend only needs secret key for Connect and payments).
   * Publishable key (VITE_STRIPE_PUBLIC_KEY) is optional and used by the frontend if present.
   */
  static isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
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

  // --- Stripe Connect (Express) ---

  /**
   * Create a Stripe Connect Express account for a business.
   */
  async createConnectExpressAccount(params: {
    email?: string;
    businessName?: string;
  }): Promise<Stripe.Account> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: params.email || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return account;
  }

  /**
   * Create an account link for Connect onboarding (return_url and refresh_url).
   */
  async createAccountLink(accountId: string, returnPath: string): Promise<string> {
    const base = FRONTEND_ORIGIN.replace(/\/$/, '');
    const returnUrl = `${base}${returnPath.startsWith('/') ? returnPath : `/${returnPath}`}`;
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return link.url;
  }

  /**
   * Retrieve Connect account and return key capability/status fields.
   */
  async retrieveConnectAccount(accountId: string): Promise<{
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
  }> {
    const account = await this.stripe.accounts.retrieve(accountId);
    if (account.deleted) {
      return { charges_enabled: false, payouts_enabled: false, details_submitted: false };
    }
    return {
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
    };
  }

  /**
   * Create a short-lived login link to the Express account dashboard.
   */
  async createConnectLoginLink(accountId: string): Promise<string> {
    const loginLink = await this.stripe.accounts.createLoginLink(accountId);
    return loginLink.url;
  }

  // --- PaymentIntent (embedded Boltdown Pay) ---

  /**
   * Create a PaymentIntent for embedded payments (Boltdown Pay).
   * Returns client_secret for Stripe Elements on the frontend.
   */
  async createPaymentIntent(data: CreatePaymentIntentData): Promise<Stripe.PaymentIntent> {
    const baseUrl = FRONTEND_ORIGIN;
    const metadata: Record<string, string> = {
      checkoutReference: data.checkoutReference,
    };
    if (data.connect) {
      metadata.businessId = String(data.connect.businessId);
    }

    const params: Stripe.PaymentIntentCreateParams = {
      amount: data.amount,
      currency: data.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata,
      description: data.description,
      receipt_email: data.customerEmail || undefined,
    };

    if (data.connect) {
      const feeBps = this.getPlatformFeeBps();
      params.application_fee_amount = Math.round((data.amount * feeBps) / 10000);
      params.transfer_data = { destination: data.connect.stripeAccountId };
    }

    return await this.stripe.paymentIntents.create(params);
  }

  /**
   * Retrieve PaymentIntent (for status check).
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  // --- Boltdown Pay: Connect account balance & transactions ---

  /**
   * Get balance for a connected account.
   */
  async getConnectBalance(accountId: string): Promise<{
    available: { amount: number; currency: string }[];
    pending: { amount: number; currency: string }[];
  }> {
    const balance = await this.stripe.balance.retrieve({
      stripeAccount: accountId,
    });
    return {
      available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
      pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
    };
  }

  /**
   * List balance transactions for a connected account.
   */
  async getConnectBalanceTransactions(
    accountId: string,
    opts?: { limit?: number; type?: string }
  ): Promise<Stripe.BalanceTransaction[]> {
    const txns = await this.stripe.balanceTransactions.list(
      {
        limit: opts?.limit ?? 20,
        type: opts?.type as any,
      },
      { stripeAccount: accountId }
    );
    return txns.data;
  }

  /**
   * List payouts for a connected account.
   */
  async getConnectPayouts(
    accountId: string,
    opts?: { limit?: number; status?: string }
  ): Promise<Stripe.Payout[]> {
    const payouts = await this.stripe.payouts.list(
      {
        limit: opts?.limit ?? 10,
        ...(opts?.status && { status: opts.status as Stripe.PayoutListParams['status'] }),
      },
      { stripeAccount: accountId }
    );
    return payouts.data;
  }

  /**
   * Create an Account Session for Connect embedded components (e.g. account management).
   * Returns client_secret for use with Connect.js on the frontend.
   */
  async createAccountSession(connectedAccountId: string): Promise<{ client_secret: string }> {
    const session = await this.stripe.accountSessions.create({
      account: connectedAccountId,
      components: {
        account_management: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      },
    });
    return { client_secret: session.client_secret };
  }
}

export default StripeService;
export { FRONTEND_ORIGIN };