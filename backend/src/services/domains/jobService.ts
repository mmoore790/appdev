import { InsertJob, Job } from "@shared/schema";
import { customerRepository, jobRepository, jobUpdateRepository } from "../../repositories";
import { storage } from "../../storage";
import { getActivityDescription, logActivity } from "../activityService";
import { sendJobBookedEmail, sendJobCompletedEmail } from "../emailService";
import { notificationService } from "../notificationService";
import { addStatusChangeUpdate } from "../jobUpdateService";

// Helper function to format status for matching with note format
function formatStatusForNote(status: string): string {
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
      return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

class JobService {
  async generateNextJobId(businessId: number) {
    return jobRepository.generateNextJobId(businessId);
  }

  /**
   * Updates the job's updatedAt timestamp
   * This should be called whenever any related entity (services, work completed, parts, etc.) is modified
   */
  async touchJob(jobId: number, businessId: number): Promise<void> {
    try {
      await jobRepository.update(jobId, { updatedAt: new Date().toISOString() }, businessId);
    } catch (error) {
      // Silently fail - don't break the main operation if this fails
      console.error(`Failed to update job ${jobId} timestamp:`, error);
    }
  }

  /**
   * List all jobs for a business.
   * 
   * IMPORTANT: All users within the same business can see ALL jobs for that business.
   * This ensures transparency across the business. The assignedTo filter is optional and
   * only used for UI filtering purposes - it does not restrict data access.
   * 
   * @param businessId - The business ID (all jobs for this business are returned)
   * @param filter - Optional filters for UI purposes (customerId, assignedTo)
   * @returns All jobs for the business, optionally filtered
   */
  async listJobs(businessId: number, filter?: { customerId?: number; assignedTo?: number }) {
    // Get ALL jobs for the business - all users can see all jobs
    const jobs = await jobRepository.findAll(businessId);

    // Calculate time in status for each job
    const jobsWithTimeInStatus = await Promise.all(
      jobs.map(async (job) => {
        try {
          // Get all job updates for this job
          const updates = await jobUpdateRepository.findByJob(job.id, businessId);
          
          // Find status change updates and determine when job entered current status
          let statusEntryTime: string = job.createdAt || new Date().toISOString();
          
          // Filter status change updates
          const statusChangeUpdates = updates.filter((update) =>
            update.note && update.note.includes("Status changed from")
          );

          if (statusChangeUpdates.length > 0) {
            // Find the update that changed TO the current status
            // The note format is: "Status changed from \"Old Status\" to \"New Status\" (was in \"Old Status\" for duration)"
            const currentStatusFormatted = formatStatusForNote(job.status);
            
            // Look for the most recent update that changed to the current status
            // Updates are already sorted by createdAt desc, so first match is most recent
            const entryUpdate = statusChangeUpdates.find((update) => {
              if (!update.note) return false;
              // Extract the "to" status from the note
              // Handle both formats: with and without duration
              // Pattern: Status changed from "X" to "Y" or Status changed from "X" to "Y" (was in...)
              // Use non-greedy match to stop at the first closing quote
              const match = update.note.match(/Status changed from "[^"]+" to "([^"]+)"/);
              if (match && match[1]) {
                // Trim any whitespace and compare
                const newStatusInNote = match[1].trim();
                return newStatusInNote === currentStatusFormatted;
              }
              return false;
            });

            if (entryUpdate) {
              statusEntryTime = entryUpdate.createdAt;
            }
            // If no update found for current status, it means status hasn't changed since creation
            // statusEntryTime already set to createdAt above
          }
          // If no status change updates exist, job has been in current status since creation
          // statusEntryTime already set to createdAt above

          // Calculate days since status entry
          const now = new Date();
          const entryDate = new Date(statusEntryTime);
          
          // Handle invalid dates
          if (isNaN(entryDate.getTime())) {
            entryDate.setTime(now.getTime());
          }
          
          const diffTime = now.getTime() - entryDate.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          const timeInStatusDays = Math.max(0, Math.round(diffDays * 100) / 100);

          // Ensure the property is explicitly included
          const jobWithTime = {
            ...job,
            timeInStatusDays,
            statusEntryTime,
          };

          return jobWithTime;
        } catch (error) {
          // If calculation fails, return job with 0 days (fallback)
          console.error(`Error calculating time in status for job ${job.id}:`, error);
          const now = new Date();
          const createdAt = job.createdAt ? new Date(job.createdAt) : now;
          const diffTime = now.getTime() - createdAt.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          const timeInStatusDays = Math.max(0, Math.round(diffDays * 100) / 100);
          
          // Ensure the property is explicitly included
          const jobWithTime = {
            ...job,
            timeInStatusDays,
            statusEntryTime: job.createdAt || now.toISOString(),
          };

          return jobWithTime;
        }
      })
    );

    let filteredJobs = jobsWithTimeInStatus;

    if (filter?.customerId != null) {
      filteredJobs = filteredJobs.filter((job) => job.customerId === filter.customerId);
    }

    if (filter?.assignedTo != null) {
      // Filter by assignee (still scoped to businessId for security)
      filteredJobs = filteredJobs.filter((job) => job.assignedTo === filter.assignedTo);
    }

    return filteredJobs;
  }

  async getJobById(id: number, businessId: number) {
    const job = await jobRepository.findById(id, businessId);
    if (!job) return undefined;

    // Calculate time in status for the job
    try {
      const updates = await jobUpdateRepository.findByJob(job.id, businessId);
      
      let statusEntryTime: string = job.createdAt || new Date().toISOString();
      
      const statusChangeUpdates = updates.filter((update) =>
        update.note && update.note.includes("Status changed from")
      );

      if (statusChangeUpdates.length > 0) {
        const currentStatusFormatted = formatStatusForNote(job.status);
        
        const entryUpdate = statusChangeUpdates.find((update) => {
          if (!update.note) return false;
          // Handle both formats: with and without duration
          // Pattern: Status changed from "X" to "Y" or Status changed from "X" to "Y" (was in...)
          // Use non-greedy match to stop at the first closing quote
          const match = update.note.match(/Status changed from "[^"]+" to "([^"]+)"/);
          if (match && match[1]) {
            // Trim any whitespace and compare
            const newStatusInNote = match[1].trim();
            return newStatusInNote === currentStatusFormatted;
          }
          return false;
        });

        if (entryUpdate) {
          statusEntryTime = entryUpdate.createdAt;
        }
      }

      const now = new Date();
      const entryDate = new Date(statusEntryTime);
      
      if (isNaN(entryDate.getTime())) {
        entryDate.setTime(now.getTime());
      }
      
      const diffTime = now.getTime() - entryDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const timeInStatusDays = Math.max(0, Math.round(diffDays * 100) / 100);

      return {
        ...job,
        timeInStatusDays,
        statusEntryTime,
      };
    } catch (error) {
      console.error(`Error calculating time in status for job ${job.id}:`, error);
      const now = new Date();
      const createdAt = job.createdAt ? new Date(job.createdAt) : now;
      const diffTime = now.getTime() - createdAt.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const timeInStatusDays = Math.max(0, Math.round(diffDays * 100) / 100);
      
      return {
        ...job,
        timeInStatusDays,
        statusEntryTime: job.createdAt || now.toISOString(),
      };
    }
  }

  async getJobByJobCode(jobCode: string, businessId: number) {
    const jobs = await jobRepository.findAll(businessId);
    const job = jobs.find((job) => job.jobId === jobCode);
    if (!job) return undefined;

    // Calculate time in status (same logic as getJobById)
    try {
      const updates = await jobUpdateRepository.findByJob(job.id, businessId);
      
      let statusEntryTime: string = job.createdAt || new Date().toISOString();
      
      const statusChangeUpdates = updates.filter((update) =>
        update.note && update.note.includes("Status changed from")
      );

      if (statusChangeUpdates.length > 0) {
        const currentStatusFormatted = formatStatusForNote(job.status);
        
        const entryUpdate = statusChangeUpdates.find((update) => {
          if (!update.note) return false;
          // Handle both formats: with and without duration
          // Pattern: Status changed from "X" to "Y" or Status changed from "X" to "Y" (was in...)
          // Use non-greedy match to stop at the first closing quote
          const match = update.note.match(/Status changed from "[^"]+" to "([^"]+)"/);
          if (match && match[1]) {
            // Trim any whitespace and compare
            const newStatusInNote = match[1].trim();
            return newStatusInNote === currentStatusFormatted;
          }
          return false;
        });

        if (entryUpdate) {
          statusEntryTime = entryUpdate.createdAt;
        }
      }

      const now = new Date();
      const entryDate = new Date(statusEntryTime);
      
      if (isNaN(entryDate.getTime())) {
        entryDate.setTime(now.getTime());
      }
      
      const diffTime = now.getTime() - entryDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const timeInStatusDays = Math.max(0, Math.round(diffDays * 100) / 100);

      return {
        ...job,
        timeInStatusDays,
        statusEntryTime,
      };
    } catch (error) {
      console.error(`Error calculating time in status for job ${job.id}:`, error);
      const now = new Date();
      const createdAt = job.createdAt ? new Date(job.createdAt) : now;
      const diffTime = now.getTime() - createdAt.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const timeInStatusDays = Math.max(0, Math.round(diffDays * 100) / 100);
      
      return {
        ...job,
        timeInStatusDays,
        statusEntryTime: job.createdAt || now.toISOString(),
      };
    }
  }

  async getPublicJobTracker(jobId: string, email: string, businessId: number) {
    const jobs = await jobRepository.findAll(businessId);
    const job = jobs.find((j) => j.jobId === jobId);
    if (!job) {
      return null;
    }

    if (!job.customerId) {
      return null;
    }

    const customer = await customerRepository.findById(job.customerId, businessId);
    if (!customer) {
      return null;
    }

    if (!customer.email || customer.email.toLowerCase() !== email.toLowerCase()) {
      return undefined;
    }

    const updates = await jobUpdateRepository.findPublicByJob(job.id, businessId);

    return {
      job: {
        id: job.id,
        jobId: job.jobId,
        status: job.status,
        description: job.description,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        estimatedHours: job.estimatedHours,
        actualHours: job.actualHours,
        customerNotified: job.customerNotified,
      },
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      updates,
    };
  }

  async createJob(data: InsertJob, actorUserId?: number) {
    // Automatically set status to "in_progress" if job is assigned to a mechanic
    // and no explicit status is provided
    if (data.assignedTo && (!data.status || data.status === "waiting_assessment")) {
      data.status = "in_progress";
    }
    
    const job = await jobRepository.create(data);

    let customerName = "Unknown Customer";

    if (job.customerId) {
      try {
        const customer = await customerRepository.findById(job.customerId, job.businessId);
        if (customer) {
          customerName = customer.name;

          if (customer.email) {
            try {
              // Fetch business info to check if tracker is enabled
              const business = await storage.getBusiness(job.businessId);
              await sendJobBookedEmail(job, customer, business);
            } catch (emailError) {
              console.error(`Failed to send job receipt email for job ${job.jobId}:`, emailError);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching customer for job creation:", error);
      }
    }

    await logActivity({
      businessId: job.businessId,
      userId: actorUserId ?? null,
      activityType: "job_created",
      description: getActivityDescription("job_created", "job", job.id, {
        jobId: job.jobId,
        customerName,
        description: job.description,
      }),
      entityType: "job",
      entityId: job.id,
      metadata: {
        jobId: job.jobId,
        customerName,
        status: job.status,
        estimatedHours: job.estimatedHours,
      },
    });

    // Create notification if job is assigned
    if (job.assignedTo) {
      try {
        await notificationService.notifyJobAssignment(
          job.id,
          job.jobId,
          job.assignedTo,
          job.businessId,
          job.description
        );
      } catch (error) {
        console.error("Error creating job assignment notification:", error);
      }
    }

    return job;
  }

  async updateJob(id: number, data: Partial<Job>, businessId: number, actorUserId?: number) {
    const currentJob = await jobRepository.findById(id, businessId);
    if (!currentJob) {
      return undefined;
    }

    // Check if assignment changed
    const assignmentChanged = data.assignedTo !== undefined && data.assignedTo !== currentJob.assignedTo;
    
    // Automatically move to "in_progress" when assigned to a mechanic
    if (assignmentChanged && data.assignedTo !== null && data.assignedTo !== undefined) {
      // Only auto-update status if not already explicitly set and current status is not already in_progress or later
      if (data.status === undefined && currentJob.status !== "in_progress" && 
          currentJob.status !== "ready_for_pickup" && currentJob.status !== "completed") {
        data.status = "in_progress";
      }
    }

    const updatedJob = await jobRepository.update(id, data, businessId);
    if (!updatedJob) {
      return undefined;
    }

    // Create notification if assignment changed
    if (assignmentChanged) {
      try {
        await notificationService.notifyJobReassignment(
          updatedJob.id,
          updatedJob.jobId,
          currentJob.assignedTo,
          updatedJob.assignedTo || null,
          businessId,
          updatedJob.description
        );
      } catch (error) {
        console.error("Error creating job reassignment notification:", error);
      }
    }

    let customerName = "Unknown Customer";
    if (updatedJob.customerId) {
      try {
        const customer = await customerRepository.findById(updatedJob.customerId, businessId);
        if (customer) {
          customerName = customer.name;
        }
      } catch (error) {
        console.error("Error fetching customer for job update:", error);
      }
    }

    if (currentJob.status !== updatedJob.status) {
      // Calculate how long the job was in the old status
      let durationInOldStatus: number | undefined = undefined;
      
      try {
        // Get all job updates to find when the job entered the old status
        const updates = await jobUpdateRepository.findByJob(currentJob.id, businessId);
        const statusChangeUpdates = updates.filter((update) =>
          update.note && update.note.includes("Status changed from")
        );

        let oldStatusEntryTime: string = currentJob.createdAt || new Date().toISOString();

        if (statusChangeUpdates.length > 0) {
          const oldStatusFormatted = formatStatusForNote(currentJob.status);
          
          // Find the update that changed TO the old status
          const entryUpdate = statusChangeUpdates.find((update) => {
            if (!update.note) return false;
            // Handle both formats: with and without duration
            // Pattern: Status changed from "X" to "Y" or Status changed from "X" to "Y" (was in...)
            // Use non-greedy match to stop at the first closing quote
            const match = update.note.match(/Status changed from "[^"]+" to "([^"]+)"/);
            if (match && match[1]) {
              // Trim any whitespace and compare
              const newStatusInNote = match[1].trim();
              return newStatusInNote === oldStatusFormatted;
            }
            return false;
          });

          if (entryUpdate) {
            oldStatusEntryTime = entryUpdate.createdAt;
          }
        }

        // Calculate duration in old status
        const now = new Date();
        const entryDate = new Date(oldStatusEntryTime);
        
        if (!isNaN(entryDate.getTime())) {
          const diffTime = now.getTime() - entryDate.getTime();
          durationInOldStatus = diffTime / (1000 * 60 * 60 * 24);
          durationInOldStatus = Math.max(0, Math.round(durationInOldStatus * 100) / 100);
        }
      } catch (error) {
        console.error(`Error calculating duration in old status for job ${currentJob.id}:`, error);
      }

      // Create job update with duration information
      // This must be done BEFORE we return, so the update exists when time in status is calculated
      if (actorUserId) {
        await addStatusChangeUpdate(
          currentJob.id,
          currentJob.status,
          updatedJob.status,
          actorUserId,
          businessId,
          durationInOldStatus
        );
      }

      // Format duration for activity description
      let durationText = "";
      if (durationInOldStatus !== undefined && durationInOldStatus !== null) {
        if (durationInOldStatus < 1) {
          const hours = Math.round(durationInOldStatus * 24);
          if (hours < 1) {
            const minutes = Math.round(durationInOldStatus * 24 * 60);
            durationText = ` (was in previous status for ${minutes} minute${minutes !== 1 ? "s" : ""})`;
          } else {
            durationText = ` (was in previous status for ${hours} hour${hours !== 1 ? "s" : ""})`;
          }
        } else if (durationInOldStatus < 7) {
          const rounded = Math.round(durationInOldStatus * 10) / 10;
          durationText = ` (was in previous status for ${rounded} day${rounded !== 1 ? "s" : ""})`;
        } else {
          const weeks = Math.floor(durationInOldStatus / 7);
          const remainingDays = Math.round((durationInOldStatus % 7) * 10) / 10;
          if (remainingDays === 0) {
            durationText = ` (was in previous status for ${weeks} week${weeks !== 1 ? "s" : ""})`;
          } else {
            durationText = ` (was in previous status for ${weeks} week${weeks !== 1 ? "s" : ""} ${remainingDays} day${remainingDays !== 1 ? "s" : ""})`;
          }
        }
      }

      await logActivity({
        businessId: businessId,
        userId: actorUserId ?? null,
        activityType: "job_status_changed",
        description: getActivityDescription("job_status_changed", "job", updatedJob.id, {
          jobId: updatedJob.jobId,
          customerName,
          oldStatus: currentJob.status,
          newStatus: updatedJob.status,
        }) + durationText,
        entityType: "job",
        entityId: updatedJob.id,
        metadata: {
          jobId: updatedJob.jobId,
          customerName,
          oldStatus: currentJob.status,
          newStatus: updatedJob.status,
          durationInOldStatus,
        },
      });

      if (updatedJob.status === "completed") {
        await logActivity({
          businessId: businessId,
          userId: actorUserId ?? null,
          activityType: "job_completed",
          description: getActivityDescription("job_completed", "job", updatedJob.id, {
            jobId: updatedJob.jobId,
            customerName,
          }),
          entityType: "job",
          entityId: updatedJob.id,
          metadata: {
            jobId: updatedJob.jobId,
            customerName,
            completionTime: new Date().toISOString(),
          },
        });
      }
    }

    if (currentJob.status !== "ready_for_pickup" && updatedJob.status === "ready_for_pickup") {
      try {
        if (updatedJob.customerId) {
          const customer = await customerRepository.findById(updatedJob.customerId, businessId);
          if (customer?.email) {
            await sendJobCompletedEmail(customer.email, updatedJob);
            console.log(`Job ready for pickup email sent for job ${updatedJob.jobId} to ${customer.email}`);
          }
        }
      } catch (emailError) {
        console.error(`Failed to send job ready for pickup email for job ${updatedJob.jobId}:`, emailError);
      }
    }

    const payload = data as Record<string, unknown>;
    const currentRecord = currentJob as Record<string, unknown>;
    const updatedRecord = updatedJob as Record<string, unknown>;

    const changedFields = Object.keys(payload).filter((key) => {
      if (key === "status") {
        return false;
      }
      return currentRecord[key] !== updatedRecord[key];
    });

    if (changedFields.length > 0) {
      await logActivity({
        businessId: businessId,
        userId: actorUserId ?? null,
        activityType: "job_updated",
        description: getActivityDescription("job_updated", "job", updatedJob.id, {
          jobId: updatedJob.jobId,
          customerName,
          changes: changedFields.join(", "),
        }),
        entityType: "job",
        entityId: updatedJob.id,
        metadata: {
          jobId: updatedJob.jobId,
          customerName,
          changedFields,
        },
      });
    }

    return updatedJob;
  }

  async deleteJob(id: number, businessId: number, actorUserId?: number) {
    let jobInfo: { jobId: string; customerName: string } | null = null;

    try {
      const job = await jobRepository.findById(id, businessId);
      if (job) {
        jobInfo = {
          jobId: job.jobId,
          customerName: "Unknown Customer",
        };

        if (job.customerId) {
          try {
            const customer = await customerRepository.findById(job.customerId, businessId);
            if (customer) {
              jobInfo.customerName = customer.name;
            }
          } catch (error) {
            console.error("Error fetching customer for delete activity log:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching job for delete activity log:", error);
    }

    const deleted = await jobRepository.delete(id, businessId);
    if (!deleted) {
      return false;
    }

    if (jobInfo) {
      await logActivity({
        businessId: businessId,
        userId: actorUserId ?? null,
        activityType: "job_deleted",
        description: getActivityDescription("job_deleted", "job", id, {
          jobId: jobInfo.jobId,
          customerName: jobInfo.customerName,
        }),
        entityType: "job",
        entityId: id,
        metadata: {
          jobId: jobInfo.jobId,
          customerName: jobInfo.customerName,
          deletedAt: new Date().toISOString(),
        },
      });
    }

    return true;
  }
}

export const jobService = new JobService();
