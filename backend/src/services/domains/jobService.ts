import { InsertJob, Job } from "@shared/schema";
import { customerRepository, jobRepository, jobUpdateRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { sendJobBookedEmail, sendJobCompletedEmail } from "../emailService";
import { notificationService } from "../notificationService";

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

    if (filter?.customerId != null) {
      return jobs.filter((job) => job.customerId === filter.customerId);
    }

    if (filter?.assignedTo != null) {
      // Filter by assignee (still scoped to businessId for security)
      return jobs.filter((job) => job.assignedTo === filter.assignedTo);
    }

    return jobs;
  }

  getJobById(id: number, businessId: number) {
    return jobRepository.findById(id, businessId);
  }

  async getJobByJobCode(jobCode: string, businessId: number) {
    const jobs = await jobRepository.findAll(businessId);
    return jobs.find((job) => job.jobId === jobCode);
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
    const job = await jobRepository.create(data);

    let customerName = "Unknown Customer";

    if (job.customerId) {
      try {
        const customer = await customerRepository.findById(job.customerId, job.businessId);
        if (customer) {
          customerName = customer.name;

          if (customer.email) {
            try {
              await sendJobBookedEmail(job, customer);
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
      await logActivity({
        businessId: businessId,
        userId: actorUserId ?? null,
        activityType: "job_status_changed",
        description: getActivityDescription("job_status_changed", "job", updatedJob.id, {
          jobId: updatedJob.jobId,
          customerName,
          oldStatus: currentJob.status,
          newStatus: updatedJob.status,
        }),
        entityType: "job",
        entityId: updatedJob.id,
        metadata: {
          jobId: updatedJob.jobId,
          customerName,
          oldStatus: currentJob.status,
          newStatus: updatedJob.status,
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
