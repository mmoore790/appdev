import { jobUpdateRepository } from "../repositories";
import { type JobUpdate, type InsertJobUpdate } from "@shared/schema";

/**
 * Create a new job update record
 * @param updateData Update data object
 * @returns The created job update
 */
export async function createJobUpdate(updateData: InsertJobUpdate): Promise<JobUpdate> {
  try {
    return await jobUpdateRepository.create(updateData);
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
export async function getJobUpdates(jobId: number, businessId: number): Promise<JobUpdate[]> {
  try {
    return await jobUpdateRepository.findByJob(jobId, businessId);
  } catch (error) {
    console.error("Error getting job updates:", error);
    return [];
  }
}

/**
 * Get only public updates for a specific job (for customer portal)
 * @param jobId The job ID to get updates for
 * @param businessId The business ID
 * @returns Array of public job updates
 */
export async function getPublicJobUpdates(jobId: number, businessId: number): Promise<JobUpdate[]> {
  try {
    return await jobUpdateRepository.findPublicByJob(jobId, businessId);
  } catch (error) {
    console.error("Error getting public job updates:", error);
    return [];
  }
}

/**
 * Format duration in a human-readable way
 */
function formatDuration(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    if (hours < 1) {
      const minutes = Math.round(days * 24 * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  if (days < 7) {
    const rounded = Math.round(days * 10) / 10;
    return `${rounded} day${rounded !== 1 ? "s" : ""}`;
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = Math.round((days % 7) * 10) / 10;
  if (remainingDays === 0) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  }
  return `${weeks} week${weeks !== 1 ? "s" : ""} ${remainingDays} day${remainingDays !== 1 ? "s" : ""}`;
}

/**
 * Add a status change update to a job
 * @param jobId The job ID
 * @param oldStatus Previous status
 * @param newStatus New status
 * @param userId User making the change
 * @param businessId The business ID
 * @param durationInOldStatus Duration in days the job spent in the old status (optional)
 * @param isPublic Whether this update should be visible to customers
 */
export async function addStatusChangeUpdate(
  jobId: number,
  oldStatus: string,
  newStatus: string,
  userId: number,
  businessId: number,
  durationInOldStatus?: number,
  isPublic: boolean = true
): Promise<JobUpdate | null> {
  try {
    const formattedOldStatus = formatStatus(oldStatus);
    const formattedNewStatus = formatStatus(newStatus);

    let note = `Status changed from "${formattedOldStatus}" to "${formattedNewStatus}"`;
    
    // Add duration information if provided
    if (durationInOldStatus !== undefined && durationInOldStatus !== null) {
      const durationFormatted = formatDuration(durationInOldStatus);
      note += ` (was in "${formattedOldStatus}" for ${durationFormatted})`;
    }

    return await jobUpdateRepository.create({
      businessId,
      jobId,
      note,
      isPublic,
      createdBy: userId
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
    case "on_hold":
      return "On Hold";
    case "ready_for_pickup":
      return "Ready for Pickup";
    case "completed":
      return "Completed";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}