import { Request } from "express";

// Extend Express Session type to include our custom fields
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    role?: string;
    businessId?: number;
  }
}

/**
 * Extract businessId from the session
 * Throws an error if businessId is not found (should not happen if user is authenticated)
 */
export function getBusinessIdFromRequest(req: Request): number {
  try {
    const businessId = req.session?.businessId;
    
    // Check if session exists
    if (!req.session) {
      throw new Error("Session not found. User may not be authenticated.");
    }
    
    // Check if businessId exists (but allow 0 as a valid value)
    if (businessId === undefined || businessId === null) {
      console.error(`[getBusinessIdFromRequest] businessId is ${businessId}, session:`, JSON.stringify(req.session, null, 2));
      throw new Error("Business ID not found in session. User may not be authenticated.");
    }
    
    // Ensure businessId is a number (convert string to number if needed)
    const numBusinessId = typeof businessId === 'string' ? parseInt(businessId, 10) : Number(businessId);
    if (isNaN(numBusinessId)) {
      console.error(`[getBusinessIdFromRequest] Invalid businessId: ${businessId} (type: ${typeof businessId})`);
      throw new Error(`Invalid businessId in session: ${businessId} (type: ${typeof businessId})`);
    }
    
    return numBusinessId;
  } catch (error) {
    console.error(`[getBusinessIdFromRequest] Error extracting businessId:`, error);
    throw error;
  }
}

/**
 * Extract userId from the session
 */
export function getUserIdFromRequest(req: Request): number {
  const userId = req.session?.userId;
  if (!userId) {
    throw new Error("User ID not found in session. User may not be authenticated.");
  }
  return userId as number;
}

