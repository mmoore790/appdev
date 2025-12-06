import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageSquare, CheckSquare, Briefcase, PhoneCall, Loader2, X, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: 'message' | 'task' | 'job' | 'callback' | 'calendar';
  title: string;
  description: string;
  link: string;
  timestamp: string;
  priority: 'high' | 'normal';
  icon: string;
  entityId?: number;
  isRead: boolean;
  relativeTime: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
}

export function NotificationsDropdown() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const notifications = data?.notifications || [];
  const totalCount = data?.totalCount || 0;
  const unreadCount = data?.unreadCount || 0;

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => {
      // Extract numeric ID from "notification-123" format
      const id = notificationId.replace('notification-', '');
      return apiRequest('POST', `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Failed to mark all as read",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => {
      // Extract numeric ID from "notification-123" format
      const id = notificationId.replace('notification-', '');
      return apiRequest('DELETE', `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: () => {
      toast({
        title: "Failed to delete notification",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    // Navigation will be handled by the Link component
  };

  const handleDismiss = (e: React.MouseEvent, notificationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNotificationMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'task':
        return <CheckSquare className="h-4 w-4" />;
      case 'job':
        return <Briefcase className="h-4 w-4" />;
      case 'callback':
        return <PhoneCall className="h-4 w-4" />;
      case 'calendar':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getIconColor = (type: string, priority: string) => {
    if (priority === 'high') {
      return 'text-red-600';
    }
    switch (type) {
      case 'message':
        return 'text-blue-600';
      case 'task':
        return 'text-amber-600';
      case 'job':
        return 'text-emerald-600';
      case 'callback':
        return 'text-purple-600';
      case 'calendar':
        return 'text-indigo-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
              {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-white border border-slate-200 shadow-lg">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} {unreadCount === 1 ? 'unread' : 'unread'}
            </Badge>
          )}
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-slate-600 hover:text-slate-900"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              {markAllAsReadMutation.isPending ? 'Marking...' : 'Mark all read'}
            </Button>
          )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className={cn("transition-all duration-200", isExpanded ? "h-[600px]" : "h-[400px]")}>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No notifications</p>
              <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "group relative px-3 py-3 hover:bg-slate-50 transition-colors",
                    notification.priority === 'high' && "bg-red-50/50",
                    !notification.isRead && "bg-blue-50/30"
                  )}
                >
                  <Link 
                    href={notification.link} 
                    className="block pr-6"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 flex-shrink-0",
                        getIconColor(notification.type, notification.priority)
                      )}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm font-medium",
                            !notification.isRead && "font-semibold",
                            notification.priority === 'high' ? "text-red-900" : "text-slate-900"
                          )}>
                            {notification.title}
                            {!notification.isRead && (
                              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                            )}
                          </p>
                          {notification.priority === 'high' && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {notification.description}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {notification.relativeTime}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => handleDismiss(e, notification.id)}
                    disabled={deleteNotificationMutation.isPending}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                    title="Delete notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-center text-xs"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Show less' : `View all notifications (${totalCount})`}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

