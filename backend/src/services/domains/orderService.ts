import { InsertOrder, InsertOrderItem, Order, OrderItem } from "@shared/schema";
import {
  orderRepository,
  orderItemRepository,
  orderStatusHistoryRepository,
} from "../../repositories";
import { notificationService, OrderNotificationData } from "../notificationService";
import { storage } from "../../storage";
import { jobService } from "./jobService";
import { notificationRepository } from "../../repositories/notificationRepository";
import { sendOrderPlacedEmail, sendOrderArrivedEmail } from "../emailService";

// Order status workflow
export const ORDER_STATUSES = {
  NOT_ORDERED: 'not_ordered',
  ORDERED: 'ordered',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

class OrderService {
  async listOrders(businessId: number, limit?: number, offset?: number) {
    return orderRepository.findAll(businessId, limit, offset);
  }

  async countOrders(businessId: number) {
    return orderRepository.countAll(businessId);
  }

  async listOrdersByStatus(status: string, businessId: number) {
    return orderRepository.findByStatus(status, businessId);
  }

  async listOrdersByCustomer(customerId: number, businessId: number) {
    return orderRepository.findByCustomer(customerId, businessId);
  }

  async listOrdersByJob(jobId: number, businessId: number) {
    return orderRepository.findByJob(jobId, businessId);
  }

  async searchOrders(businessId: number, query: string) {
    return orderRepository.search(businessId, query);
  }

  async getOrderById(id: number, businessId: number) {
    return orderRepository.findById(id, businessId);
  }

  async getOrderByNumber(orderNumber: string, businessId: number) {
    return orderRepository.findByNumber(orderNumber, businessId);
  }

  async getOrderItems(orderId: number, businessId: number) {
    return orderItemRepository.findByOrder(orderId, businessId);
  }

  async getOrderStatusHistory(orderId: number, businessId: number) {
    return orderStatusHistoryRepository.findByOrder(orderId, businessId);
  }

  async createOrder(data: InsertOrder, items?: InsertOrderItem[]) {
    // Generate order number if not provided
    if (!data.orderNumber && data.businessId) {
      data.orderNumber = await this.generateOrderNumber(data.businessId);
    }

    // Create the order
    const order = await orderRepository.create(data);

    // Create order items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        await orderItemRepository.create({
          ...item,
          businessId: data.businessId,
          orderId: order.id,
        });
      }
    }

    // Send notification if enabled (send regardless of status - customer should be notified when order is created)
    if (order.notifyOnOrderPlaced && order.customerEmail) {
      try {
        // Get order items for the email (items are already created at this point)
        const orderItems = await orderItemRepository.findByOrder(order.id, order.businessId);

        // Send email directly, similar to job creation emails
        await sendOrderPlacedEmail(order, orderItems);
      } catch (emailError) {
        // Log error but don't fail order creation if email fails
        console.error(`Failed to send order placed email for order ${order.orderNumber}:`, emailError);
      }
    } else if (order.notifyOnOrderPlaced && !order.customerEmail) {
      console.log(`⚠️ Order placed notification enabled but no customer email provided for order ${order.orderNumber}`);
    } else {
      console.log(`ℹ️ Order placed notification disabled for order ${order.orderNumber} (notifyOnOrderPlaced = false)`);
    }

    // Notify staff of new order
    await this.notifyStaffNewOrder(order);

    // Update job's updatedAt timestamp if order is linked to a job
    if (order.relatedJobId) {
      await jobService.touchJob(order.relatedJobId, order.businessId);
    }

    return order;
  }

  async updateOrder(id: number, data: Partial<Order>, businessId: number) {
    const order = await orderRepository.findById(id, businessId);
    if (!order) {
      throw new Error('Order not found');
    }

    const updated = await orderRepository.update(id, data, businessId);

    // Update job's updatedAt timestamp if order is linked to a job
    if (updated?.relatedJobId) {
      await jobService.touchJob(updated.relatedJobId, businessId);
    }

    return updated;
  }

  async updateOrderStatus(
    id: number,
    newStatus: OrderStatus,
    changedBy: number,
    businessId: number,
    changeReason?: string,
    notes?: string,
    metadata?: Record<string, unknown>,
    notifyOnArrival?: boolean
  ) {
    const order = await orderRepository.findById(id, businessId);
    if (!order) {
      throw new Error('Order not found');
    }

    // If notifyOnArrival is provided, update it on the order
    if (notifyOnArrival !== undefined) {
      await orderRepository.update(id, { notifyOnArrival }, businessId);
    }

    const updated = await orderRepository.updateStatus(
      id,
      newStatus,
      changedBy,
      businessId,
      changeReason,
      notes,
      metadata
    );

    if (!updated) {
      return undefined;
    }

    // Status change notifications are disabled - only notify on order placed and arrival

    // Special handling for arrived status - only send email if explicitly requested (notifyOnArrival === true)
    if (newStatus === ORDER_STATUSES.ARRIVED && notifyOnArrival === true) {
      try {
        if (updated.customerEmail) {
          console.log(`📧 Sending order arrived email for order ${updated.orderNumber} to ${updated.customerEmail}`);
          // Get order items for the email
          const orderItems = await orderItemRepository.findByOrder(updated.id, updated.businessId);
          // Send email directly using the dedicated function
          await sendOrderArrivedEmail(updated, orderItems);
          // Email sending is handled internally
          console.log(`✅ Order arrived email sent for order ${updated.orderNumber}`);
        } else {
          console.warn(`⚠️ Order arrived email not sent for order ${updated.orderNumber} - customer email is missing`);
        }
        
        // Also send SMS if notification method includes SMS
        if (updated.notificationMethod === 'sms' || updated.notificationMethod === 'both') {
          if (updated.customerPhone) {
            const result = await this.sendOrderNotification(updated, 'arrived');
            if (result.smsSent) {
              console.log(`✅ Order arrived SMS sent successfully for order ${updated.orderNumber}`);
            }
          } else {
            console.warn(`⚠️ Order arrived SMS not sent for order ${updated.orderNumber} - customer phone is missing`);
          }
        }
      } catch (error) {
        // Log error but don't fail status update if email fails
        console.error(`❌ Failed to send order arrived notification for order ${updated.orderNumber}:`, error);
      }
      await this.notifyStaffOrderArrived(updated);
    } else if (newStatus === ORDER_STATUSES.ARRIVED && notifyOnArrival === false) {
      console.log(`ℹ️ Order arrived notification disabled for order ${updated.orderNumber} (checkbox was unchecked)`);
    }

    // Update job's updatedAt timestamp if order is linked to a job
    if (updated.relatedJobId) {
      await jobService.touchJob(updated.relatedJobId, businessId);
    }

    return updated;
  }

  async addOrderItem(orderId: number, itemData: InsertOrderItem, businessId: number) {
    const order = await orderRepository.findById(orderId, businessId);
    if (!order) {
      throw new Error('Order not found');
    }

    return orderItemRepository.create({
      ...itemData,
      businessId,
      orderId,
    });
  }

  async updateOrderItem(id: number, itemData: Partial<OrderItem>, businessId: number) {
    return orderItemRepository.update(id, itemData, businessId);
  }

  async deleteOrderItem(id: number, businessId: number) {
    return orderItemRepository.delete(id, businessId);
  }

  async deleteOrder(id: number, businessId: number) {
    // Delete all order items first (cascade should handle this, but being explicit)
    await orderItemRepository.deleteByOrder(id, businessId);
    return orderRepository.delete(id, businessId);
  }

  async sendCustomerNotification(
    orderId: number,
    notificationType: 'order_placed' | 'status_change' | 'arrived',
    businessId: number
  ) {
    const order = await orderRepository.findById(orderId, businessId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Use dedicated email functions for order_placed and arrived
    if (notificationType === 'order_placed') {
      if (!order.customerEmail) {
        throw new Error('Customer email is required to send order confirmation');
      }
      const orderItems = await orderItemRepository.findByOrder(order.id, order.businessId);
      const emailSent = await sendOrderPlacedEmail(order, orderItems);
      return { emailSent, smsSent: false };
    } else if (notificationType === 'arrived') {
      if (!order.customerEmail) {
        throw new Error('Customer email is required to send order arrived notification');
      }
      const orderItems = await orderItemRepository.findByOrder(order.id, order.businessId);
      const emailSent = await sendOrderArrivedEmail(order, orderItems);
      return { emailSent, smsSent: false };
    } else {
      // For status_change, use the generic notification service
      return this.sendOrderNotification(order, notificationType);
    }
  }

  private async sendOrderNotification(
    order: Order,
    notificationType: 'order_placed' | 'status_change' | 'arrived'
  ) {
    // Get order items
    const items = await orderItemRepository.findByOrder(order.id, order.businessId);

    // Get business info
    const business = await storage.getBusiness(order.businessId);

    // Debug: Log order details
    console.log(`🔍 Order notification details for ${notificationType}:`);
    console.log(`   Order Number: ${order.orderNumber}`);
    console.log(`   Customer Email: ${order.customerEmail || '(not provided)'}`);
    console.log(`   Customer Phone: ${order.customerPhone || '(not provided)'}`);
    console.log(`   Notification Method: ${order.notificationMethod}`);
    console.log(`   Notify on Order Placed: ${order.notifyOnOrderPlaced}`);
    console.log(`   Notify on Arrival: ${order.notifyOnArrival}`);

    const notificationData: OrderNotificationData = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail || undefined,
      customerPhone: order.customerPhone,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDeliveryDate || undefined,
      actualDeliveryDate: order.actualDeliveryDate || undefined,
      status: order.status,
      items: items.map(item => ({
        name: item.itemName,
        quantity: item.quantity,
        itemType: item.itemType,
      })),
      trackingNumber: order.trackingNumber || undefined,
      businessName: business?.name || 'Our Business',
    };

    console.log(`📤 Calling notificationService.sendOrderNotification with method: ${order.notificationMethod}`);

    return notificationService.sendOrderNotification(
      notificationData,
      notificationType,
      order.notificationMethod as 'email' | 'sms' | 'both',
      business || undefined
    );
  }

  private async notifyStaffNewOrder(order: Order) {
    // Get all staff users for the business
    const staff = await storage.getUsersByRole('staff', order.businessId);
    const admins = await storage.getUsersByRole('admin', order.businessId);
    const allStaff = [...staff, ...admins];

    // Create notifications for staff
    for (const user of allStaff) {
      await notificationRepository.create({
        businessId: order.businessId,
        userId: user.id,
        type: 'order',
        title: 'New Order Created',
        description: `Order ${order.orderNumber} has been created for ${order.customerName}`,
        entityType: 'order',
        entityId: order.id,
        link: `/orders/${order.id}`,
        priority: 'normal',
      });
    }
  }

  private async notifyStaffOrderArrived(order: Order) {
    // Get all staff users for the business
    const staff = await storage.getUsersByRole('staff', order.businessId);
    const admins = await storage.getUsersByRole('admin', order.businessId);
    const allStaff = [...staff, ...admins];

    // Create notifications for staff
    for (const user of allStaff) {
      await notificationRepository.create({
        businessId: order.businessId,
        userId: user.id,
        type: 'order',
        title: 'Order Arrived',
        description: `Order ${order.orderNumber} has arrived and is ready for pickup`,
        entityType: 'order',
        entityId: order.id,
        link: `/orders/${order.id}`,
        priority: 'high',
      });
    }
  }

  private async generateOrderNumber(businessId: number): Promise<string> {
    // Generate a unique order number
    // Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20240115-0001)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the last order number for today to increment
    const today = date.toISOString().slice(0, 10);
    const todayOrders = await orderRepository.findAll(businessId);
    const todayOrderNumbers = todayOrders
      .filter(o => o.orderDate.startsWith(today))
      .map(o => {
        const match = o.orderNumber.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      });
    
    const nextNumber = todayOrderNumbers.length > 0 
      ? Math.max(...todayOrderNumbers) + 1 
      : 1;
    
    return `ORD-${dateStr}-${String(nextNumber).padStart(4, '0')}`;
  }
}

export const orderService = new OrderService();

