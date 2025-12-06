import { InsertService } from "@shared/schema";
import { jobRepository, serviceRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";
import { jobService } from "./jobService";

class ServiceRecordService {
  listServices(businessId: number) {
    return serviceRepository.findAll(businessId);
  }

  getServiceById(id: number, businessId: number) {
    return serviceRepository.findById(id, businessId);
  }

  async createService(data: InsertService, actorUserId?: number) {
    const service = await serviceRepository.create(data);

    let jobIdLabel = "Unknown";
    if (service.jobId) {
      try {
        const job = await jobRepository.findById(service.jobId, service.businessId);
        if (job) {
          jobIdLabel = job.jobId;
        }
      } catch (error) {
        console.error("Error fetching job for service activity log:", error);
      }
    }

    await logActivity({
      businessId: service.businessId,
      userId: actorUserId ?? null,
      activityType: "service_added",
      description: getActivityDescription("service_added", "service", service.id, {
        jobId: jobIdLabel,
        serviceType: service.serviceType,
        cost: service.cost,
      }),
      entityType: "service",
      entityId: service.id,
      metadata: {
        jobId: jobIdLabel,
        serviceType: service.serviceType,
        cost: service.cost,
        laborHours: service.laborHours,
      },
    });

    // Update job's updatedAt timestamp
    if (service.jobId) {
      await jobService.touchJob(service.jobId, service.businessId);
    }

    return service;
  }

  async updateService(id: number, data: InsertService, businessId: number) {
    const service = await serviceRepository.findById(id, businessId);
    const updated = await serviceRepository.update(id, data, businessId);
    
    // Update job's updatedAt timestamp if service has a jobId
    if (updated && updated.jobId) {
      await jobService.touchJob(updated.jobId, businessId);
    }
    
    return updated;
  }
}

export const serviceRecordService = new ServiceRecordService();
