import { Router, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { messageRepository } from "../repositories/messageRepository";
import { getBusinessIdFromRequest, getUserIdFromRequest } from "../utils/requestHelpers";
import { insertMessageSchema, messages, type Message } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { uploadPublicFile } from "../services/fileStorageService";
import { logActivity } from "../services/activityService";
import { storage } from "../storage";
import { sendSupportMessageNotificationEmail } from "../services/emailService";

const BOLTDOWN_SUPPORT_EMAIL = "matthew.moore.contact@gmail.com";

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
    // BoltDown support info (master user for support chat)
    this.router.get("/support-info", this.getSupportInfo);
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

  private async getSupportInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const masterUser = await storage.getUserByEmail(BOLTDOWN_SUPPORT_EMAIL);
      if (!masterUser) {
        return res.json({ masterUser: null });
      }
      res.json({
        masterUser: {
          id: masterUser.id,
          fullName: masterUser.fullName,
          avatarUrl: masterUser.avatarUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const role = (req.session as any)?.role as string | undefined;

      if (role === "master") {
        const { storage } = await import("../storage");
        const conversations = await storage.getSupportConversations(userId);
        return res.json(conversations);
      }

      const conversations = await messageRepository.getAllConversations(userId, businessId);
      const masterUser = await storage.getUserByEmail(BOLTDOWN_SUPPORT_EMAIL);
      if (masterUser && masterUser.id !== userId) {
        const hasSupportConv = conversations.some((c) => c.otherUser.id === masterUser.id);
        if (!hasSupportConv) {
          const supportConv = {
            otherUser: {
              id: masterUser.id,
              fullName: "BoltDown support",
              avatarUrl: masterUser.avatarUrl,
            },
            lastMessage: {
              id: 0,
              content: "Start a conversation with BoltDown support",
              createdAt: new Date().toISOString(),
              isRead: true,
            } as Message,
            unreadCount: 0,
          };
          conversations.unshift(supportConv);
        } else {
          const idx = conversations.findIndex((c) => c.otherUser.id === masterUser.id);
          if (idx >= 0) {
            const conv = conversations[idx];
            conversations.splice(idx, 1);
            conversations.unshift({ ...conv, otherUser: { ...conv.otherUser, fullName: "BoltDown support" } });
          }
        }
      }
      res.json(conversations);
    } catch (error) {
      next(error);
    }
  }

  private async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      let businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const otherUserId = Number(req.params.userId);
      const role = (req.session as any)?.role as string | undefined;
      const supportBusinessId = req.query.businessId ? Number(req.query.businessId) : undefined;

      if (!Number.isFinite(otherUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (role === "master" && supportBusinessId) {
        businessId = supportBusinessId;
      } else if (role === "master") {
        const otherUser = await storage.getUserById(otherUserId);
        if (otherUser) businessId = otherUser.businessId;
      }

      let messagesList: Message[];
      if (role === "master") {
        messagesList = await storage.getSupportConversation(userId, otherUserId);
      } else {
        messagesList = await messageRepository.getConversation(userId, otherUserId, businessId);
      }

      const enrichedMessages = await Promise.all(
        messagesList.map(async (msg) => {
          let sender = await storage.getUser(msg.senderId, msg.businessId);
          if (!sender) sender = await storage.getUserById(msg.senderId);
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
      let businessId = getBusinessIdFromRequest(req);
      const senderId = getUserIdFromRequest(req);
      const role = (req.session as any)?.role as string | undefined;

      const recipientId = req.body.recipientId;
      const threadId = req.body.threadId;
      const recipientIds = req.body.recipientIds;

      if (!recipientId && !threadId && (!recipientIds || recipientIds.length === 0)) {
        return res.status(400).json({
          message: "Either recipientId (direct message), threadId (existing group), or recipientIds (new group) is required",
        });
      }

      let finalThreadId = threadId;
      if (recipientIds && recipientIds.length > 0 && !threadId) {
        const thread = await storage.createThread({
          businessId,
          name: req.body.groupName || null,
          createdBy: senderId,
        }, recipientIds);
        finalThreadId = thread.id;
      }

      if (recipientId && !threadId && !recipientIds?.length) {
        const masterUser = await storage.getUserByEmail(BOLTDOWN_SUPPORT_EMAIL);
        const recipient = await storage.getUser(recipientId, businessId) ?? await storage.getUserById(recipientId);
        if (!recipient) {
          return res.status(404).json({ message: "Recipient not found" });
        }
        if (masterUser && recipient.id === masterUser.id) {
          businessId = businessId;
        } else if (role === "master" && recipient.role !== "master") {
          businessId = recipient.businessId;
        }
      }

      let attachedImageUrls: string[] | undefined = undefined;
      if (req.body.attachedImageUrls && Array.isArray(req.body.attachedImageUrls) && req.body.attachedImageUrls.length > 0) {
        attachedImageUrls = req.body.attachedImageUrls;
      }

      if (!req.body.content?.trim() && !attachedImageUrls && !req.body.attachedJobId && !req.body.attachedTaskId) {
        return res.status(400).json({
          message: "Message content or attachment is required",
        });
      }

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
      } catch (parseError) {
        if (parseError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid message data",
            errors: parseError.errors,
          });
        }
        throw parseError;
      }

      try {
        if (recipientId) {
          const masterUser = await storage.getUserByEmail(BOLTDOWN_SUPPORT_EMAIL);
          const recipient = await storage.getUser(recipientId, businessId) ?? (masterUser?.id === recipientId ? masterUser : await storage.getUserById(recipientId));
          if (!recipient) {
            return res.status(404).json({
              message: "Recipient not found or does not belong to your business",
            });
          }
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
      
      if (recipientId && !message.threadId) {
        const masterUser = await storage.getUserByEmail(BOLTDOWN_SUPPORT_EMAIL);
        if (masterUser && message.recipientId === masterUser.id) {
          const sender = await storage.getUserById(senderId);
          try {
            await sendSupportMessageNotificationEmail({
              to: BOLTDOWN_SUPPORT_EMAIL,
              senderName: sender?.fullName ?? "Unknown",
              senderEmail: sender?.email ?? "N/A",
              senderBusinessId: message.businessId,
              content: message.content,
              sentAt: message.createdAt,
            });
          } catch (emailErr) {
            console.error("Failed to send support notification email:", emailErr);
          }
        }
      }

      try {
        const activityDescription = message.threadId 
          ? `Sent group message to thread ${message.threadId}`
          : `Sent message to user ${message.recipientId}`;
        await logActivity({
          businessId: message.businessId,
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
        // Type guard to ensure file has required properties
        if (!file || typeof file !== 'object' || !('buffer' in file) || !('mimetype' in file)) {
          return res.status(400).json({ message: "Invalid file object" });
        }
        
        const contentType = (typeof file.mimetype === 'string' ? file.mimetype : "image/png");
        
        if (!allowedTypes.includes(contentType)) {
          return res.status(400).json({ 
            message: `Invalid file type: ${contentType}. Allowed types: ${allowedTypes.join(", ")}` 
          });
        }

        // Validate file size (max 10MB per file)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const originalname = typeof file.originalname === 'string' ? file.originalname : 'image';
        const fileSize = typeof file.size === 'number' ? file.size : 0;
        if (fileSize > maxSize) {
          return res.status(400).json({ message: `File ${originalname} exceeds 10MB limit` });
        }

        const fileBuffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer as any);
        const imageUrl = await uploadPublicFile(fileBuffer, contentType, {
          businessId,
          folder: "message-images",
          filename: originalname,
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
      let businessId = getBusinessIdFromRequest(req);
      const userId = getUserIdFromRequest(req);
      const otherUserId = Number(req.params.userId);
      const role = (req.session as any)?.role as string | undefined;
      const supportBusinessId = req.query.businessId ? Number(req.query.businessId) : undefined;

      if (!Number.isFinite(otherUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (role === "master" && supportBusinessId) {
        businessId = supportBusinessId;
      } else if (role === "master") {
        const otherUser = await storage.getUserById(otherUserId);
        if (otherUser) businessId = otherUser.businessId;
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

