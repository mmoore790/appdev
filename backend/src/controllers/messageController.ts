import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { messageRepository } from "../repositories/messageRepository";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "../utils/requestHelpers";
import { insertMessageSchema, messages, type Message } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { uploadPublicFile } from "../services/fileStorageService";
import { logActivity } from "../services/activityService";

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5, // Max 5 files at once
  },
});

export class MessageController {
  public readonly router = Router();

  constructor() {
    this.router.use(isAuthenticated);

    // IMPORTANT: More specific routes must come before generic :id routes
    // Get all conversations for current user
    this.router.get("/conversations", this.getConversations);
    
          // Group/Thread routes
          this.router.post("/groups", this.createGroup);
          this.router.get("/groups", this.getUserGroups);
          this.router.get("/groups/:threadId", this.getGroupConversation);
          this.router.put("/groups/:threadId", this.updateGroup);
          this.router.put("/groups/:threadId/read", this.markGroupAsRead);
          this.router.get("/groups/:threadId/participants", this.getGroupParticipants);
    
    // Mark entire conversation as read (must come before /:id routes)
    this.router.put("/conversation/:userId/read", this.markConversationAsRead);
    
    // Get conversation with a specific user (must come before /:id routes)
    this.router.get("/conversation/:userId", this.getConversation);
    
    // Upload images for a message (must come before /:id routes)
    this.router.post("/images", upload.array("images", 5), this.uploadImages);
    
    // Create a new message
    this.router.post("/", this.createMessage);
    
    // Mark message as read
    this.router.put("/:id/read", this.markAsRead);
    
    // Delete a message
    this.router.delete("/:id", this.deleteMessage);
    
    // Get a specific message (must be last as it's a catch-all for numeric IDs)
    this.router.get("/:id", this.getMessage);
  }

  private async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      
      console.log(`[MessageController] getConversations - userId: ${userId}, businessId: ${businessId}`);
      const conversations = await messageRepository.getAllConversations(userId, businessId);
      console.log(`[MessageController] getConversations - Returning ${conversations.length} conversations for userId ${userId}`);
      
      res.json(conversations);
    } catch (error) {
      next(error);
    }
  }

  private async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const otherUserId = Number(req.params.userId);
      
      console.log('getConversation called with path:', req.path);
      console.log('getConversation params:', req.params);
      
      if (!Number.isFinite(otherUserId)) {
        console.error('Invalid user ID in getConversation:', req.params.userId);
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      console.log('Fetching conversation:', { userId, otherUserId, businessId });
      const messages = await messageRepository.getConversation(userId, otherUserId, businessId);
      console.log(`Found ${messages.length} messages in conversation`);
      
      // Enrich messages with sender information
      const { storage } = await import("../storage");
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId, businessId);
          return {
            ...msg,
            sender: sender ? {
              id: sender.id,
              fullName: sender.fullName,
              avatarUrl: sender.avatarUrl,
            } : undefined,
          };
        })
      );
      
      res.json(enrichedMessages);
    } catch (error) {
      console.error('Error in getConversation:', error);
      next(error);
    }
  }

  private async getMessage(req: Request, res: Response, next: NextFunction) {
    try {
      // Check if this is actually a conversation route that was misrouted
      const path = req.path;
      if (path.includes('/conversation/')) {
        console.error('getMessage was called for conversation route:', path);
        return res.status(400).json({ 
          message: "Route conflict detected. Use /conversation/:userId instead" 
        });
      }
      
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }
      
      const message = await messageRepository.findById(id, businessId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json(message);
    } catch (error) {
      next(error);
    }
  }

  private async createMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const senderId = getUserIdFromRequest(req);
      
      console.log('Creating message with data:', {
        businessId,
        senderId,
        body: req.body,
      });
      
      // Support both single recipient and group (threadId)
      const recipientId = req.body.recipientId;
      const threadId = req.body.threadId;
      const recipientIds = req.body.recipientIds; // For creating new group
      
      // Validate: either recipientId (direct) or threadId (group) or recipientIds (new group) must be provided
      if (!recipientId && !threadId && (!recipientIds || recipientIds.length === 0)) {
        return res.status(400).json({
          message: "Either recipientId (direct message), threadId (existing group), or recipientIds (new group) is required",
        });
      }
      
      // If creating a new group, create the thread first
      let finalThreadId = threadId;
      if (recipientIds && recipientIds.length > 0 && !threadId) {
        const { storage } = await import("../storage");
        // Create new thread
        const thread = await storage.createThread({
          businessId,
          name: req.body.groupName || null,
          createdBy: senderId,
        }, recipientIds);
        finalThreadId = thread.id;
        console.log('Created new thread:', finalThreadId);
      }
      
      // Normalize attachedImageUrls - ensure it's an array or undefined
      let attachedImageUrls: string[] | undefined = undefined;
      if (req.body.attachedImageUrls) {
        if (Array.isArray(req.body.attachedImageUrls) && req.body.attachedImageUrls.length > 0) {
          attachedImageUrls = req.body.attachedImageUrls;
        }
      }
      
      // Validate content is provided (or at least one attachment)
      if (!req.body.content?.trim() && !attachedImageUrls && !req.body.attachedJobId && !req.body.attachedTaskId) {
        return res.status(400).json({
          message: "Message content or attachment is required",
        });
      }
      
      // Ensure content is not empty string
      const content = req.body.content?.trim() || '(No text message)';
      
      let data;
      try {
        data = insertMessageSchema.parse({
          ...req.body,
          content,
          attachedImageUrls,
          businessId,
          senderId,
        });
        console.log('Parsed message data:', data);
      } catch (parseError) {
        console.error('Schema validation error:', parseError);
        if (parseError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid message data",
            errors: parseError.errors,
          });
        }
        throw parseError;
      }
      
      // Verify recipient (for direct) or thread participation (for group)
      try {
        const { storage } = await import("../storage");
        if (recipientId) {
          // Direct message - verify recipient
          const recipient = await storage.getUser(recipientId, businessId);
          if (!recipient) {
            return res.status(404).json({
              message: "Recipient not found or does not belong to your business",
            });
          }
          console.log('Recipient verified:', recipientId);
        } else if (finalThreadId) {
          // Group message - verify user is participant
          const participants = await storage.getThreadParticipants(finalThreadId, businessId);
          const isParticipant = participants.some(p => p.id === senderId);
          if (!isParticipant) {
            return res.status(403).json({
              message: "You are not a participant in this group conversation",
            });
          }
          console.log('User verified as participant in thread:', finalThreadId);
        }
      } catch (verifyError) {
        console.error('Error verifying recipient/thread:', verifyError);
        return res.status(500).json({
          message: "Error verifying recipient or thread",
          error: process.env.NODE_ENV === "development" ? String(verifyError) : undefined,
        });
      }
      
      // Create message
      let message: Message;
      try {
        const messageData = {
          ...data,
          recipientId: recipientId || null, // null for group messages
          threadId: finalThreadId || undefined,
        };
        message = await messageRepository.create(messageData);
        console.log('Message created successfully:', {
          id: message.id,
          senderId: message.senderId,
          recipientId: message.recipientId,
          threadId: message.threadId,
          businessId: message.businessId,
        });
      } catch (createError: any) {
        console.error('Error creating message in database:', createError);
        if (createError instanceof Error) {
          console.error('Create error message:', createError.message);
          console.error('Create error stack:', createError.stack);
        }
        // Include database error details if available
        const errorMessage = createError?.message || "Failed to create message";
        const errorDetails = process.env.NODE_ENV === "development" ? {
          error: String(createError),
          code: createError?.code,
          detail: createError?.detail,
          constraint: createError?.constraint,
        } : undefined;
        
        return res.status(500).json({
          message: errorMessage,
          ...errorDetails,
        });
      }
      
      // Log activity (don't fail if this fails)
      try {
        const activityDescription = message.threadId 
          ? `Sent group message to thread ${message.threadId}`
          : `Sent message to user ${message.recipientId}`;
        await logActivity({
          businessId,
          userId: senderId,
          activityType: "message_sent",
          description: activityDescription,
          entityType: "message",
          entityId: message.id,
        });
      } catch (activityError) {
        console.error('Error logging activity (non-fatal):', activityError);
        // Continue even if activity logging fails
      }
      
      // Return the created message
      console.log('Returning created message:', {
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        threadId: message.threadId,
        businessId: message.businessId,
      });
      res.status(201).json(message);
    } catch (error) {
      console.error('Unexpected error creating message:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        return res.status(400).json({
          message: "Invalid message data",
          errors: error.errors,
        });
      }
      // Log full error details for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return res.status(500).json({
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? String(error) : undefined,
      });
    }
  }

  private async uploadImages(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({ message: "At least one image file is required" });
      }

      const files = Array.isArray(req.files) ? req.files : [req.files];
      
      // Validate file types
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      const uploadedUrls: string[] = [];
      
      for (const file of files) {
        const contentType = file.mimetype || "image/png";
        
        if (!allowedTypes.includes(contentType)) {
          return res.status(400).json({ 
            message: `Invalid file type: ${contentType}. Allowed types: ${allowedTypes.join(", ")}` 
          });
        }

        // Validate file size (max 10MB per file)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          return res.status(400).json({ message: `File ${file.originalname} exceeds 10MB limit` });
        }

        const fileBuffer = file.buffer;
        const imageUrl = await uploadPublicFile(fileBuffer, contentType, {
          businessId,
          folder: "message-images",
          filename: file.originalname,
        });
        
        uploadedUrls.push(imageUrl);
      }

      res.json({ imageUrls: uploadedUrls });
    } catch (error: any) {
      console.error("Image upload error:", error);
      return res.status(500).json({ 
        message: error.message || "Failed to upload images",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  }

  private async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const id = Number(req.params.id);
      
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }
      
      const message = await messageRepository.markAsRead(id, userId, businessId);
      if (!message) {
        return res.status(404).json({ message: "Message not found or already read" });
      }
      
      res.json(message);
    } catch (error) {
      next(error);
    }
  }

  private async markConversationAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const otherUserId = Number(req.params.userId);
      
      if (!Number.isFinite(otherUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const count = await messageRepository.markConversationAsRead(userId, otherUserId, businessId);
      res.json({ markedAsRead: count });
    } catch (error) {
      next(error);
    }
  }

  private async deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const id = Number(req.params.id);
      
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }
      
      const deleted = await messageRepository.delete(id, userId, businessId);
      if (!deleted) {
        return res.status(404).json({ message: "Message not found or unauthorized" });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Group/Thread operations
  private async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('createGroup called with body:', req.body);
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const { name, participantIds } = req.body;

      console.log('createGroup - businessId:', businessId, 'userId:', userId, 'participantIds:', participantIds);

      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        console.log('createGroup - validation failed: no participants');
        return res.status(400).json({ message: "At least one participant is required" });
      }

      // Validate all participants exist and belong to same business
      const { storage } = await import("../storage");
      for (const participantId of participantIds) {
        const participant = await storage.getUser(participantId, businessId);
        if (!participant) {
          return res.status(404).json({ 
            message: `Participant ${participantId} not found or does not belong to your business` 
          });
        }
      }

      // Create thread
      const thread = await storage.createThread({
        businessId,
        name: name || null,
        createdBy: userId,
      }, participantIds);

      // Log activity
      await logActivity({
        businessId,
        userId,
        activityType: "group_created",
        description: `Created group conversation with ${participantIds.length} participant(s)`,
        entityType: "message_thread",
        entityId: thread.id,
      });

      res.status(201).json(thread);
    } catch (error) {
      next(error);
    }
  }

  private async getUserGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      
      console.log('getUserGroups called - userId:', userId, 'businessId:', businessId);
      const groups = await messageRepository.getUserThreads(userId, businessId);
      console.log('getUserGroups returning:', groups.length, 'groups');
      res.json(groups);
    } catch (error) {
      console.error('Error in getUserGroups:', error);
      next(error);
    }
  }

  private async getGroupConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const threadId = Number(req.params.threadId);
      
      if (!Number.isFinite(threadId)) {
        return res.status(400).json({ message: "Invalid thread ID" });
      }
      
      const messages = await messageRepository.getGroupConversation(threadId, userId, businessId);
      
      // Enrich messages with sender information
      const { storage } = await import("../storage");
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId, businessId);
          return {
            ...msg,
            sender: sender ? {
              id: sender.id,
              fullName: sender.fullName,
              avatarUrl: sender.avatarUrl,
            } : undefined,
          };
        })
      );
      
      res.json(enrichedMessages);
    } catch (error) {
      next(error);
    }
  }

  private async markGroupAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const threadId = Number(req.params.threadId);
      
      if (!Number.isFinite(threadId)) {
        return res.status(400).json({ message: "Invalid thread ID" });
      }
      
      const count = await messageRepository.markGroupConversationAsRead(threadId, userId, businessId);
      res.json({ markedAsRead: count });
    } catch (error) {
      next(error);
    }
  }

  private async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const threadId = Number(req.params.threadId);
      const { name } = req.body;

      if (!Number.isFinite(threadId)) {
        return res.status(400).json({ message: "Invalid thread ID" });
      }

      // Verify user is a participant
      const { storage } = await import("../storage");
      const participants = await storage.getThreadParticipants(threadId, businessId);
      const isParticipant = participants.some(p => p.id === userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this group" });
      }

      // Update thread
      const updated = await messageRepository.updateThread(threadId, businessId, { name: name || null });
      if (!updated) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Log activity
      await logActivity({
        businessId,
        userId,
        activityType: "group_updated",
        description: `Renamed group conversation`,
        entityType: "message_thread",
        entityId: threadId,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error in updateGroup:', error);
      next(error);
    }
  }

  private async getGroupParticipants(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const threadId = Number(req.params.threadId);
      
      if (!Number.isFinite(threadId)) {
        return res.status(400).json({ message: "Invalid thread ID" });
      }
      
      const { storage } = await import("../storage");
      const participants = await storage.getThreadParticipants(threadId, businessId);
      console.log(`getGroupParticipants: Found ${participants.length} participants for thread ${threadId}`);
      res.json(participants);
    } catch (error) {
      next(error);
    }
  }
}

export const messageController = new MessageController();

