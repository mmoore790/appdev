import { NextFunction, Request, Response } from "express";
import { storage } from "./storage";
import * as bcrypt from 'bcryptjs';
import { InsertRegistrationRequest, InsertUser, users } from "@shared/schema";
import { tokenStorage } from "./tokenStorage";
import {
  sendRegistrationApprovalEmail,
  sendRegistrationRejectionEmail
} from "./services/emailService";
import { logActivity } from "./services/activityService";
import { db } from "./db";
import { eq } from "drizzle-orm";


// Middleware to check if user is authenticated with token fallback
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - Session data:', req.session);

  // First, try to authenticate using session
  if (req.session && req.session.userId) {
    console.log(`User authenticated via session: userId=${req.session.userId}, role=${req.session.role}`);
    return next();
  }

  // If session auth fails, try token-based auth (from Authorization header)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log(`[Auth] Attempting token authentication for ${req.path}, token length: ${token.length}`);
    const tokenData = tokenStorage.validateToken(token);

    if (tokenData) {
      // Valid token - use it to set session data for this request
      console.log(`[Auth] User authenticated via token: userId=${tokenData.userId}, role=${tokenData.role}, businessId=${tokenData.businessId}`);
      req.session.userId = tokenData.userId;
      req.session.role = tokenData.role;
      req.session.businessId = tokenData.businessId;
      return next();
    } else {
      console.log(`[Auth] Token validation failed for ${req.path}. Token may be expired or invalid.`);
    }
  }

  // Check for token in query param (backup method)
  const queryToken = req.query.token as string;
  if (queryToken) {
    const tokenData = tokenStorage.validateToken(queryToken);

    if (tokenData) {
      // Valid token - use it to set session data for this request
      console.log(`User authenticated via query token: userId=${tokenData.userId}, role=${tokenData.role}, businessId=${tokenData.businessId}`);
      req.session.userId = tokenData.userId;
      req.session.role = tokenData.role;
      req.session.businessId = tokenData.businessId;
      return next();
    }
  }

  // Check what authentication methods were attempted
  const hasAuthHeader = req.headers.authorization ? 'Yes' : 'No';
  const hasQueryToken = req.query.token ? 'Yes' : 'No';
  const hasSessionData = req.session ? 'Yes' : 'No';
  const sessionUserId = req.session?.userId || 'None';

  console.log(`[Auth] Authentication failed for ${req.path}: No valid session or token found.
    Auth header present: ${hasAuthHeader}
    Query token present: ${hasQueryToken}
    Session exists: ${hasSessionData}
    Session userId: ${sessionUserId}
    Request method: ${req.method}
  `);

  return res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user is an admin
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Use type assertion to ensure userId is treated as a number
  const userId = req.session.userId as number;
  const businessId = req.session.businessId as number;
  
  if (!businessId) {
    return res.status(401).json({ message: "Business context not found" });
  }
  
  const user = await storage.getUser(userId, businessId);

  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};

// Middleware to check if user is a master
export const isMaster = async (req: Request, res: Response, next: NextFunction) => {
  // First, try to authenticate using session
  if (req.session && req.session.userId) {
    const userId = req.session.userId as number;
    const businessId = req.session.businessId as number;
    
    if (!businessId) {
      return res.status(401).json({ message: "Business context not found" });
    }
    
    const user = await storage.getUser(userId, businessId);

    if (!user || user.role !== "master") {
      return res.status(403).json({ message: "Forbidden: Master access required" });
    }

    return next();
  }

  // If session auth fails, try token-based auth (from Authorization header)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const tokenData = tokenStorage.validateToken(token);

    if (tokenData) {
      // Valid token - verify the user is a master
      const user = await storage.getUser(tokenData.userId, tokenData.businessId);

      if (!user || user.role !== "master") {
        return res.status(403).json({ message: "Forbidden: Master access required" });
      }

      // Set session data for this request
      req.session.userId = tokenData.userId;
      req.session.role = tokenData.role;
      req.session.businessId = tokenData.businessId;
      return next();
    }
  }

  // Check for token in query param (backup method)
  const queryToken = req.query.token as string;
  if (queryToken) {
    const tokenData = tokenStorage.validateToken(queryToken);

    if (tokenData) {
      // Valid token - verify the user is a master
      const user = await storage.getUser(tokenData.userId, tokenData.businessId);

      if (!user || user.role !== "master") {
        return res.status(403).json({ message: "Forbidden: Master access required" });
      }

      // Set session data for this request
      req.session.userId = tokenData.userId;
      req.session.role = tokenData.role;
      req.session.businessId = tokenData.businessId;
      return next();
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Verify password
export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

// Initialize authentication endpoints
export const initAuthRoutes = (app: any) => {
  // Test endpoint to verify routes are working
  app.get("/api/auth/test", (req: Request, res: Response) => {
    res.json({ message: "Auth routes are working", timestamp: new Date().toISOString() });
  });

  // Login endpoint
  console.log("[Auth] Registering POST /api/auth/login route");
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    console.log("=== LOGIN REQUEST START ===");
    console.log("Request body:", JSON.stringify(req.body));
    console.log("Storage object exists:", !!storage);
    
    try {
      const { email, password } = req.body;
      console.log("Extracted email:", email, "Password provided:", !!password);

      if (!email || !password) {
        console.log("Missing email or password");
        return res.status(400).json({ message: "Email/username and password are required" });
      }

      console.log(`Login attempt for identifier: ${email}`);
      
      // Try to find user by email first
      let user: any;
      try {
        user = await storage.getUserByEmail(email);
      } catch (dbError) {
        console.error("Database error when searching by email:", dbError);
        throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      
      // If not found by email, try username
      if (!user) {
        console.log(`User not found with email, trying username: ${email}`);
        try {
          user = await storage.getUserByUsernameAcrossAllBusinesses(email);
        } catch (dbError) {
          console.error("Database error when searching by username:", dbError);
          throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
        }
      }

      if (!user) {
        console.log(`User not found with email or username: ${email}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.email) {
        console.log(`User ${user.id} has no email address`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user has a businessId
      if (!user.businessId) {
        console.error(`User ${user.id} (${user.email}) has no businessId associated`);
        return res.status(500).json({ message: "Account configuration error. Please contact administrator." });
      }

      // Check if is_active is false (only if the column exists and is defined)
      if (user.isActive === false) {
        console.log(`User account inactive: ${user.email}`);
        return res.status(403).json({ message: "Account is inactive" });
      }

      // Check if user has a password set
      if (!user.password) {
        console.error(`User ${user.id} (${user.email}) has no password set`);
        return res.status(500).json({ message: "Account configuration error. Please contact administrator." });
      }

      // For debugging, log the hashed password from DB (safely)
      if (user.password && user.password.length > 0) {
        console.log(`Stored password hash: ${user.password.substring(0, 10)}...`);
      }

      // Try to verify the password
      try {
        const isValid = await verifyPassword(password, user.password);
        console.log(`Password verification result: ${isValid}`);

        if (!isValid) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      } catch (error) {
        console.error("Password verification error:", error);
        return res.status(500).json({ message: "Authentication error" });
      }



      // Create session
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.businessId = user.businessId;

      // Debug session data
      console.log(`Setting session data: userId=${user.id}, role=${user.role}, businessId=${user.businessId}`);
      console.log('Session ID:', req.sessionID);
      console.log('Session BEFORE save:', req.session);

      // Generate auth token as fallback for session issues (include businessId in token)
      let authToken: string;
      try {
        authToken = tokenStorage.generateToken(user.id, user.role, user.businessId);
        console.log(`Generated auth token for user ${user.id}`);
      } catch (tokenError) {
        console.error('Token generation error:', tokenError);
        // Continue without token if generation fails
        authToken = '';
      }

      // Force session save with promise-based approach
      try {
        await new Promise<void>((resolve, reject) => {
          req.session.save(err => {
            if (err) {
              console.error('Session save error:', err);
              reject(err);
            } else {
              console.log('Session AFTER save:', req.session);
              console.log(`User logged in successfully: ${user.email}, id: ${user.id}, role: ${user.role}, businessId: ${user.businessId}`);
              resolve();
            }
          });
        });
      } catch (sessionError) {
        console.error('Session save failed:', sessionError);
        // Continue with login even if session save fails - token will be used as fallback
        console.warn('Continuing login despite session save failure - using token authentication');
      }

      // Log user login activity
      try {
        await logActivity({
          businessId: user.businessId,
          userId: user.id,
          activityType: 'user_login',
          description: `User ${user.email} logged in`,
          entityType: 'user',
          entityId: user.id,
          metadata: {
            email: user.email,
            username: user.username,
            role: user.role,
            loginTime: new Date().toISOString()
          }
        });
      } catch (activityError) {
        console.error("Error logging login activity:", activityError);
        // Don't fail login if activity logging fails
      }

      // Return user info (without password)
      const { password: _, ...userInfo } = user;

      // Set a header to indicate successful login
      res.setHeader('X-Auth-Success', 'true');
      if (authToken) {
        res.setHeader('X-Auth-Token', authToken);
      }

      return res.status(200).json({ user: userInfo });
    } catch (error) {
      console.error("=== LOGIN ERROR CAUGHT ===");
      console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error cause:", error.cause);
      }
      
      // Log the full error object
      console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Return more detailed error in development
      const isDevelopment = process.env.NODE_ENV === "development";
      return res.status(500).json({ 
        message: "An error occurred during login",
        ...(isDevelopment && {
          error: errorMessage,
          stack: errorStack,
          type: error instanceof Error ? error.constructor.name : typeof error
        })
      });
    } finally {
      console.log("=== LOGIN REQUEST END ===");
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // userId is set by isAuthenticated middleware from either session or token
      const userId = req.session.userId as number;
      const businessId = req.session.businessId as number;
      console.log(`/api/auth/me - Processing for userId: ${userId}, businessId: ${businessId}`);

      if (!businessId) {
        return res.status(401).json({ message: "Business context not found" });
      }

      const user = await storage.getUser(userId, businessId);

      if (!user) {
        console.log(`/api/auth/me - User not found for userId: ${userId}`);
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }

      // Don't return password
      const { password, ...userInfo } = user;

      console.log(`/api/auth/me - Successfully returned user info for: ${user.username}`);
      return res.status(200).json(userInfo);
    } catch (error) {
      console.error("Error fetching current user:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });

  // Update user profile
  app.put("/api/auth/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fullName, email, avatarUrl } = req.body;

      // Only allow updating specific fields
      const updateData: Partial<InsertUser> = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      // Get businessId from session
      const businessId = req.session.businessId as number;
      
      // Add activity logging for profile update
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'profile_update',
        description: `User updated their profile`,
        entityType: 'user',
        entityId: userId,
        metadata: {
          ...updateData // Include the fields that were updated
        }
      });

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return password
      const { password, ...userInfo } = updatedUser;

      return res.json({
        message: "Profile updated successfully",
        user: userInfo
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update notification preferences
  app.post("/api/auth/notification-preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { taskNotifications, messageNotifications, jobNotifications } = req.body;

      // Only allow updating specific fields
      const updateData: Partial<InsertUser> = {};
      if (taskNotifications !== undefined) updateData.taskNotifications = taskNotifications;
      if (messageNotifications !== undefined) updateData.messageNotifications = messageNotifications;
      if (jobNotifications !== undefined) updateData.jobNotifications = jobNotifications;

      // Get businessId from session
      const businessId = req.session.businessId as number;
      
      // Add activity logging for notification preference update
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'notification_preferences_update',
        description: `User updated notification preferences`,
        entityType: 'user',
        entityId: userId,
        metadata: {
          taskNotifications,
          messageNotifications,
          jobNotifications
        }
      });

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return password
      const { password, ...userInfo } = updatedUser;

      return res.json({
        message: "Notification preferences updated successfully",
        user: userInfo
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Dismiss getting started page
  app.post("/api/auth/dismiss-getting-started", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get businessId from session
      const businessId = req.session.businessId as number;
      
      // Update user to set dismissal timestamp
      const updateData: Partial<InsertUser> = {
        gettingStartedDismissedAt: new Date().toISOString()
      };

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return password
      const { password, ...userInfo } = updatedUser;

      return res.json({
        message: "Getting started page dismissed successfully",
        user: userInfo
      });
    } catch (error) {
      console.error('Error dismissing getting started:', error);
      return res.status(500).json({ message: "Failed to dismiss getting started page" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: "Current password and new password are required"
        });
      }

      // Get businessId from session
      const businessId = req.session.businessId as number;
      if (!businessId) {
        return res.status(401).json({ message: "Business context not found" });
      }

      // Verify current password
      const user = await storage.getUser(userId, businessId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPasswordValid = await verifyPassword(currentPassword, user.password);

      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash and update the new password
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword
        // updatedAt field is handled by the storage layer
      });

      // Add activity logging for password change (businessId already retrieved above)
      await logActivity({
        businessId: businessId,
        userId: userId,
        activityType: 'password_change',
        description: `User changed their password`,
        entityType: 'user',
        entityId: userId,
        metadata: {
          changeTime: new Date().toISOString()
        }
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      return res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error('Error changing password:', error);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Get all businesses (for registration/joining) - MASTER ONLY
  app.get("/api/auth/businesses", isMaster, async (req: Request, res: Response) => {
    try {
      const businesses = await storage.getAllBusinesses();
      return res.status(200).json(businesses);
    } catch (error) {
      console.error("Error fetching businesses:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });

  // Register endpoint (creates a user and optionally a business) - MASTER ONLY
  app.post("/api/auth/register", isMaster, async (req: Request, res: Response) => {
    try {
      const { username, password, email, fullName, requestedRole, businessName, businessId, createNewBusiness } = req.body;

      if (!username || !password || !email || !fullName) {
        return res.status(400).json({
          message: "Username, password, email, and full name are required"
        });
      }

      let finalBusinessId: number;

      // Handle business creation or joining
      if (createNewBusiness) {
        // Create a new business
        if (!businessName) {
          return res.status(400).json({
            message: "Business name is required when creating a new business"
          });
        }

        // Check if business name already exists
        const existingBusiness = await storage.getBusinessByName(businessName);
        if (existingBusiness) {
          return res.status(400).json({ message: "Business name already taken" });
        }

        // Create the business
        const newBusiness = await storage.createBusiness({
          name: businessName,
          email: email, // Use user's email as business email initially
        });

        finalBusinessId = newBusiness.id;
      } else {
        // Join existing business
        if (!businessId) {
          return res.status(400).json({
            message: "Business ID is required when joining an existing business"
          });
        }

        // Verify business exists
        const business = await storage.getBusiness(businessId);
        if (!business) {
          return res.status(404).json({ message: "Business not found" });
        }

        if (!business.isActive) {
          return res.status(400).json({ message: "Business is not active" });
        }

        finalBusinessId = businessId;
      }

      // Check if email already exists (email should be unique across all businesses and all users, active or inactive)
      const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      // Check if username already exists across all businesses (all users, active or inactive)
      const [existingUserByUsername] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password before storing
      const hashedPassword = await hashPassword(password);

      // Determine role: if creating new business, user becomes admin; otherwise use requested role
      const userRole = createNewBusiness ? "admin" : (requestedRole || "staff");

      // Create the user
      const userData: InsertUser = {
        username,
        password: hashedPassword,
        email,
        fullName,
        role: userRole,
        businessId: finalBusinessId,
        isActive: true // Activate the user immediately
      };
      
      const newUser = await storage.createUser(userData);

      // Log user creation
      await logActivity({
        businessId: finalBusinessId,
        userId: newUser.id, 
        activityType: 'user_registration',
        description: `New user registered: ${username}`,
        entityType: 'user',
        entityId: newUser.id,
        metadata: {
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          createdBusiness: createNewBusiness || false
        }
      });

      // Send a success response with business info
      return res.status(201).json({
        message: "Registration successful. Please log in.",
        businessId: finalBusinessId,
        businessName: createNewBusiness ? businessName : undefined
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "An error occurred during registration" });
    }
  });

  // Admin endpoints for handling registration requests

  // Get all registration requests (admin only)
  app.get("/api/auth/registration-requests", isAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId as number;
      const requests = await storage.getAllRegistrationRequests(businessId);
      // Don't return passwords
      const sanitizedRequests = requests.map(req => {
        const { password, ...rest } = req;
        return rest;
      });

      // Log retrieval of all registration requests
      await logActivity({
        businessId: businessId,
        userId: req.session.userId as number,
        activityType: 'view_registration_requests',
        description: `Admin viewed all registration requests`,
        entityType: 'registration_request',
        entityId: null,
        metadata: { count: sanitizedRequests.length }
      });

      return res.status(200).json(sanitizedRequests);
    } catch (error) {
      console.error("Error fetching registration requests:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });

  // Get pending registration requests (admin only)
  app.get("/api/auth/pending-registration-requests", isAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId as number;
      const requests = await storage.getPendingRegistrationRequests(businessId);
      // Don't return passwords
      const sanitizedRequests = requests.map(req => {
        const { password, ...rest } = req;
        return rest;
      });

      // Log retrieval of pending registration requests
      await logActivity({
        businessId: businessId,
        userId: req.session.userId as number,
        activityType: 'view_pending_registration_requests',
        description: `Admin viewed pending registration requests`,
        entityType: 'registration_request',
        entityId: null,
        metadata: { count: sanitizedRequests.length }
      });


      return res.status(200).json(sanitizedRequests);
    } catch (error) {
      console.error("Error fetching pending registration requests:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });

  // Approve registration request (admin only)
  app.post("/api/auth/approve-registration/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role, notes } = req.body;

      const registrationId = parseInt(id, 10);
      if (isNaN(registrationId)) {
        return res.status(400).json({ message: "Invalid registration ID" });
      }

      // Get registration request
      const request = await storage.getRegistrationRequest(registrationId);

      if (!request) {
        return res.status(404).json({ message: "Registration request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({
          message: "Registration request has already been processed"
        });
      }

      // Create the user
      const businessId = req.session.businessId as number;
      const userData: InsertUser = {
        username: request.username,
        password: request.password, // Already hashed during registration
        fullName: request.fullName,
        email: request.email,
        role: role || request.requestedRole || "staff", // Use requested role if no role provided
        businessId: businessId,
        isActive: true
      };

      const user = await storage.createUser(userData);

      // Update registration request status
      const reviewerId = req.session.userId as number;
      await storage.updateRegistrationRequestStatus(
        registrationId,
        "approved",
        reviewerId,
        notes
      );

      // Log registration approval
      await logActivity({
        businessId: businessId,
        userId: reviewerId,
        activityType: 'approve_registration',
        description: `Registration request for ${request.username} approved`,
        entityType: 'registration_request',
        entityId: registrationId,
        metadata: {
          userId: user.id,
          username: user.username,
          approvedBy: reviewerId,
          notes: notes || 'N/A'
        }
      });


      // Send email notification to the user
      try {
        await sendRegistrationApprovalEmail(
          request.email,
          request.fullName,
          request.username
        );
        console.log(`Approval email sent to ${request.email}`);
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
        // Continue with the response even if email fails
      }

      return res.status(200).json({
        message: "Registration request approved and user account created"
      });
    } catch (error) {
      console.error("Error approving registration:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });

  // Reject registration request (admin only)
  app.post("/api/auth/reject-registration/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const registrationId = parseInt(id, 10);
      if (isNaN(registrationId)) {
        return res.status(400).json({ message: "Invalid registration ID" });
      }

      // Get registration request
      const request = await storage.getRegistrationRequest(registrationId);

      if (!request) {
        return res.status(404).json({ message: "Registration request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({
          message: "Registration request has already been processed"
        });
      }

      // Update registration request status
      const reviewerId = req.session.userId as number;
      const businessId = req.session.businessId as number;
      await storage.updateRegistrationRequestStatus(
        registrationId,
        "rejected",
        reviewerId,
        notes
      );

      // Log registration rejection
      await logActivity({
        businessId: businessId,
        userId: reviewerId,
        activityType: 'reject_registration',
        description: `Registration request for ${request.username} rejected`,
        entityType: 'registration_request',
        entityId: registrationId,
        metadata: {
          rejectedBy: reviewerId,
          notes: notes || 'N/A'
        }
      });

      // Send email notification to the user
      try {
        await sendRegistrationRejectionEmail(
          request.email,
          request.fullName,
          notes || undefined  // Pass rejection reason if provided
        );
        console.log(`Rejection email sent to ${request.email}`);
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
        // Continue with the response even if email fails
      }

      return res.status(200).json({ message: "Registration request rejected" });
    } catch (error) {
      console.error("Error rejecting registration:", error);
      return res.status(500).json({ message: "An error occurred" });
    }
  });
};