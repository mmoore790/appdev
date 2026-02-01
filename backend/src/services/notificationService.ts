import { EmailService } from "./emailService";
import { storage } from "../storage";
import { Business } from "@shared/schema";
import { notificationRepository } from "../repositories/notificationRepository";

export interface NotificationProvider {
  sendEmail(to: string, subject: string, htmlBody: string, business?: Business): Promise<boolean>;
  sendSMS(to: string, message: string, business?: Business): Promise<boolean>;
}

export interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: string;
  items: Array<{
    name: string;
    quantity: number;
    itemType: string;
  }>;
  trackingNumber?: string;
  businessName: string;
}

export class NotificationService implements NotificationProvider {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  async sendEmail(to: string, subject: string, htmlBody: string, business?: Business): Promise<boolean> {
    try {
      const fromAddress = this.emailService.getFromAddress();
      const result = await this.emailService.sendGenericEmail({
        from: business?.emailFromAddress || fromAddress,
        to,
        subject,
        text: this.stripHtml(htmlBody),
        html: htmlBody,
      });
      // Return the actual result from sendGenericEmail (it returns false if email wasn't sent)
      return result;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  async sendSMS(to: string, message: string, business?: Business): Promise<boolean> {
    // TODO: Implement SMS provider (Twilio, AWS SNS, etc.)
    // For now, this is a placeholder
    console.log(`[SMS] To: ${to}, Message: ${message}`);
    // In production, integrate with SMS provider like Twilio:
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({ body: message, to, from: twilioNumber });
    return true;
  }

  async sendOrderNotification(
    data: OrderNotificationData,
    notificationType: 'order_placed' | 'status_change' | 'arrived',
    method: 'email' | 'sms' | 'both' = 'email',
    business?: Business
  ): Promise<{ emailSent: boolean; smsSent: boolean }> {
    const result = { emailSent: false, smsSent: false };

    if (method === 'email' || method === 'both') {
      if (data.customerEmail) {
        try {
          const { subject, body } = this.generateOrderNotificationEmail(data, notificationType);
          result.emailSent = await this.sendEmail(data.customerEmail, subject, body, business);
          if (result.emailSent) {
            console.log(`✅ Email sent successfully to ${data.customerEmail} for ${notificationType} notification`);
          } else {
            console.warn(`⚠️ Email sending returned false for ${data.customerEmail} (${notificationType})`);
          }
        } catch (error) {
          console.error(`❌ Error sending email to ${data.customerEmail} for ${notificationType}:`, error);
          result.emailSent = false;
        }
      } else {
        console.warn(`⚠️ Cannot send email notification (${notificationType}) - customer email is missing for order ${data.orderNumber}`);
      }
    }

    if (method === 'sms' || method === 'both') {
      if (data.customerPhone) {
        try {
          const message = this.generateOrderNotificationSMS(data, notificationType);
          result.smsSent = await this.sendSMS(data.customerPhone, message, business);
          if (result.smsSent) {
            console.log(`✅ SMS sent successfully to ${data.customerPhone} for ${notificationType} notification`);
          }
        } catch (error) {
          console.error(`❌ Error sending SMS to ${data.customerPhone} for ${notificationType}:`, error);
          result.smsSent = false;
        }
      } else {
        console.warn(`⚠️ Cannot send SMS notification (${notificationType}) - customer phone is missing for order ${data.orderNumber}`);
      }
    }

    return result;
  }

  private generateOrderNotificationEmail(
    data: OrderNotificationData,
    notificationType: 'order_placed' | 'status_change' | 'arrived'
  ): { subject: string; body: string } {
    let subject: string;
    let body: string;

    switch (notificationType) {
      case 'order_placed':
        subject = `Order Confirmation - ${data.orderNumber}`;
        body = this.generateOrderPlacedEmailBody(data);
        break;
      case 'status_change':
        subject = `Order Update - ${data.orderNumber}`;
        body = this.generateStatusChangeEmailBody(data);
        break;
      case 'arrived':
        subject = `Your Order is Ready - ${data.orderNumber}`;
        body = this.generateArrivedEmailBody(data);
        break;
    }

    return { subject, body };
  }

  private generateOrderPlacedEmailBody(data: OrderNotificationData): string {
    const itemsList = data.items.map(item => 
      `  • ${item.name} (${item.quantity}x) - ${item.itemType}`
    ).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .status { display: inline-block; padding: 5px 15px; background: #dbeafe; color: #1e40af; border-radius: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Confirmation</h1>
      <p>${data.businessName}</p>
    </div>
    <div class="content">
      <p>Dear ${data.customerName},</p>
      <p>Thank you for your order! We've received your order and will process it shortly.</p>
      
      <div class="order-info">
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p><strong>Order Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> <span class="status">${data.status}</span></p>
        ${data.expectedDeliveryDate ? `<p><strong>Expected Delivery:</strong> ${new Date(data.expectedDeliveryDate).toLocaleDateString()}</p>` : ''}
      </div>

      <div class="order-info">
        <h3>Items Ordered</h3>
        <pre style="font-family: inherit; white-space: pre-wrap;">${itemsList}</pre>
      </div>

      <p>We'll keep you updated on the status of your order. If you have any questions, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>${data.businessName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private generateStatusChangeEmailBody(data: OrderNotificationData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .status { display: inline-block; padding: 5px 15px; background: #dbeafe; color: #1e40af; border-radius: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Update</h1>
      <p>${data.businessName}</p>
    </div>
    <div class="content">
      <p>Dear ${data.customerName},</p>
      <p>Your order status has been updated.</p>
      
      <div class="order-info">
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p><strong>New Status:</strong> <span class="status">${data.status}</span></p>
        ${data.trackingNumber ? `<p><strong>Order/Tracking Number:</strong> ${data.trackingNumber}</p>` : ''}
      </div>

      <p>We'll continue to keep you updated. If you have any questions, please contact us.</p>
      
      <p>Best regards,<br>${data.businessName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private generateArrivedEmailBody(data: OrderNotificationData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .cta { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Order is Ready!</h1>
      <p>${data.businessName}</p>
    </div>
    <div class="content">
      <p>Dear ${data.customerName},</p>
      <p>Great news! Your order has arrived and is ready for pickup.</p>
      
      <div class="order-info">
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p><strong>Arrival Date:</strong> ${data.actualDeliveryDate ? new Date(data.actualDeliveryDate).toLocaleDateString() : 'Today'}</p>
      </div>

      <p>Please visit us during our business hours to collect your order. If you have any questions or need to arrange a different pickup time, please contact us.</p>
      
      <p>Best regards,<br>${data.businessName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private generateOrderNotificationSMS(
    data: OrderNotificationData,
    notificationType: 'order_placed' | 'status_change' | 'arrived'
  ): string {
    switch (notificationType) {
      case 'order_placed':
        return `${data.businessName}: Your order ${data.orderNumber} has been confirmed. We'll keep you updated on its progress.`;
      case 'status_change':
        return `${data.businessName}: Order ${data.orderNumber} status updated to: ${data.status}.${data.trackingNumber ? ` Tracking: ${data.trackingNumber}` : ''}`;
      case 'arrived':
        return `${data.businessName}: Great news! Your order ${data.orderNumber} has arrived and is ready for pickup.`;
    }
  }

  async notifyCallbackAssignment(
    callbackId: number,
    customerName: string,
    subject: string,
    assignedTo: number,
    businessId: number,
    priority?: string
  ): Promise<void> {
    await notificationRepository.create({
      type: 'callback_assigned',
      title: `New callback assigned: ${customerName}`,
      description: subject,
      businessId,
      userId: assignedTo,
      entityType: 'callback',
      entityId: callbackId,
      priority: priority || 'medium',
      link: `/callbacks/${callbackId}`,
        metadata: null,
    });
  }

  async notifyCallbackReassignment(
    callbackId: number,
    customerName: string,
    subject: string,
    previousAssignee: number | null,
    newAssignee: number | null,
    businessId: number,
    priority?: string
  ): Promise<void> {
    // Notify previous assignee if exists
    if (previousAssignee) {
      await notificationRepository.create({
        type: 'callback_unassigned',
        title: `Callback unassigned: ${customerName}`,
        description: subject,
        businessId,
        userId: previousAssignee,
        entityType: 'callback',
        entityId: callbackId,
        priority: priority || 'medium',
        link: `/callbacks/${callbackId}`,
        metadata: null,
      });
    }

    // Notify new assignee if exists
    if (newAssignee) {
      await notificationRepository.create({
        type: 'callback_assigned',
        title: `Callback assigned: ${customerName}`,
        description: subject,
        businessId,
        userId: newAssignee,
        entityType: 'callback',
        entityId: callbackId,
        priority: priority || 'medium',
        link: `/callbacks/${callbackId}`,
        metadata: null,
      });
    }
  }

  async notifyJobAssignment(
    jobId: number,
    jobNumber: string,
    assignedTo: number,
    businessId: number,
    description?: string | null
  ): Promise<void> {
    await notificationRepository.create({
      type: 'job_assigned',
      title: `New job assigned: ${jobNumber}`,
      description: description || undefined,
      businessId,
      userId: assignedTo,
      entityType: 'job',
      entityId: jobId,
      priority: 'high',
      link: `/workshop/jobs/${jobId}`,
      metadata: null,
    });
  }

  async notifyJobReassignment(
    jobId: number,
    jobNumber: string,
    previousAssignee: number | null,
    newAssignee: number | null,
    businessId: number,
    description?: string | null
  ): Promise<void> {
    // Notify previous assignee if exists
    if (previousAssignee) {
      await notificationRepository.create({
        type: 'job_unassigned',
        title: `Job unassigned: ${jobNumber}`,
        description: description || undefined,
        businessId,
        userId: previousAssignee,
        entityType: 'job',
        entityId: jobId,
        priority: 'high',
        link: `/workshop/jobs/${jobId}`,
        metadata: null,
      });
    }

    // Notify new assignee if exists
    if (newAssignee) {
      await notificationRepository.create({
        type: 'job_assigned',
        title: `Job assigned: ${jobNumber}`,
        description: description || undefined,
        businessId,
        userId: newAssignee,
        entityType: 'job',
        entityId: jobId,
        priority: 'high',
        link: `/workshop/jobs/${jobId}`,
        metadata: null,
      });
    }
  }

  async notifyTaskAssignment(
    taskId: number,
    title: string,
    assignedTo: number,
    businessId: number,
    priority?: string | null,
    dueDate?: string | null
  ): Promise<void> {
    await notificationRepository.create({
      type: 'task_assigned',
      title: `New task assigned: ${title}`,
      description: dueDate ? `Due: ${new Date(dueDate).toLocaleDateString()}` : undefined,
      businessId,
      userId: assignedTo,
      entityType: 'task',
      entityId: taskId,
      priority: priority || 'medium',
      link: `/tasks?taskId=${taskId}`,
      metadata: null,
    });
  }

  async notifyTaskReassignment(
    taskId: number,
    title: string,
    previousAssignee: number | null,
    newAssignee: number | null,
    businessId: number,
    priority?: string | null,
    dueDate?: string | null
  ): Promise<void> {
    // Notify previous assignee if exists
    if (previousAssignee) {
      await notificationRepository.create({
        type: 'task_unassigned',
        title: `Task unassigned: ${title}`,
        description: dueDate ? `Due: ${new Date(dueDate).toLocaleDateString()}` : undefined,
        businessId,
        userId: previousAssignee,
        entityType: 'task',
        entityId: taskId,
        priority: priority || 'medium',
        link: `/tasks?taskId=${taskId}`,
        metadata: null,
      });
    }

    // Notify new assignee if exists
    if (newAssignee) {
      await notificationRepository.create({
        type: 'task_assigned',
        title: `Task assigned: ${title}`,
        description: dueDate ? `Due: ${new Date(dueDate).toLocaleDateString()}` : undefined,
        businessId,
        userId: newAssignee,
        entityType: 'task',
        entityId: taskId,
        priority: priority || 'medium',
        link: `/tasks?taskId=${taskId}`,
        metadata: null,
      });
    }
  }

  async notifyCalendarAssignment(
    entryId: number,
    title: string,
    assignedTo: number,
    businessId: number,
    startTime: string,
    createdBy?: number
  ): Promise<void> {
    await notificationRepository.create({
      type: 'calendar_assigned',
      title: `Calendar entry assigned: ${title}`,
      description: `Scheduled for ${new Date(startTime).toLocaleString()}`,
      businessId,
      userId: assignedTo,
      entityType: 'time_entry',
      entityId: entryId,
      priority: 'medium',
      link: `/calendar`,
      metadata: createdBy ? ({ createdBy } as Record<string, unknown>) : null,
    });
  }
}

export const notificationService = new NotificationService();
