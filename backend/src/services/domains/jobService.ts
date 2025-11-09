import { InsertJob, Job } from "@shared/schema";
import { customerRepository, jobRepository, jobUpdateRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { sendJobBookedEmail, sendJobCompletedEmail } from "../emailService";

class JobService {
  async generateNextJobId() {
    return jobRepository.generateNextJobId();
  }

  async listJobs(filter?: { customerId?: number; assignedTo?: number }) {
    const jobs = await jobRepository.findAll();

    if (filter?.customerId != null) {
      return jobs.filter((job) => job.customerId === filter.customerId);
    }

    if (filter?.assignedTo != null) {
      return jobs.filter((job) => job.assignedTo === filter.assignedTo);
    }

    return jobs;
  }

  getJobById(id: number) {
    return jobRepository.findById(id);
  }

  async getJobByJobCode(jobCode: string) {
    const jobs = await jobRepository.findAll();
    return jobs.find((job) => job.jobId === jobCode);
  }

  async getPublicJobTracker(jobId: string, email: string) {
    const jobs = await jobRepository.findAll();
    const job = jobs.find((j) => j.jobId === jobId);
    if (!job) {
      return null;
    }

    if (!job.customerId) {
      return null;
    }

    const customer = await customerRepository.findById(job.customerId);
    if (!customer) {
      return null;
    }

    if (!customer.email || customer.email.toLowerCase() !== email.toLowerCase()) {
      return undefined;
    }

    const updates = await jobUpdateRepository.findPublicByJob(job.id);

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
        const customer = await customerRepository.findById(job.customerId);
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

    return job;
  }

  async updateJob(id: number, data: Partial<Job>, actorUserId?: number) {
    const currentJob = await jobRepository.findById(id);
    if (!currentJob) {
      return undefined;
    }

    const updatedJob = await jobRepository.update(id, data);
    if (!updatedJob) {
      return undefined;
    }

    let customerName = "Unknown Customer";
    if (updatedJob.customerId) {
      try {
        const customer = await customerRepository.findById(updatedJob.customerId);
        if (customer) {
          customerName = customer.name;
        }
      } catch (error) {
        console.error("Error fetching customer for job update:", error);
      }
    }

    if (currentJob.status !== updatedJob.status) {
      await logActivity({
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
          const customer = await customerRepository.findById(updatedJob.customerId);
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

  async deleteJob(id: number, actorUserId?: number) {
    let jobInfo: { jobId: string; customerName: string } | null = null;

    try {
      const job = await jobRepository.findById(id);
      if (job) {
        jobInfo = {
          jobId: job.jobId,
          customerName: "Unknown Customer",
        };

        if (job.customerId) {
          try {
            const customer = await customerRepository.findById(job.customerId);
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

    const deleted = await jobRepository.delete(id);
    if (!deleted) {
      return false;
    }

    if (jobInfo) {
      await logActivity({
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
