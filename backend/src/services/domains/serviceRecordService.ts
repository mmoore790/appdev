import { InsertService } from "@shared/schema";
import { jobRepository, serviceRepository } from "../../repositories";
import { getActivityDescription, logActivity } from "../activityService";

class ServiceRecordService {
  listServices() {
    return serviceRepository.findAll();
  }

  getServiceById(id: number) {
    return serviceRepository.findById(id);
  }

  async createService(data: InsertService, actorUserId?: number) {
    const service = await serviceRepository.create(data);

    let jobIdLabel = "Unknown";
    if (service.jobId) {
      try {
        const job = await jobRepository.findById(service.jobId);
        if (job) {
          jobIdLabel = job.jobId;
        }
      } catch (error) {
        console.error("Error fetching job for service activity log:", error);
      }
    }

    await logActivity({
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

    return service;
  }

  updateService(id: number, data: InsertService) {
    return serviceRepository.update(id, data);
  }
}

export const serviceRecordService = new ServiceRecordService();
