/**
 * SumUp Payment Integration Service
 * 
 * This service handles SumUp payment integration including:
 * - OAuth authentication
 * - Creating checkouts
 * - Checking payment status
 * - Generating payment links
 */

interface SumUpTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

interface SumUpCheckoutRequest {
  checkout_reference: string;
  amount: number;
  currency: string;
  description: string;
  merchant_code?: string;
  return_url?: string;
  redirect_url?: string;
}

interface SumUpCheckoutResponse {
  id: string;
  checkout_reference: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  description: string;
  date: string;
  valid_until?: string;
  merchant_code?: string;
  hosted_checkout?: { enabled: boolean };
  hosted_checkout_url?: string;
  transactions?: Array<{
    id: string;
    transaction_code: string;
    amount: number;
    currency: string;
    timestamp: string;
    status: string;
    auth_code?: string;
  }>;
}

export class SumUpService {
  private clientId: string;
  private clientSecret: string;
  private merchantCode: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl = 'https://api.sumup.com';

  constructor(clientId: string, clientSecret: string, merchantCode: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.merchantCode = merchantCode;
  }

  /**
   * Get access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Try to refresh token if we have one
    if (this.refreshToken) {
      try {
        const refreshedToken = await this.refreshAccessToken();
        if (refreshedToken) {
          return refreshedToken;
        }
      } catch (error) {
        console.warn('Failed to refresh token, getting new one:', error);
      }
    }

    // Get new token using client credentials
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const tokenData: SumUpTokenResponse = await response.json();
    
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token || null;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

    return this.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const tokenData: SumUpTokenResponse = await response.json();
    
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token || this.refreshToken;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

    return this.accessToken;
  }

  /**
   * Create a payment checkout
   */
  async createCheckout(checkoutData: SumUpCheckoutRequest): Promise<SumUpCheckoutResponse> {
    const accessToken = await this.getAccessToken();

    const requestBody = {
      ...checkoutData,
      merchant_code: this.merchantCode,
      // Enable hosted checkout for complete payment flow
      hosted_checkout: { enabled: true },
      // Add redirect URL for web payments - matches SumUp app configuration
      redirect_url: `https://moorelink.co.uk/payments/success`,
    };

    const response = await fetch(`${this.baseUrl}/v0.1/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create checkout: ${response.statusText} - ${errorText}`);
    }

    const checkout: SumUpCheckoutResponse = await response.json();
    return checkout;
  }

  /**
   * Get checkout status
   */
  async getCheckout(checkoutId: string): Promise<SumUpCheckoutResponse> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v0.1/checkouts/${checkoutId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get checkout: ${response.statusText}`);
    }

    const checkout: SumUpCheckoutResponse = await response.json();
    return checkout;
  }

  /**
   * List checkouts by reference
   */
  async listCheckouts(checkoutReference?: string): Promise<SumUpCheckoutResponse[]> {
    const accessToken = await this.getAccessToken();

    const url = new URL(`${this.baseUrl}/v0.1/checkouts`);
    if (checkoutReference) {
      url.searchParams.append('checkout_reference', checkoutReference);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list checkouts: ${response.statusText}`);
    }

    const checkouts: SumUpCheckoutResponse[] = await response.json();
    return checkouts;
  }

  /**
   * Generate payment link for checkout - now extracts from hosted checkout URL
   */
  generatePaymentLink(checkoutId: string): string {
    // This method is now deprecated in favor of hosted_checkout_url from the API response
    return `https://gateway.sumup.com/gateway/ecom/card/v2/pay/${checkoutId}`;
  }

  /**
   * Get hosted checkout URL from checkout response
   */
  getHostedCheckoutUrl(checkout: SumUpCheckoutResponse): string | null {
    return checkout.hosted_checkout_url || null;
  }

  /**
   * Check if SumUp credentials are configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.SUMUP_CLIENT_ID &&
      process.env.SUMUP_CLIENT_SECRET &&
      process.env.SUMUP_MERCHANT_CODE
    );
  }

  /**
   * Create SumUp service instance from environment variables
   */
  static fromEnvironment(): SumUpService | null {
    if (!SumUpService.isConfigured()) {
      return null;
    }

    return new SumUpService(
      process.env.SUMUP_CLIENT_ID!,
      process.env.SUMUP_CLIENT_SECRET!,
      process.env.SUMUP_MERCHANT_CODE!
    );
  }
}

export default SumUpService;