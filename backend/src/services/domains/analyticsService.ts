import {
  customerRepository,
  equipmentRepository,
  jobRepository,
  serviceRepository,
  taskRepository,
  callbackRepository,
  userRepository,
} from "../../repositories";

class AnalyticsService {
  async getSummary(userId: number, businessId: number) {
    const [jobs, customers, tasks, services, equipment] = await Promise.all([
      jobRepository.findAll(businessId),
      customerRepository.findAll(businessId),
      taskRepository.findAll(businessId),
      serviceRepository.findAll(businessId),
      equipmentRepository.findAll(businessId),
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

  async getCallbackAnalytics(businessId: number, filters?: { fromDate?: Date; toDate?: Date }) {
    try {
      const [callbacks, users] = await Promise.all([
        callbackRepository.findAll(businessId),
        userRepository.findAll(businessId),
      ]);

      console.log("[Analytics Service] Fetched data", {
        callbacksCount: callbacks.length,
        usersCount: users.length,
      });

      // Filter by date range if provided
      let filteredCallbacks = callbacks;
      if (filters?.fromDate || filters?.toDate) {
        filteredCallbacks = callbacks.filter((callback) => {
          const requestedAt = new Date(callback.requestedAt);
          if (filters.fromDate && requestedAt < filters.fromDate) return false;
          if (filters.toDate && requestedAt > filters.toDate) return false;
          return true;
        });
        console.log("[Analytics Service] After date filter", {
          filteredCount: filteredCallbacks.length,
        });
      }

    // Get all staff members (excluding admin for performance metrics)
    const staffMembers = users.filter((u) => u.role !== "admin" && u.isActive);

    // Calculate metrics per staff member
    const staffPerformance = staffMembers.map((staff) => {
      const staffCallbacks = filteredCallbacks.filter(
        (cb) => cb.assignedTo === staff.id
      );

      const completedCallbacks = staffCallbacks.filter(
        (cb) => cb.status === "completed" && cb.completedAt
      );

      // Calculate completion times (in hours)
      const completionTimes = completedCallbacks
        .map((cb) => {
          const requested = new Date(cb.requestedAt);
          const completed = new Date(cb.completedAt!);
          return (completed.getTime() - requested.getTime()) / (1000 * 60 * 60); // Convert to hours
        })
        .filter((time) => time >= 0); // Filter out negative times (data issues)

      const avgCompletionTime =
        completionTimes.length > 0
          ? completionTimes.reduce((sum, time) => sum + time, 0) /
            completionTimes.length
          : null;

      const longestCompletionTime =
        completionTimes.length > 0
          ? Math.max(...completionTimes)
          : null;

      const pendingCount = staffCallbacks.filter(
        (cb) => cb.status === "pending"
      ).length;

      // Calculate completion rate
      const completionRate =
        staffCallbacks.length > 0
          ? (completedCallbacks.length / staffCallbacks.length) * 100
          : 0;

      // Priority breakdown
      const priorityBreakdown = {
        low: staffCallbacks.filter((cb) => cb.priority === "low").length,
        medium: staffCallbacks.filter((cb) => cb.priority === "medium").length,
        high: staffCallbacks.filter((cb) => cb.priority === "high").length,
        urgent: staffCallbacks.filter((cb) => cb.priority === "urgent").length,
      };

      return {
        staffId: staff.id,
        staffName: staff.fullName,
        totalCallbacks: staffCallbacks.length,
        completedCallbacks: completedCallbacks.length,
        pendingCallbacks: pendingCount,
        completionRate: Math.round(completionRate * 100) / 100,
        avgCompletionTimeHours: avgCompletionTime
          ? Math.round(avgCompletionTime * 100) / 100
          : null,
        longestCompletionTimeHours: longestCompletionTime
          ? Math.round(longestCompletionTime * 100) / 100
          : null,
        priorityBreakdown,
      };
    });

    // Overall statistics
    const totalCallbacks = filteredCallbacks.length;
    const totalCompleted = filteredCallbacks.filter(
      (cb) => cb.status === "completed" && cb.completedAt
    ).length;
    const totalPending = filteredCallbacks.filter(
      (cb) => cb.status === "pending"
    ).length;

    const allCompletedCallbacks = filteredCallbacks.filter(
      (cb) => cb.status === "completed" && cb.completedAt
    );

    const allCompletionTimes = allCompletedCallbacks
      .map((cb) => {
        const requested = new Date(cb.requestedAt);
        const completed = new Date(cb.completedAt!);
        return (completed.getTime() - requested.getTime()) / (1000 * 60 * 60);
      })
      .filter((time) => time >= 0);

    const overallAvgCompletionTime =
      allCompletionTimes.length > 0
        ? allCompletionTimes.reduce((sum, time) => sum + time, 0) /
          allCompletionTimes.length
        : null;

    const overallLongestCompletionTime =
      allCompletionTimes.length > 0 ? Math.max(...allCompletionTimes) : null;

    // Status breakdown
    const statusBreakdown = {
      pending: filteredCallbacks.filter((cb) => cb.status === "pending").length,
      completed: filteredCallbacks.filter((cb) => cb.status === "completed")
        .length,
      archived: filteredCallbacks.filter((cb) => cb.status === "archived")
        .length,
    };

    // Priority distribution
    const priorityDistribution = {
      low: filteredCallbacks.filter((cb) => cb.priority === "low").length,
      medium: filteredCallbacks.filter((cb) => cb.priority === "medium").length,
      high: filteredCallbacks.filter((cb) => cb.priority === "high").length,
      urgent: filteredCallbacks.filter((cb) => cb.priority === "urgent")
        .length,
    };

    // Daily callback trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCallbacks = filteredCallbacks.filter(
      (cb) => new Date(cb.requestedAt) >= thirtyDaysAgo
    );

    const dailyTrends: Record<string, { created: number; completed: number }> =
      {};
    recentCallbacks.forEach((cb) => {
      const dateKey = new Date(cb.requestedAt).toISOString().split("T")[0];
      if (!dailyTrends[dateKey]) {
        dailyTrends[dateKey] = { created: 0, completed: 0 };
      }
      dailyTrends[dateKey].created++;

      if (cb.status === "completed" && cb.completedAt) {
        const completedDateKey = new Date(cb.completedAt)
          .toISOString()
          .split("T")[0];
        if (!dailyTrends[completedDateKey]) {
          dailyTrends[completedDateKey] = { created: 0, completed: 0 };
        }
        dailyTrends[completedDateKey].completed++;
      }
    });

    return {
      summary: {
        totalCallbacks,
        totalCompleted,
        totalPending,
        overallAvgCompletionTimeHours: overallAvgCompletionTime
          ? Math.round(overallAvgCompletionTime * 100) / 100
          : null,
        overallLongestCompletionTimeHours: overallLongestCompletionTime
          ? Math.round(overallLongestCompletionTime * 100) / 100
          : null,
        completionRate:
          totalCallbacks > 0
            ? Math.round((totalCompleted / totalCallbacks) * 100 * 100) / 100
            : 0,
      },
      staffPerformance: staffPerformance.sort(
        (a, b) => b.totalCallbacks - a.totalCallbacks
      ),
      statusBreakdown,
      priorityDistribution,
      dailyTrends: Object.entries(dailyTrends)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      dateRange: {
        from: filters?.fromDate?.toISOString() || null,
        to: filters?.toDate?.toISOString() || null,
      },
    };
    } catch (error) {
      console.error("[Analytics Service] Error in getCallbackAnalytics:", error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
