import { Card, CardContent, CardFooter } from "./ui/card"; // Adjusted path
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"; // Adjusted path
import { Skeleton } from "./ui/skeleton"; // Adjusted path
import { Button } from "./ui/button"; // Adjusted path
import { formatTimeAgo } from "../lib/utils"; // Adjusted path
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface Activity {
  id: number;
  userId: number;
  activityType: string;
  description: string;
  entityType: string;
  entityId: number;
  timestamp: string;
}

interface WorkshopActivityProps {
  activities: Activity[];
  isLoading?: boolean;
  limit?: number;
  job?: {
    id: number;
    status: string;
    createdAt?: string;
    timeInStatusDays?: number;
  } | null;
  jobUpdates?: Array<{
    id: number;
    note: string;
    createdAt: string;
  }>;
}

export function WorkshopActivity({ activities, isLoading = false, limit = 3, job, jobUpdates = [] }: WorkshopActivityProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Fetch users data
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const getInitials = (userId: number) => {
    if (!Array.isArray(users)) return "MH";
    
    const user = users.find((u: any) => u.id === userId);
    if (!user || !user.fullName) return "MH"; // Default to Moore Horticulture
    
    const nameParts = user.fullName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return nameParts[0].substring(0, 2).toUpperCase();
  };

  const getBgColor = (userId: number) => {
    // Generate a consistent color based on userId for visual differentiation
    const colors = [
      "bg-green-600", "bg-blue-600", "bg-amber-600", 
      "bg-purple-600", "bg-red-600", "bg-indigo-600"
    ];
    return colors[userId % colors.length] || "bg-green-600";
  };

  const displayedActivities = activities.slice(0, limit);

  // Format time in status
  function formatTimeInStatus(days: number | undefined): string {
    if (days === undefined || days === null) return "";
    
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

  function getTimeInStatusColor(days: number | undefined): string {
    if (days === undefined || days === null) return "text-neutral-500";
    
    if (days < 1) {
      return "text-green-600";
    } else if (days < 3) {
      return "text-orange-600";
    } else {
      return "text-red-600";
    }
  }

  function formatStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      waiting_assessment: "Waiting Assessment",
      in_progress: "In Progress",
      on_hold: "On Hold",
      ready_for_pickup: "Ready for Pickup",
      completed: "Completed",
    };
    return statusMap[status] || status.replace(/_/g, " ");
  }

  const ActivityBadge = ({ activityType }: { activityType: string }) => {
    switch (activityType) {
      case 'job_created':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">Job Created</span>;
      case 'job_status_changed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-600 text-white">Status Changed</span>;
      case 'job_updated':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">Job Updated</span>;
      case 'task_created':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">Task Created</span>;
      case 'task_updated':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">Task Updated</span>;
      case 'task_completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-700 text-white">Task Completed</span>;
      case 'payment_received':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-600 text-white">Payment Received</span>;
      case 'user_login':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-white">User Login</span>;
      case 'job_started':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">In Progress</span>;
      case 'job_received':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">Parts Ordered</span>;
      case 'service_completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">Service Complete</span>;
      default:
        return null;
    }
  };

  const ActivityList = ({ activities: activityList }: { activities: Activity[] }) => {
    // Find status change activities and enhance them with time in status
    const enhancedActivities = activityList.map((activity) => {
      if (activity.activityType === "job_status_changed" && job && jobUpdates) {
        // Find the corresponding job update for this status change
        // Match by checking if the update note matches the activity description
        const statusUpdate = jobUpdates.find((update) => {
          if (!update.note) return false;
          if (!update.note.includes("Status changed from")) return false;
          
          // Try to match by checking if the update timestamp is close to activity timestamp
          const updateTime = new Date(update.createdAt).getTime();
          const activityTime = new Date(activity.timestamp).getTime();
          const timeDiff = Math.abs(updateTime - activityTime);
          
          // Allow up to 5 minutes difference (in case of slight timing differences)
          return timeDiff < 5 * 60 * 1000;
        });

        if (statusUpdate) {
          // Extract duration from the update note if it exists
          // Format: "Status changed from "X" to "Y" (was in "X" for Z)"
          const durationMatch = statusUpdate.note.match(/\(was in ".*" for (.+)\)/);
          const durationText = durationMatch ? durationMatch[1] : null;
          
          // Extract the new status from the update note
          const match = statusUpdate.note.match(/Status changed from ".*" to "(.*)"/);
          if (match && match[1]) {
            const newStatusFormatted = match[1];
            const newStatus = newStatusFormatted.replace(/\s+/g, "_").toLowerCase();
            
            // If this is the current status, show time in status
            if (newStatus === job.status && job.timeInStatusDays !== undefined) {
              return {
                ...activity,
                timeInStatus: job.timeInStatusDays,
                isCurrentStatus: true,
                previousStatusDuration: durationText,
              };
            } else {
              // Show duration in previous status
              return {
                ...activity,
                previousStatusDuration: durationText,
              };
            }
          }
        }
      }
      return activity;
    });

    return (
      <ul className="space-y-4">
        {enhancedActivities.map((activity) => {
          const activityWithTime = activity as Activity & { 
            timeInStatus?: number; 
            isCurrentStatus?: boolean;
            previousStatusDuration?: string | null;
          };
          return (
            <li key={activity.id} className="border-b border-neutral-100 pb-4 last:border-0">
              <div className="flex space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getBgColor(activity.userId)}`}>
                  {getInitials(activity.userId)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800">
                    {activity.description}
                  </p>
                  <div className="mt-2 flex items-center space-x-2 flex-wrap gap-2">
                    <ActivityBadge activityType={activity.activityType} />
                    <span className="text-neutral-400">{formatTimeAgo(activity.timestamp)}</span>
                    {activityWithTime.previousStatusDuration && (
                      <span className="text-xs text-neutral-600 font-medium">
                        • Previous status: {activityWithTime.previousStatusDuration}
                      </span>
                    )}
                    {activityWithTime.isCurrentStatus && activityWithTime.timeInStatus !== undefined && (
                      <span className={`text-xs font-semibold ${getTimeInStatusColor(activityWithTime.timeInStatus)}`}>
                        • {formatTimeInStatus(activityWithTime.timeInStatus)} in current status
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {/* Show current status time if not already shown in activities */}
        {job && job.status && job.timeInStatusDays !== undefined && 
         !enhancedActivities.some(a => (a as any).isCurrentStatus) && (
          <li className="border-b border-neutral-100 pb-4 last:border-0">
            <div className="flex space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium bg-green-600">
                <span className="text-xs">⏱</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800">
                  Job is currently in "{formatStatusLabel(job.status)}" status
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                    Current Status
                  </span>
                  <span className={`text-xs font-semibold ${getTimeInStatusColor(job.timeInStatusDays)}`}>
                    {formatTimeInStatus(job.timeInStatusDays)} in this status
                  </span>
                </div>
              </div>
            </div>
          </li>
        )}
      </ul>
    );
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setIsDialogOpen(true)}
        disabled={isLoading || activities.length === 0}
      >
        View Job History
        {activities.length > 0 && (
          <span className="ml-2 text-xs text-neutral-500">
            ({activities.length})
          </span>
        )}
      </Button>

      {/* Activity Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Job History</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-4">
            {isLoading ? (
              <div className="space-y-6">
                {Array(10).fill(0).map((_, i) => (
                  <div key={i} className="flex space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="flex space-x-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="py-20 text-center text-neutral-500">
                <p className="text-lg font-medium mb-2">No recent activity</p>
                <p>Activity will appear here as jobs and tasks are updated</p>
              </div>
            ) : (
              <ActivityList activities={activities} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}