import { Router, Request, Response, NextFunction } from "express";
import { insertOrderSchema, insertOrderItemSchema } from "@shared/schema";
import { orderService, ORDER_STATUSES } from "../services/domains/orderService";
import { isAuthenticated } from "../auth";
import { getBusinessIdFromRequest } from "../utils/requestHelpers";
import { z } from "zod";

function formatOrder(order: any) {
  if (!order) return order;
  return {
    ...order,
    estimatedTotalCost: order.estimatedTotalCost != null ? order.estimatedTotalCost / 100 : null,
    actualTotalCost: order.actualTotalCost != null ? order.actualTotalCost / 100 : null,
    depositAmount: order.depositAmount != null ? order.depositAmount / 100 : null,
  };
}

function formatOrderItem(item: any) {
  if (!item) return item;
  return {
    ...item,
    unitPrice: item.unitPrice != null ? item.unitPrice / 100 : null,
    priceExcludingVat: item.priceExcludingVat != null ? item.priceExcludingVat / 100 : null,
    priceIncludingVat: item.priceIncludingVat != null ? item.priceIncludingVat / 100 : null,
    totalPrice: item.totalPrice != null ? item.totalPrice / 100 : null,
  };
}

const updateOrderStatusSchema = z.object({
  status: z.enum([
    ORDER_STATUSES.NOT_ORDERED,
    ORDER_STATUSES.ORDERED,
    ORDER_STATUSES.ARRIVED,
    ORDER_STATUSES.COMPLETED,
  ]),
  changeReason: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  notifyOnArrival: z.boolean().optional(),
});

export class OrderController {
  public readonly router = Router();

  constructor() {
    this.router.get("/", isAuthenticated, this.listOrders);
    this.router.get("/status/:status", isAuthenticated, this.listOrdersByStatus);
    this.router.get("/customer/:customerId", isAuthenticated, this.listOrdersByCustomer);
    this.router.get("/job/:jobId", isAuthenticated, this.listOrdersByJob);
    this.router.get("/search", isAuthenticated, this.searchOrders);
    this.router.get("/:id", isAuthenticated, this.getOrder);
    this.router.get("/:id/items", isAuthenticated, this.getOrderItems);
    this.router.get("/:id/history", isAuthenticated, this.getOrderStatusHistory);
    this.router.post("/", isAuthenticated, this.createOrder);
    this.router.put("/:id", isAuthenticated, this.updateOrder);
    this.router.post("/:id/status", isAuthenticated, this.updateOrderStatus);
    this.router.post("/:id/items", isAuthenticated, this.addOrderItem);
    this.router.put("/:id/items/:itemId", isAuthenticated, this.updateOrderItem);
    this.router.delete("/:id/items/:itemId", isAuthenticated, this.deleteOrderItem);
    this.router.post("/:id/notify", isAuthenticated, this.sendCustomerNotification);
    this.router.delete("/:id", isAuthenticated, this.deleteOrder);
  }

  private async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      const limit = req.query.limit ? Math.min(25, Math.max(1, Number(req.query.limit))) : 25;
      const offset = (page - 1) * limit;
      
      const [orders, totalCount] = await Promise.all([
        orderService.listOrders(businessId, limit, offset),
        orderService.countOrders(businessId),
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        data: orders.map(formatOrder),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async listOrdersByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const status = req.params.status;
      const orders = await orderService.listOrdersByStatus(status, businessId);
      res.json(orders.map(formatOrder));
    } catch (error) {
      next(error);
    }
  }

  private async listOrdersByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const customerId = Number(req.params.customerId);
      if (Number.isNaN(customerId)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }

      const orders = await orderService.listOrdersByCustomer(customerId, businessId);
      res.json(orders.map(formatOrder));
    } catch (error) {
      next(error);
    }
  }

  private async listOrdersByJob(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const jobId = Number(req.params.jobId);
      if (Number.isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      const orders = await orderService.listOrdersByJob(jobId, businessId);
      res.json(orders.map(formatOrder));
    } catch (error) {
      next(error);
    }
  }

  private async searchOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const orders = await orderService.searchOrders(businessId, query);
      res.json(orders.map(formatOrder));
    } catch (error) {
      next(error);
    }
  }

  private async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const order = await orderService.getOrderById(id, businessId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(formatOrder(order));
    } catch (error) {
      next(error);
    }
  }

  private async getOrderItems(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const items = await orderService.getOrderItems(id, businessId);
      res.json(items.map(formatOrderItem));
    } catch (error) {
      next(error);
    }
  }

  private async getOrderStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const history = await orderService.getOrderStatusHistory(id, businessId);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  private async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const actorId = (req.session as any)?.userId;
      
      const { items, ...orderData } = req.body;
      
      // Clean up customerEmail - convert empty strings to undefined
      const cleanedCustomerEmail = orderData.customerEmail && orderData.customerEmail.trim() !== "" 
        ? orderData.customerEmail.trim() 
        : undefined;

      // Provide defaults for fields that have them
      const orderDataWithDefaults: any = {
        ...orderData,
        businessId,
        createdBy: actorId,
        customerEmail: cleanedCustomerEmail, // Use cleaned email
        status: orderData.status || "not_ordered",
        notifyOnOrderPlaced: orderData.notifyOnOrderPlaced !== undefined ? orderData.notifyOnOrderPlaced : true,
        notifyOnStatusChange: false, // Disabled - only notify on order placed and arrival
        notifyOnArrival: orderData.notifyOnArrival !== undefined ? orderData.notifyOnArrival : true,
        notificationMethod: orderData.notificationMethod || "email",
      };

      // Log email notification settings for debugging
      console.log("📧 Order email notification settings:");
      console.log(`   Customer Email: ${cleanedCustomerEmail || '(not provided)'}`);
      console.log(`   Notify on Order Placed: ${orderDataWithDefaults.notifyOnOrderPlaced}`);
      console.log(`   Notify on Arrival: ${orderDataWithDefaults.notifyOnArrival}`);
      console.log(`   Notification Method: ${orderDataWithDefaults.notificationMethod}`);
      
      // Handle orderDate - convert date string to ISO timestamp if provided
      // If not provided, don't include it (server will use default)
      if (orderData.orderDate && orderData.orderDate.trim() !== "") {
        // If it's a date string (YYYY-MM-DD), convert to ISO timestamp
        if (orderData.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          orderDataWithDefaults.orderDate = new Date(orderData.orderDate + 'T00:00:00').toISOString();
        } else {
          orderDataWithDefaults.orderDate = orderData.orderDate;
        }
      }
      // If orderDate is not provided or empty, don't include it - server will use default
      
      // Handle expectedDeliveryDate similarly
      if (orderData.expectedDeliveryDate) {
        if (orderData.expectedDeliveryDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          orderDataWithDefaults.expectedDeliveryDate = new Date(orderData.expectedDeliveryDate + 'T00:00:00').toISOString();
        } else {
          orderDataWithDefaults.expectedDeliveryDate = orderData.expectedDeliveryDate;
        }
      }
      
      console.log("Order data with defaults:", JSON.stringify(orderDataWithDefaults, null, 2));
      
      const validatedOrder = insertOrderSchema.parse(orderDataWithDefaults);

      // Validate items and add businessId (orderId will be added after order creation)
      const validatedItems = items 
        ? items.map((item: any, index: number) => {
            const itemWithBusinessId: any = {
              itemName: item.itemName,
              itemType: item.itemType,
              quantity: item.quantity || 1,
              businessId, // Add businessId for validation
              // orderId will be added by the service after order is created
            };
            
            // Only include optional fields if they exist
            if (item.itemSku) itemWithBusinessId.itemSku = item.itemSku;
            if (item.itemCategory) itemWithBusinessId.itemCategory = item.itemCategory;
            if (item.unitPrice !== undefined) itemWithBusinessId.unitPrice = item.unitPrice;
            if (item.priceExcludingVat !== undefined) itemWithBusinessId.priceExcludingVat = item.priceExcludingVat;
            if (item.priceIncludingVat !== undefined) itemWithBusinessId.priceIncludingVat = item.priceIncludingVat;
            if (item.totalPrice !== undefined) itemWithBusinessId.totalPrice = item.totalPrice;
            if (item.supplierName) itemWithBusinessId.supplierName = item.supplierName;
            if (item.supplierSku) itemWithBusinessId.supplierSku = item.supplierSku;
            if (item.notes) itemWithBusinessId.notes = item.notes;
            
            try {
              return insertOrderItemSchema.parse(itemWithBusinessId);
            } catch (itemError) {
              console.error(`Error validating item ${index}:`, itemError);
              console.error("Item data:", JSON.stringify(itemWithBusinessId, null, 2));
              throw itemError;
            }
          })
        : undefined;

      const order = await orderService.createOrder(
        validatedOrder,
        validatedItems
      );
      
      res.status(201).json(formatOrder(order));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Order validation error:", JSON.stringify(error.errors, null, 2));
        console.error("Order data received:", JSON.stringify(req.body, null, 2));
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  }

  private async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const actorId = (req.session as any)?.userId;
      const order = await orderService.updateOrder(id, {
        ...req.body,
        updatedBy: actorId,
      }, businessId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(formatOrder(order));
    } catch (error) {
      next(error);
    }
  }

  private async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const actorId = (req.session as any)?.userId;
      const validated = updateOrderStatusSchema.parse(req.body);

      // Pass notifyOnArrival directly to updateOrderStatus so it can use the value from the request
      const order = await orderService.updateOrderStatus(
        id,
        validated.status,
        actorId,
        businessId,
        validated.changeReason,
        validated.notes,
        validated.metadata,
        validated.notifyOnArrival // Pass the notifyOnArrival value from the request
      );

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(formatOrder(order));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  }

  private async addOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const orderId = Number(req.params.id);
      if (Number.isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const validated = insertOrderItemSchema.parse(req.body);
      const item = await orderService.addOrderItem(orderId, validated, businessId);
      
      res.status(201).json(formatOrderItem(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      if (error instanceof Error && error.message === 'Order not found') {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }

  private async updateOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const itemId = Number(req.params.itemId);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const item = await orderService.updateOrderItem(itemId, req.body, businessId);
      if (!item) {
        return res.status(404).json({ message: "Order item not found" });
      }

      res.json(formatOrderItem(item));
    } catch (error) {
      next(error);
    }
  }

  private async deleteOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const itemId = Number(req.params.itemId);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const deleted = await orderService.deleteOrderItem(itemId, businessId);
      if (!deleted) {
        return res.status(404).json({ message: "Order item not found" });
      }

      res.json({ message: "Order item deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  private async sendCustomerNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const notificationType = req.body.type as 'order_placed' | 'status_change' | 'arrived';
      if (!notificationType || !['order_placed', 'status_change', 'arrived'].includes(notificationType)) {
        return res.status(400).json({ message: "Invalid notification type" });
      }

      const result = await orderService.sendCustomerNotification(id, notificationType, businessId);
      res.json({ message: "Customer notification sent successfully", result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Order not found') {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Customer email is required')) {
          return res.status(400).json({ message: error.message });
        }
      }
      next(error);
    }
  }

  private async deleteOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = getBusinessIdFromRequest(req);
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const deleted = await orderService.deleteOrder(id, businessId);
      if (!deleted) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();

