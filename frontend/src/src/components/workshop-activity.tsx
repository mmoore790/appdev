import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";

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
}

export function WorkshopActivity({ activities, isLoading = false, limit = 3 }: WorkshopActivityProps) {
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

  const ActivityBadge = ({ activityType }: { activityType: string }) => {
    switch (activityType) {
      case 'job_created':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">Job Created</span>;
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

  const ActivityList = ({ activities: activityList }: { activities: Activity[] }) => (
    <ul className="space-y-4">
      {activityList.map((activity) => (
        <li key={activity.id} className="border-b border-neutral-100 pb-4 last:border-0">
          <div className="flex space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getBgColor(activity.userId)}`}>
              {getInitials(activity.userId)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800">
                {activity.description}
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <ActivityBadge activityType={activity.activityType} />
                <span className="ml-2 text-neutral-400">{formatTimeAgo(activity.timestamp)}</span>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-6">
              {Array(3).fill(0).map((_, i) => (
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
          ) : displayedActivities.length === 0 ? (
            <div className="py-20 text-center text-neutral-500">
              <p className="text-lg font-medium mb-2">No recent activity</p>
              <p>Activity will appear here as jobs and tasks are updated</p>
            </div>
          ) : (
            <ActivityList activities={displayedActivities} />
          )}
        </CardContent>
        <CardFooter className="bg-neutral-100 px-4 py-3 text-sm text-right">
          {activities.length > 0 && (
            <button 
              onClick={() => setIsDialogOpen(true)}
              className="font-medium text-green-700 hover:text-green-800"
            >
              {activities.length > limit ? `View all activity (${activities.length})` : 'View all recent activity'}
            </button>
          )}
        </CardFooter>
      </Card>

      {/* Activity Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <DialogTitle className="text-xl font-semibold">All Recent Activity</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="h-6 w-6 p-0 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
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