import crypto from 'crypto';

// Simple token storage for enhanced authentication
interface TokenData {
  userId: number;
  role: string;
  businessId: number;
  expiresAt: number;
}

class TokenStorage {
  private tokens: Map<string, TokenData> = new Map();
  
  // Generate a new token for a user
  generateToken(userId: number, role: string, businessId: number): string {
    // Create a random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token data with 24-hour expiration
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    this.tokens.set(token, { userId, role, businessId, expiresAt });
    
    return token;
  }
  
  // Validate a token and return user data if valid
  validateToken(token: string): TokenData | null {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      console.log(`[TokenStorage] Token not found in storage. Total tokens: ${this.tokens.size}`);
      return null;
    }
    
    // Check if token is expired
    if (tokenData.expiresAt < Date.now()) {
      console.log(`[TokenStorage] Token expired. Expired at: ${new Date(tokenData.expiresAt).toISOString()}, Current time: ${new Date().toISOString()}`);
      // Clean up expired token
      this.tokens.delete(token);
      return null;
    }
    
    console.log(`[TokenStorage] Token validated successfully for userId: ${tokenData.userId}`);
    return tokenData;
  }
  
  // Remove a token (for logout)
  removeToken(token: string): void {
    this.tokens.delete(token);
  }
}

// Singleton instance
export const tokenStorage = new TokenStorage();