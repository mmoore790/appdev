import {
  customerRepository,
  equipmentRepository,
  jobRepository,
  serviceRepository,
  taskRepository,
} from "../../repositories";

class AnalyticsService {
  async getSummary(userId: number) {
    const [jobs, customers, tasks, services, equipment] = await Promise.all([
      jobRepository.findAll(),
      customerRepository.findAll(),
      taskRepository.findAll(),
      serviceRepository.findAll(),
      equipmentRepository.findAll(),
    ]);

    const activeJobs = jobs.filter(
      (job) => job.status !== "completed" && job.status !== "cancelled"
    );

    const pendingTasks = tasks.filter(
      (task) =>
        task.assignedTo === userId &&
        (task.status === "todo" || task.status === "in_progress")
    );

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const completedThisWeek = jobs.filter(
      (job) =>
        job.status === "completed" &&
        job.completedAt &&
        new Date(job.completedAt) >= oneWeekAgo
    ).length;

    const completedJobs = jobs.filter(
      (job) => job.status === "completed" && job.completedAt
    );

    let avgRepairTime = 0;
    if (completedJobs.length > 0) {
      const totalDays = completedJobs.reduce((sum, job) => {
        const created = new Date(job.createdAt);
        const completed = new Date(job.completedAt!);
        return (
          sum +
          Math.ceil(
            (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
      }, 0);
      avgRepairTime = Math.round(totalDays / completedJobs.length);
    }

    const jobsByStatus = [
      { name: "Waiting Assessment", count: jobs.filter((j) => j.status === "waiting_assessment").length },
      { name: "In Progress", count: jobs.filter((j) => j.status === "in_progress").length },
      { name: "Parts Ordered", count: jobs.filter((j) => j.status === "parts_ordered").length },
      { name: "Completed", count: jobs.filter((j) => j.status === "completed").length },
    ];

    return {
      activeJobs: activeJobs.length,
      totalCustomers: customers.length,
      pendingTasks: pendingTasks.length,
      completedThisWeek,
      avgRepairTime,
      customerSatisfaction: 4.2,
      partsAvailability: 85,
      monthlyGrowth: 12,
      jobsByStatus,
      equipmentCount: equipment.length,
      serviceCount: services.length,
    };
  }
}

export const analyticsService = new AnalyticsService();
