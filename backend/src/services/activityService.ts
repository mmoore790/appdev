
import { activityRepository } from "../repositories";

export interface ActivityData {
  businessId: number;
  userId?: number | null;
  activityType: string;
  description: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: any;
}

export function getRecentActivities(businessId: number, limit?: number) {
  return activityRepository.findAll(businessId, limit);
}

export function getActivitiesForUser(userId: number, businessId: number, limit?: number) {
  return activityRepository.findByUser(userId, businessId, limit);
}

export function getActivitiesForEntity(entityType: string, entityId: number, businessId: number) {
  return activityRepository.findByEntity(entityType, entityId, businessId);
}

export function cleanupOldActivities(limit: number) {
  return activityRepository.cleanupOld(limit);
}

/**
 * Create an activity record for system tracking
 */
export async function logActivity(data: ActivityData): Promise<void> {
  try {
    const userId = data.userId ?? 0;
    const entityType = data.entityType ?? '';
    const entityId = data.entityId ?? 0;

    await activityRepository.create({
      businessId: data.businessId,
      userId,
      activityType: data.activityType,
      description: data.description,
      entityType,
      entityId,
      metadata: data.metadata ?? null
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw to avoid breaking main operations
  }
}

/**
 * Get formatted activity description based on type
 */
export function getActivityDescription(type: string, entityType: string, entityId: number, metadata?: any): string {
  const meta = metadata || {};
  
  switch (type) {
    case 'job_created':
      return `Created new job ${meta.jobId || entityId}${meta.customerName ? ` for ${meta.customerName}` : ''}`;
    case 'job_updated':
      return `Updated job ${meta.jobId || entityId}${meta.changes ? ` - ${meta.changes}` : ''}`;
    case 'job_status_changed':
      return `Changed job ${meta.jobId || entityId} status from "${meta.oldStatus}" to "${meta.newStatus}"`;
    case 'job_completed':
      return `Completed job ${meta.jobId || entityId}${meta.customerName ? ` for ${meta.customerName}` : ''}`;
    case 'job_deleted':
      return `Deleted job ${meta.jobId || entityId}${meta.customerName ? ` for ${meta.customerName}` : ''}`;
    case 'job_payment_received':
      return `Payment received for job ${meta.jobId || entityId} - £${meta.amount ? (meta.amount / 100).toFixed(2) : '0.00'}`;
    case 'job_payment_request_created':
      return `Payment request created for job ${meta.jobId || entityId} - £${meta.amount ? (meta.amount / 100).toFixed(2) : '0.00'}`;
    case 'customer_created':
      return `Added new customer: ${meta.customerName || 'Unknown'}`;
    case 'customer_updated':
      return `Updated customer: ${meta.customerName || entityId}`;
    case 'task_created':
      return `Created task: ${meta.taskTitle || entityId}${meta.assignedTo ? ` (assigned to ${meta.assignedToName})` : ''}`;
    case 'task_updated':
      return `Updated task: ${meta.taskTitle || entityId}`;
    case 'task_completed':
      return `Completed task: ${meta.taskTitle || entityId}`;
    case 'callback_created':
      return `New callback request from ${meta.customerName || 'customer'}${meta.phone ? ` (${meta.phone})` : ''}`;
    case 'callback_completed':
      return `Completed callback for ${meta.customerName || 'customer'}`;
    case 'service_added':
      return `Added service to job ${meta.jobId || entityId}: ${meta.serviceType || 'Service'}`;
    case 'equipment_created':
      return `Added equipment: ${meta.equipmentName || entityId}`;
    case 'equipment_deleted':
      return `Deleted equipment: ${meta.equipmentName || entityId}`;
    case 'user_created':
      return `New user registered: ${meta.username || entityId}`;
    case 'user_login':
      return `User ${meta.username || entityId} logged in`;
    case 'payment_completed':
      return `Payment completed - £${meta.amount ? (meta.amount / 100).toFixed(2) : '0.00'} via ${meta.method || 'unknown'}`;
    default:
      return `${type.replace(/_/g, ' ')} - ${entityType} ${entityId}`;
  }
}
