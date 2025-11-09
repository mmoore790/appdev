import { NextFunction, Request, Response } from "express";
import { storage } from "./storage";
import * as bcrypt from 'bcryptjs';
import { InsertRegistrationRequest, InsertUser } from "@shared/schema";
import { tokenStorage } from "./tokenStorage";
import {
  sendRegistrationApprovalEmail,
  sendRegistrationRejectionEmail
} from "./services/emailService";
import { logActivity } from "./services/activityService";


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
    const tokenData = tokenStorage.validateToken(token);

    if (tokenData) {
      // Valid token - use it to set session data for this request
      console.log(`User authenticated via token: userId=${tokenData.userId}, role=${tokenData.role}`);
      req.session.userId = tokenData.userId;
      req.session.role = tokenData.role;
      return next();
    }
  }

  // Check for token in query param (backup method)
  const queryToken = req.query.token as string;
  if (queryToken) {
    const tokenData = tokenStorage.validateToken(queryToken);

    if (tokenData) {
      // Valid token - use it to set session data for this request
      console.log(`User authenticated via query token: userId=${tokenData.userId}, role=${tokenData.role}`);
      req.session.userId = tokenData.userId;
      req.session.role = tokenData.role;
      return next();
    }
  }

  // Check what authentication methods were attempted
  const hasAuthHeader = req.headers.authorization ? 'Yes' : 'No';
  const hasQueryToken = req.query.token ? 'Yes' : 'No';
  const hasSessionData = req.session ? 'Yes' : 'No';

  console.log(`Authentication failed: No valid session or token found.
    Auth header present: ${hasAuthHeader}
    Query token present: ${hasQueryToken}
    Session exists: ${hasSessionData}
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
  const user = await storage.getUser(userId);

  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
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
  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      console.log(`Login attempt for username: ${username}`);
      const user = await storage.getUserByUsername(username);

      if (!user) {
        console.log(`User not found: ${username}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if is_active is false (only if the column exists and is defined)
      if (user.isActive === false) {
        console.log(`User account inactive: ${username}`);
        return res.status(403).json({ message: "Account is inactive" });
      }

      // For debugging, log the hashed password from DB
      console.log(`Stored password hash: ${user.password.substring(0, 10)}...`);

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

      // Debug session data
      console.log(`Setting session data: userId=${user.id}, role=${user.role}`);
      console.log('Session ID:', req.sessionID);
      console.log('Session BEFORE save:', req.session);

      // Generate auth token as fallback for session issues
      const authToken = tokenStorage.generateToken(user.id, user.role);
      console.log(`Generated auth token for user ${user.id}`);

      // Force session save with promise-based approach
      await new Promise<void>((resolve, reject) => {
        req.session.save(err => {
          if (err) {
            console.error('Session save error:', err);
            reject(err);
          } else {
            console.log('Session AFTER save:', req.session);
            console.log(`User logged in successfully: ${username}, id: ${user.id}, role: ${user.role}`);
            resolve();
          }
        });
      });

      // Log user login activity
      try {
        await logActivity({
          userId: user.id,
          activityType: 'user_login',
          description: `User ${user.username} logged in`,
          entityType: 'user',
          entityId: user.id,
          metadata: {
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
      res.setHeader('X-Auth-Token', authToken);

      return res.status(200).json({ user: userInfo });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "An error occurred during login" });
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
      console.log(`/api/auth/me - Processing for userId: ${userId}`);

      const user = await storage.getUser(userId);

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

      // Add activity logging for profile update
      await logActivity({
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

      // Add activity logging for notification preference update
      await logActivity({
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

      // Verify current password
      const user = await storage.getUser(userId);

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

      // Add activity logging for password change
      await logActivity({
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

  // Register endpoint (creates a user directly)
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, email, fullName, requestedRole } = req.body;

      if (!username || !password || !email || !fullName) {
        return res.status(400).json({
          message: "Username, password, email, and full name are required"
        });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password before storing
      const hashedPassword = await hashPassword(password);

      // Create the user directly
      const userData: InsertUser = {
        username,
        password: hashedPassword,
        email,
        fullName,
        role: requestedRole || "staff", // Default to "staff"
        isActive: true // Activate the user immediately
      };
      
      const newUser = await storage.createUser(userData);

      // Log user creation
      await logActivity({
        userId: null, 
        activityType: 'user_registration',
        description: `New user registered: ${username}`,
        entityType: 'user',
        entityId: newUser.id,
        metadata: {
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }
      });

      // Send a success response. The frontend will handle the redirect.
      return res.status(201).json({
        message: "Registration successful. Please log in."
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
      const requests = await storage.getAllRegistrationRequests();
      // Don't return passwords
      const sanitizedRequests = requests.map(req => {
        const { password, ...rest } = req;
        return rest;
      });

      // Log retrieval of all registration requests
      await logActivity({
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
      const requests = await storage.getPendingRegistrationRequests();
      // Don't return passwords
      const sanitizedRequests = requests.map(req => {
        const { password, ...rest } = req;
        return rest;
      });

      // Log retrieval of pending registration requests
      await logActivity({
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
      const userData: InsertUser = {
        username: request.username,
        password: request.password, // Already hashed during registration
        fullName: request.fullName,
        email: request.email,
        role: role || request.requestedRole || "staff", // Use requested role if no role provided
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
      await storage.updateRegistrationRequestStatus(
        registrationId,
        "rejected",
        reviewerId,
        notes
      );

      // Log registration rejection
      await logActivity({
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