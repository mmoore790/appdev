import { useQuery } from "@tanstack/react-query";
import { Activity, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInDays } from "date-fns";

export default function Activities() {
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/activities"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user ? user.fullName || user.username : `User #${userId}`;
  };

  const getInitials = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    if (!user || !user.fullName) return "MH";
    const nameParts = user.fullName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return nameParts[0].substring(0, 2).toUpperCase();
  };

  const getBgColor = (userId: number) => {
    const colors = [
      "bg-green-600", "bg-blue-600", "bg-amber-600",
      "bg-purple-600", "bg-red-600", "bg-indigo-600"
    ];
    return colors[userId % colors.length] || "bg-green-600";
  };

  const getActivityBadge = (activityType: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      'job_created': { label: 'Job Created', className: 'bg-blue-600 text-white' },
      'job_updated': { label: 'Job Updated', className: 'bg-amber-500 text-white' },
      'task_created': { label: 'Task Created', className: 'bg-green-600 text-white' },
      'task_completed': { label: 'Task Completed', className: 'bg-green-700 text-white' },
      'payment_received': { label: 'Payment', className: 'bg-emerald-600 text-white' },
    };
    const badge = badges[activityType] || { label: activityType, className: 'bg-gray-600 text-white' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      const now = new Date();
      const daysAgo = differenceInDays(now, date);

      const dateStr = format(date, "MMM d, yyyy 'at' h:mm a");
      const daysStr = daysAgo === 0 ? "Today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

      return {
        full: dateStr,
        days: daysStr,
      };
    } catch (error) {
      return {
        full: "Invalid date",
        days: "Unknown",
      };
    }
  };

  // Get unique activity types and entity types for filtering
  const activityTypes = Array.from(new Set(activities.map((a: any) => a.activityType))).sort();
  const entityTypes = Array.from(new Set(activities.map((a: any) => a.entityType).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Activity Log</h1>
        <p className="text-neutral-600 mt-2">View all system activities and events</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Activities</CardTitle>
          <CardDescription>
            {activities.length} total activity{activities.length !== 1 ? 'ies' : 'y'} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex space-x-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-neutral-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-200 rounded w-3/4" />
                    <div className="h-4 bg-neutral-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-neutral-500">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-2 text-neutral-400" />
                <p className="text-sm">No activities recorded yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity: any) => (
                <div key={activity.id} className="border-b border-neutral-100 pb-4 last:border-0">
                  <div className="flex space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getBgColor(activity.userId)}`}>
                      {getInitials(activity.userId)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">
                        {activity.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center space-x-2 flex-wrap">
                          {getActivityBadge(activity.activityType)}
                          {activity.entityType && (
                            <Badge variant="outline" className="text-xs">
                              {activity.entityType}
                            </Badge>
                          )}
                          {activity.entityId && (
                            <span className="text-xs text-neutral-500">
                              ID: {activity.entityId}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-neutral-700 whitespace-nowrap">
                            {formatTimestamp(activity.timestamp).full}
                          </div>
                          <div className="text-xs text-neutral-500 whitespace-nowrap">
                            {formatTimestamp(activity.timestamp).days}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

