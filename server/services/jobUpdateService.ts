import { storage } from "../storage";
import { type JobUpdate, type InsertJobUpdate } from "@shared/schema";

/**
 * Create a new job update record
 * @param updateData Update data object
 * @returns The created job update
 */
export async function createJobUpdate(updateData: InsertJobUpdate): Promise<JobUpdate> {
  try {
    return await storage.createJobUpdate(updateData);
  } catch (error) {
    console.error("Error in job update service:", error);
    throw error;
  }
}

/**
 * Get all updates for a specific job
 * @param jobId The job ID to get updates for
 * @returns Array of job updates
 */
export async function getJobUpdates(jobId: number): Promise<JobUpdate[]> {
  try {
    return await storage.getJobUpdates(jobId);
  } catch (error) {
    console.error("Error getting job updates:", error);
    return [];
  }
}

/**
 * Get only public updates for a specific job (for customer portal)
 * @param jobId The job ID to get updates for
 * @returns Array of public job updates
 */
export async function getPublicJobUpdates(jobId: number): Promise<JobUpdate[]> {
  try {
    return await storage.getPublicJobUpdates(jobId);
  } catch (error) {
    console.error("Error getting public job updates:", error);
    return [];
  }
}

/**
 * Add a status change update to a job
 * @param jobId The job ID
 * @param oldStatus Previous status
 * @param newStatus New status
 * @param userId User making the change
 * @param isPublic Whether this update should be visible to customers
 */
export async function addStatusChangeUpdate(
  jobId: number,
  oldStatus: string,
  newStatus: string,
  userId: number,
  isPublic: boolean = true
): Promise<JobUpdate | null> {
  try {
    const formattedOldStatus = formatStatus(oldStatus);
    const formattedNewStatus = formatStatus(newStatus);
    
    const note = `Status changed from "${formattedOldStatus}" to "${formattedNewStatus}"`;
    
    return await storage.createJobUpdate({
      jobId,
      note,
      isPublic,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating status change update:", error);
    return null;
  }
}

/**
 * Format a status code into a human-readable string
 */
function formatStatus(status: string): string {
  switch (status) {
    case "waiting_assessment":
      return "Waiting Assessment";
    case "in_progress":
      return "In Progress";
    case "parts_ordered":
      return "Parts Ordered";
    case "completed":
      return "Completed";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}