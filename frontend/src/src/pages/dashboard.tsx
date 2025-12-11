import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Wrench, 
  Clock, 
  TrendingUp, 
  Calendar,
  Activity,
  BarChart3,
  PhoneCall,
  Users,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Timer,
  Target,
  Zap,
  Briefcase,
  MessageSquare,
  ArrowRight,
  ChevronRight,
  Package,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Pause,
  MoreVertical,
  UserCheck,
  CheckCircle,
  Trash2,
  Eye,
  Link as LinkIcon
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { AddMenu } from "@/components/ui/add-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, addDays, differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState, useMemo } from "react";
import { getDueDateMeta } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TaskForm } from "@/components/task-form";
import { CustomerForm } from "@/components/customer-form";
import { JobWizard } from "@/components/job-wizard";
import { ProductTour } from "@/components/product-tour";

// Define types for analytics data
interface AnalyticsSummaryData {
  activeJobs: number;
  totalCustomers?: number;
  activeCustomers?: number;
  pendingTasks: number;
  completedThisWeek: number;
  jobsByStatus?: Array<{name: string; count: number}>;
  jobsByEquipmentType?: Array<{name: string; value: number}>;
  avgRepairTime?: number;
  customerSatisfaction?: number;
  equipmentCount?: number;
  serviceCount?: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTourOpen, setIsTourOpen] = useState(false);
  
  // Dialog states
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);

  // Helper functions for callbacks
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px]">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px]">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px]">Low</Badge>;
      default:
        return <Badge className="text-[10px]">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px]">Pending</Badge>;
      case 'scheduled':
        return <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-[10px]">Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px]">Completed</Badge>;
      case 'deleted':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px]">Deleted</Badge>;
      default:
        return <Badge className="text-[10px]">Unknown</Badge>;
    }
  };

  const { data: analytics = { 
    activeJobs: 0, 
    totalCustomers: 0, 
    pendingTasks: 0, 
    completedThisWeek: 0 
  } as AnalyticsSummaryData, isLoading: analyticsLoading } = useQuery<AnalyticsSummaryData>({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
  });
  const tasks = Array.isArray(tasksData) ? tasksData : [];

  const { data: jobsData } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });
  const jobs = Array.isArray(jobsData) ? jobsData : [];

  const { data: callbacksData } = useQuery<any[]>({
    queryKey: ["/api/callbacks"],
  });
  const callbacks = Array.isArray(callbacksData) ? callbacksData : [];

  // Orders API returns paginated response
  type PaginatedResponse<T> = {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    pagination?: {
      totalPages: number;
      currentPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };

  const { data: ordersResponse, isLoading: ordersLoading } = useQuery<PaginatedResponse<any>>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const response = await fetch("/api/orders?page=1&limit=1000", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });
  const orders = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];

  const { data: notificationsData } = useQuery<{ notifications: any[]; unreadCount: number; totalCount: number }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Customers API returns paginated response
  const { data: customersResponse } = useQuery<PaginatedResponse<any>>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?page=1&limit=1000", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });
  const customers = customersResponse?.data ?? [];

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Fetch business information
  const { data: businessData } = useQuery<{
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    jobTrackerEnabled?: boolean | null;
  }>({
    queryKey: ["/api/business/me"],
  });

  // State for active tab
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "jobs" | "callbacks">("overview");

  // State for task filtering and expansion
  const [taskFilter, setTaskFilter] = useState<{
    search: string;
  }>({
    search: "",
  });
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [selectedTaskIdForDialog, setSelectedTaskIdForDialog] = useState<number | null>(null);
  const [isTaskDetailDialogOpen, setIsTaskDetailDialogOpen] = useState(false);
  const [selectedCallbackForDialog, setSelectedCallbackForDialog] = useState<any>(null);
  const [isCallbackDetailDialogOpen, setIsCallbackDetailDialogOpen] = useState(false);
  const [isCallbackCompletionDialogOpen, setIsCallbackCompletionDialogOpen] = useState(false);

  // Callback completion schema
  const callbackCompletionSchema = z.object({
    outcome: z.enum(['contacted', 'no_answer', 'voicemail', 'wrong_number', 'resolved', 'needs_followup', 'needs_job', 'needs_quote']),
    notes: z.string().min(5, "Please enter notes about the callback"),
    followUpDate: z.string().optional(),
    followUpTime: z.string().optional(),
    createTask: z.boolean().default(false),
    scheduleAppointment: z.boolean().default(false),
    jobDescription: z.string().optional(),
    taskDescription: z.string().optional(),
    appointmentDate: z.string().optional(),
    appointmentTime: z.string().optional()
  }).superRefine((data, ctx) => {
    if (data.outcome === 'needs_job') {
      if (!data.jobDescription || data.jobDescription.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['jobDescription'],
          message: "Job description is required and must be at least 10 characters when creating a job"
        });
      }
    }
    if (data.outcome === 'needs_followup' && !data.followUpDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['followUpDate'],
        message: "Follow-up date is required when scheduling a follow-up call"
      });
    }
  });

  type CallbackCompletionValues = z.infer<typeof callbackCompletionSchema>;

  // Completion form
  const completionForm = useForm<CallbackCompletionValues>({
    resolver: zodResolver(callbackCompletionSchema),
    defaultValues: {
      outcome: 'contacted',
      notes: '',
      createTask: false,
      scheduleAppointment: false
    }
  });

  // Handle callback completion
  const handleCallbackCompletion = async (data: CallbackCompletionValues) => {
    if (!selectedCallbackForDialog) return;

    try {
      const notes = `${data.outcome === 'contacted' ? '✓ Contacted' : 
                     data.outcome === 'no_answer' ? '✗ No Answer' :
                     data.outcome === 'voicemail' ? '📞 Voicemail' :
                     data.outcome === 'wrong_number' ? '✗ Wrong Number' :
                     data.outcome === 'resolved' ? '✓ Resolved' :
                     data.outcome === 'needs_followup' ? '🔄 Needs Follow-up' :
                     data.outcome === 'needs_job' ? '🔧 Needs Job' :
                     '💬 Needs Quote'}: ${data.notes}`;

      await completeCallbackMutation.mutateAsync({
        callbackId: selectedCallbackForDialog.id,
        notes
      });

      setIsCallbackCompletionDialogOpen(false);
      setIsCallbackDetailDialogOpen(false);
      setSelectedCallbackForDialog(null);
      completionForm.reset();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  // Fetch expanded task details (must be after expandedTaskId state)
  const { data: expandedTaskDetails } = useQuery<any>({
    queryKey: expandedTaskId ? [`/api/tasks/${expandedTaskId}`] : ["/api/tasks/null"],
    enabled: !!expandedTaskId,
  });

  // Mutations for quick actions
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${variables.taskId}`] });
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully.",
      });
    },
  });

  const completeCallbackMutation = useMutation({
    mutationFn: async ({ callbackId, notes }: { callbackId: number; notes?: string }) => {
      return apiRequest("POST", `/api/callbacks/${callbackId}/complete`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/callbacks"] });
      toast({
        title: "Callback completed",
        description: "Callback has been marked as completed.",
      });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const id = notificationId.replace('notification-', '');
      return apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });




  // Auto-open the product tour the first time this user lands on the dashboard
  useEffect(() => {
    if (!user) return;

    // If the user has dismissed the more detailed Getting Started page in the past,
    // respect that and don't force the tour.
    const hasDismissedGettingStarted = Boolean(
      (user as any).gettingStartedDismissedAt
    );

    const storageKey = `product_tour_seen_${user.id}`;
    const hasSeenTour = localStorage.getItem(storageKey) === "true";

    if (!hasSeenTour && !hasDismissedGettingStarted) {
      setIsTourOpen(true);
      localStorage.setItem(storageKey, "true");
    }
  }, [user]);

  // Calculate additional metrics
  const metrics = useMemo(() => {
    // Ensure all data is arrays to prevent filter errors
    const safeCallbacks = Array.isArray(callbacks) ? callbacks : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    
    const pendingCallbacks = safeCallbacks.filter((cb: any) => cb.status === "pending").length;
    // Count open orders: orders that are not marked as completed
    const openOrders = safeOrders.filter((order: any) => 
      order.status !== "completed"
    ).length;
    
    const completedJobs = safeJobs.filter((j: any) => j.status === "completed").length;
    const totalJobs = safeJobs.length;
    const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
    
    // Count pending tasks: todo (pending), in progress, or in review
    const pendingTasksCount = safeTasks.filter((t: any) => {
      const status = (t.status || "").toLowerCase();
      return (
        status === "pending" ||
        status === "todo" ||
        status === "in_progress" ||
        status === "inprogress" ||
        status === "in progress" ||
        status === "review" ||
        status === "in review"
      );
    }).length;

    // User-specific metrics for "My Overview"
    const userId = user?.id;
    const myTasks = userId ? safeTasks.filter((t: any) => t.assignedTo === userId) : [];
    const myJobs = userId ? safeJobs.filter((j: any) => j.assignedTo === userId) : [];
    const myCallbacks = userId ? safeCallbacks.filter((cb: any) => cb.assignedTo === userId) : [];

    // My Tasks breakdown
    const myPendingTasks = myTasks.filter((t: any) => {
      const status = (t.status || "").toLowerCase();
      return status === "pending" || status === "todo";
    });
    const myInProgressTasks = myTasks.filter((t: any) => {
      const status = (t.status || "").toLowerCase();
      return status === "in_progress" || status === "inprogress" || status === "in progress";
    });
    const myInReviewTasks = myTasks.filter((t: any) => {
      const status = (t.status || "").toLowerCase();
      return status === "review" || status === "in review";
    });
    // Count of active tasks (todo, in progress, or in review) - excluding completed
    const myActiveTasksCount = myTasks.filter((t: any) => {
      const status = (t.status || "").toLowerCase();
      return (
        status === "todo" ||
        status === "pending" ||
        status === "in_progress" ||
        status === "inprogress" ||
        status === "in progress" ||
        status === "review" ||
        status === "in review"
      );
    }).length;
    const myOverdueTasks = myTasks.filter((t: any) => {
      if (t.status === "completed") return false;
      const meta = getDueDateMeta(t.dueDate);
      return meta.tone === "danger";
    });
    const myDueSoonTasks = myTasks.filter((t: any) => {
      if (t.status === "completed") return false;
      const meta = getDueDateMeta(t.dueDate);
      return meta.tone === "warning" && meta.daysUntil !== null && meta.daysUntil <= 2;
    });

    // My Jobs breakdown
    // Filter out completed jobs
    const myActiveJobs = myJobs.filter((j: any) => {
      const status = (j.status || "").toLowerCase();
      return status !== "completed" && status !== "done" && status !== "finished" && status !== "cancelled";
    });
    const myWaitingAssessmentJobs = myJobs.filter((j: any) => 
      j.status === "waiting_assessment" || j.status === "waiting assessment"
    );
    const myInProgressJobs = myJobs.filter((j: any) => 
      j.status === "in_progress" || j.status === "inprogress" || j.status === "in progress"
    );
    const myWaitingPartsJobs = myJobs.filter((j: any) => 
      j.status === "waiting_parts" || j.status === "parts_ordered"
    );

    // My Callbacks breakdown - only include callbacks that are not completed (to do or to follow up)
    const myActiveCallbacks = myCallbacks.filter((cb: any) => {
      const status = (cb.status || "").toLowerCase();
      return status !== "completed" && status !== "done";
    });
    
    // Count tasks by status - using actual status values from the system
    const tasksByStatus = {
      todo: safeTasks.filter((t: any) => 
        t.status === "pending" || t.status === "todo"
      ).length,
      in_progress: safeTasks.filter((t: any) => 
        t.status === "in_progress" || t.status === "inprogress"
      ).length,
      in_review: safeTasks.filter((t: any) => 
        t.status === "review" || t.status === "in review"
      ).length,
      completed: safeTasks.filter((t: any) => 
        t.status === "completed" || t.status === "done"
      ).length,
    };

    const jobsByStatusData = Array.isArray(analytics.jobsByStatus) ? analytics.jobsByStatus : [];
    
    // Calculate additional job statuses from jobs data
    const waitingOnPartsCount = safeJobs.filter((j: any) => 
      j.status === "waiting_parts" || j.status === "parts_ordered"
    ).length;
    const readyCount = safeJobs.filter((j: any) => 
      j.status === "ready_for_pickup"
    ).length;
    
    // Build job status chart data from analytics and additional statuses
    const jobStatusChartData = [
      ...jobsByStatusData
        .filter((item: any) => item.name !== "Completed")
        .map((item: any) => {
          const colors: Record<string, string> = {
            "Waiting Assessment": "#f59e0b",
            "In Progress": "#3b82f6",
            "Parts Ordered": "#8b5cf6",
            "Completed": "#10b981",
          };
          return {
            name: item.name,
            value: item.count,
            color: colors[item.name] || "#6b7280",
          };
        }),
      // Add waiting on parts if there are any
      ...(waitingOnPartsCount > 0 ? [{
        name: "Waiting on Parts",
        value: waitingOnPartsCount,
        color: "#8b5cf6",
      }] : []),
      // Add ready if there are any
      ...(readyCount > 0 ? [{
        name: "Ready",
        value: readyCount,
        color: "#10b981",
      }] : []),
    ];

    return {
      pendingCallbacks,
      openOrders,
      completionRate,
      tasksByStatus,
      jobStatusChartData,
      pendingTasksCount,
      // User-specific metrics
      myTasks: {
        total: myTasks.length,
        active: myActiveTasksCount, // Count of todo, in progress, or in review tasks
        pending: myPendingTasks.length,
        inProgress: myInProgressTasks.length,
        overdue: myOverdueTasks.length,
        dueSoon: myDueSoonTasks.length,
        overdueList: myOverdueTasks.slice(0, 10),
        dueSoonList: myDueSoonTasks.slice(0, 10),
        pendingList: myPendingTasks.slice(0, 10),
        inProgressList: myInProgressTasks.slice(0, 10),
      },
      myJobs: {
        total: myActiveJobs.length, // Only count non-completed jobs
        active: myActiveJobs.length,
        waitingAssessment: myWaitingAssessmentJobs.length,
        inProgress: myInProgressJobs.length,
        waitingParts: myWaitingPartsJobs.length,
        activeList: myActiveJobs.slice(0, 10),
        waitingAssessmentList: myWaitingAssessmentJobs.slice(0, 10),
        waitingPartsList: myWaitingPartsJobs.slice(0, 10),
      },
      myCallbacks: {
        total: myActiveCallbacks.length, // Only count non-completed callbacks
        activeList: myActiveCallbacks.slice(0, 10),
      },
    };
  }, [callbacks, tasks, jobs, orders, analytics.jobsByStatus, user?.id]);

  // Sorted jobs assigned to user (newest first, excluding completed)
  const sortedMyJobs = useMemo(() => {
    const userId = user?.id;
    if (!userId) return [];
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const userJobs = safeJobs.filter((j: any) => {
      if (j.assignedTo !== userId) return false;
      const status = (j.status || "").toLowerCase();
      // Exclude completed jobs
      if (status === "completed" || status === "done" || status === "finished") return false;
      return true;
    });
    return [...userJobs].sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [jobs, user?.id]);

  // Filtered tasks for "My Tasks" section
  const filteredMyTasks = useMemo(() => {
    const userId = user?.id;
    if (!userId) return [];

    // Only show tasks assigned to user that are NOT completed
    // Only show: todo, pending, in_progress, in progress, inprogress, review, in review
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    let filtered = safeTasks.filter((t: any) => {
      if (t.assignedTo !== userId) return false;
      
      const status = (t.status || "").toLowerCase();
      // Exclude completed tasks
      if (status === "completed" || status === "done") return false;
      
      // Only include: todo, pending, in_progress, in progress, inprogress, review, in review
      return (
        status === "todo" ||
        status === "pending" ||
        status === "in_progress" ||
        status === "inprogress" ||
        status === "in progress" ||
        status === "review" ||
        status === "in review"
      );
    });

    // Filter by search
    if (taskFilter.search.trim()) {
      const searchLower = taskFilter.search.toLowerCase();
      filtered = filtered.filter((t: any) =>
        t.title?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort: overdue first, then due soon, then by due date, then by priority
    return filtered.sort((a: any, b: any) => {
      const aMeta = getDueDateMeta(a.dueDate);
      const bMeta = getDueDateMeta(b.dueDate);
      
      // Overdue first
      if (aMeta.tone === "danger" && bMeta.tone !== "danger") return -1;
      if (bMeta.tone === "danger" && aMeta.tone !== "danger") return 1;
      
      // Due soon next
      if (aMeta.tone === "warning" && bMeta.tone === "muted") return -1;
      if (bMeta.tone === "muted" && aMeta.tone === "warning") return 1;
      
      // Then by due date
      if (aMeta.daysUntil !== null && bMeta.daysUntil !== null) {
        return aMeta.daysUntil - bMeta.daysUntil;
      }
      if (aMeta.daysUntil !== null) return -1;
      if (bMeta.daysUntil !== null) return 1;
      
      // Then by priority
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[(a.priority || "medium").toLowerCase()] ?? 2;
      const bPriority = priorityOrder[(b.priority || "medium").toLowerCase()] ?? 2;
      return aPriority - bPriority;
    });
  }, [tasks, user?.id, taskFilter.search]);

  // Show welcome message on component load and check for auth success
  useEffect(() => {
    // Check for login success flag
    const authSuccess = localStorage.getItem('auth_success');
    
    if (user) {
      const name = user.fullName || user.username;
      
      // If user just logged in successfully, show welcome message
      if (authSuccess === 'true') {
        toast({
          title: `Welcome back, ${name}!`,
          description: "You've successfully logged in",
          duration: 3000,
        });
        
        // Clear the flag so it only shows once
        localStorage.removeItem('auth_success');
      }
    }
    
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, [user, toast]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getGreetingIcon = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return <Activity className="h-8 w-8 text-white" />;
    if (hour < 18) return <span className="text-3xl">👋</span>;
    return <Activity className="h-8 w-8 text-white" />;
  };

  const todayDate = format(currentTime, "EEEE, MMMM do, yyyy");
  const currentTimeStr = format(currentTime, "h:mm a");

  const taskSummaryData = [
    { name: "To Do", value: metrics.tasksByStatus.todo, color: "#f59e0b" },
    { name: "In Progress", value: metrics.tasksByStatus.in_progress, color: "#3b82f6" },
    { name: "In Review", value: metrics.tasksByStatus.in_review, color: "#8b5cf6" },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-4 sm:pb-6">
      {/* Header Section - Clean and Simple */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-200">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {getGreeting()}, <span className="text-emerald-600 dark:text-emerald-400">{user?.fullName?.split(" ")[0] || user?.username || "User"}</span>
          </h1>
          {businessData?.name ? (
            <p className="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300">
              {businessData.name}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <Link href="/settings" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                Update company settings
              </Link> with your business information
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1 sm:gap-1.5">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 dark:text-slate-400" />
              <span className="font-medium">{todayDate}</span>
            </span>
            <span className="flex items-center gap-1 sm:gap-1.5">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 dark:text-slate-400" />
              <span className="font-medium">{currentTimeStr}</span>
            </span>
            {user?.role && (
              <span className="capitalize px-2 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md text-[10px] sm:text-xs font-medium">
                {user.role}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 text-xs h-8 sm:h-auto"
            onClick={() => setIsTourOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden xs:inline">Product tour</span>
            <span className="xs:hidden">Tour</span>
          </Button>
          <AddMenu
            size="sm"
            onNewTask={() => setIsTaskDialogOpen(true)}
            onNewCustomer={() => setIsCustomerDialogOpen(true)}
            onNewJob={() => setIsJobDialogOpen(true)}
          />
        </div>
      </div>

      <div className="space-y-5">
        {/* Key Metrics - Large and Prominent */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">Operations Snapshot</h2>
            <Link href="/analytics">
              <Button variant="ghost" size="sm" className="text-xs h-7 sm:h-8">
                <BarChart3 className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Card className="border-slate-200 hover:border-emerald-300 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs text-slate-600 mb-0.5 sm:mb-1">Active Jobs</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
                      {analyticsLoading ? "..." : analytics.activeJobs}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 ml-2">
                    <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
                <Link href="/workshop" className="block mt-2 sm:mt-3 text-[10px] sm:text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  View workshop →
                </Link>
              </CardContent>
            </Card>
            <Card className="border-slate-200 hover:border-amber-300 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs text-slate-600 mb-0.5 sm:mb-1">Pending Tasks</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
                      {tasksLoading ? "..." : metrics.pendingTasksCount}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0 ml-2">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
                <Link href="/tasks" className="block mt-2 sm:mt-3 text-[10px] sm:text-xs text-amber-600 hover:text-amber-700 font-medium">
                  Manage tasks →
                </Link>
              </CardContent>
            </Card>
            <Card className="border-slate-200 hover:border-blue-300 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs text-slate-600 mb-0.5 sm:mb-1">Open Orders</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
                      {ordersLoading ? "..." : metrics.openOrders}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 ml-2">
                    <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
                <Link href="/orders" className="block mt-2 sm:mt-3 text-[10px] sm:text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View orders →
                </Link>
              </CardContent>
            </Card>
            <Card className="border-slate-200 hover:border-blue-300 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs text-slate-600 mb-0.5 sm:mb-1">Callbacks</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
                      {metrics.pendingCallbacks}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 ml-2">
                    <PhoneCall className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
                <Link href="/callbacks" className="block mt-2 sm:mt-3 text-[10px] sm:text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View callbacks →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Job Status Distribution */}
          <Card className="border-slate-200">
            <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold">Job Status</CardTitle>
              <CardDescription className="text-xs">Breakdown by status</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 py-3 sm:py-4">
              {analyticsLoading ? (
                <div className="h-[250px] sm:h-[300px] flex items-center justify-center">
                  <div className="text-sm sm:text-base text-slate-500">Loading...</div>
                </div>
              ) : metrics.jobStatusChartData.length > 0 ? (
                <ChartContainer
                  config={{
                    jobs: {
                      label: "Jobs",
                    },
                  }}
                  className="h-[250px] sm:h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.jobStatusChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {metrics.jobStatusChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-sm sm:text-base text-slate-500">
                  No job data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Status Summary */}
          <Card className="border-slate-200">
            <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold">Task Status</CardTitle>
              <CardDescription className="text-xs">Task distribution</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 py-3 sm:py-4">
              {tasksLoading ? (
                <div className="h-[250px] sm:h-[300px] flex items-center justify-center">
                  <div className="text-sm sm:text-base text-slate-500">Loading...</div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    tasks: {
                      label: "Tasks",
                    },
                  }}
                  className="h-[250px] sm:h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskSummaryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {taskSummaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My Overview Section - Tabbed */}
        <div className="mt-4 sm:mt-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">My Overview</h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Your personal action items and updates</p>
            </div>
          </div>
          <Card className="border-slate-200">
            <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold">My Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <div className="px-2 sm:px-4 pt-2 sm:pt-3">
                  <TabsList className="grid w-full grid-cols-4 h-8 sm:h-9 gap-1 sm:gap-0">
                    <TabsTrigger value="overview" className="text-[10px] sm:text-xs px-1 sm:px-2">
                      <span className="hidden sm:inline">Overview</span>
                      <span className="sm:hidden">All</span>
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="text-[10px] sm:text-xs px-1 sm:px-2">
                      <span className="hidden sm:inline">My Tasks</span>
                      <span className="sm:hidden">Tasks</span>
                      {metrics.myTasks.active > 0 && (
                        <Badge variant="outline" className="ml-1 sm:ml-1.5 text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0">
                          {metrics.myTasks.active}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="jobs" className="text-[10px] sm:text-xs px-1 sm:px-2">
                      <span className="hidden sm:inline">My Jobs</span>
                      <span className="sm:hidden">Jobs</span>
                      {metrics.myJobs.total > 0 && (
                        <Badge variant="outline" className="ml-1 sm:ml-1.5 text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0">
                          {metrics.myJobs.total}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="callbacks" className="text-[10px] sm:text-xs px-1 sm:px-2">
                      <span className="hidden sm:inline">My Callbacks</span>
                      <span className="sm:hidden">Calls</span>
                      {metrics.myCallbacks.total > 0 && (
                        <Badge variant="outline" className="ml-1 sm:ml-1.5 text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0">
                          {metrics.myCallbacks.total}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-2 sm:mt-4">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">Summary</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                          {/* Tasks Summary */}
                          <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 truncate">Tasks</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{metrics.myTasks.active}</p>
                            <div className="space-y-1.5">
                              {metrics.myTasks.overdue > 0 && (
                                <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                                  <span className="text-red-600 truncate">Overdue</span>
                                  <Badge variant="destructive" className="text-[9px] sm:text-[10px] px-1 py-0 flex-shrink-0 ml-1">
                                    {metrics.myTasks.overdue}
                                  </Badge>
                                </div>
                              )}
                              {metrics.myTasks.dueSoon > 0 && (
                                <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                                  <span className="text-amber-600 truncate">Due Soon</span>
                                  <Badge className="bg-amber-500 text-white text-[9px] sm:text-[10px] px-1 py-0 flex-shrink-0 ml-1">
                                    {metrics.myTasks.dueSoon}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-600">
                                <span className="truncate">Pending</span>
                                <span className="font-medium flex-shrink-0 ml-1">{metrics.myTasks.pending}</span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-600">
                                <span className="truncate">In Progress</span>
                                <span className="font-medium flex-shrink-0 ml-1">{metrics.myTasks.inProgress}</span>
                              </div>
                            </div>
                          </div>

                          {/* Jobs Summary */}
                          <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                              <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 truncate">Jobs</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{metrics.myJobs.total}</p>
                            <div className="space-y-1.5">
                              {metrics.myJobs.waitingAssessment > 0 && (
                                <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                                  <span className="text-amber-600 truncate">Waiting</span>
                                  <Badge className="bg-amber-500 text-white text-[9px] sm:text-[10px] px-1 py-0 flex-shrink-0 ml-1">
                                    {metrics.myJobs.waitingAssessment}
                                  </Badge>
                                </div>
                              )}
                              {metrics.myJobs.waitingParts > 0 && (
                                <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                                  <span className="text-purple-600 truncate">Parts</span>
                                  <Badge className="bg-purple-500 text-white text-[9px] sm:text-[10px] px-1 py-0 flex-shrink-0 ml-1">
                                    {metrics.myJobs.waitingParts}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-600">
                                <span className="truncate">In Progress</span>
                                <span className="font-medium flex-shrink-0 ml-1">{metrics.myJobs.inProgress}</span>
                              </div>
                            </div>
                          </div>

                          {/* Callbacks Summary */}
                          <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                              <PhoneCall className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 truncate">Callbacks</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.myCallbacks.total}</p>
                          </div>

                          {/* Notifications Summary */}
                          <div 
                            className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors min-h-[100px] sm:min-h-0"
                            onClick={() => {
                              // Find and click the notifications bell button in the nav bar
                              const bellButton = document.querySelector('[data-notifications-trigger]') as HTMLElement;
                              if (bellButton) {
                                bellButton.click();
                              } else {
                                // Fallback: try to find the button by its structure
                                const navButtons = document.querySelectorAll('button');
                                navButtons.forEach(btn => {
                                  const bellIcon = btn.querySelector('svg.lucide-bell, [data-lucide="bell"]');
                                  if (bellIcon) {
                                    btn.click();
                                  }
                                });
                              }
                            }}
                          >
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs font-medium text-slate-700 truncate">Unread</span>
                            </div>
                            {notificationsData ? (
                              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                                {notificationsData.unreadCount}
                              </p>
                            ) : (
                              <p className="text-xs sm:text-sm text-slate-500">Loading...</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="mt-0">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-2 sm:space-y-3">
                      {/* Summary Metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {metrics.myTasks.overdue > 0 && (
                          <div className="p-2.5 sm:p-2 bg-red-50 rounded border border-red-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm text-red-700 font-medium">Overdue</span>
                              <Badge variant="destructive" className="text-[10px] sm:text-xs flex-shrink-0 ml-2">{metrics.myTasks.overdue}</Badge>
                            </div>
                          </div>
                        )}
                        {metrics.myTasks.dueSoon > 0 && (
                          <div className="p-2.5 sm:p-2 bg-amber-50 rounded border border-amber-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm text-amber-700 font-medium">Due Soon</span>
                              <Badge className="bg-amber-500 text-white text-[10px] sm:text-xs flex-shrink-0 ml-2">{metrics.myTasks.dueSoon}</Badge>
                            </div>
                          </div>
                        )}
                      </div>

                      {metrics.myTasks.active > 0 && (
                        <>
                          {/* Filters */}
                          <div className="space-y-2">
                            <Input
                              placeholder="Search tasks..."
                              value={taskFilter.search}
                              onChange={(e) => setTaskFilter(prev => ({ ...prev, search: e.target.value }))}
                              className="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                          </div>

                          {/* Task List */}
                          <ScrollArea className="h-[300px] sm:h-[400px]">
                            <div className="space-y-2 sm:space-y-2 pr-2">
                              {filteredMyTasks.length > 0 ? (
                                filteredMyTasks.map((task: any) => {
                                  const dueMeta = getDueDateMeta(task.dueDate);
                                  const isExpanded = expandedTaskId === task.id;
                                  const priorityColors: Record<string, string> = {
                                    urgent: "bg-red-100 border-red-300 text-red-900",
                                    high: "bg-orange-100 border-orange-300 text-orange-900",
                                    medium: "bg-amber-100 border-amber-300 text-amber-900",
                                    low: "bg-blue-100 border-blue-300 text-blue-900",
                                  };
                                  const bgColor = dueMeta.tone === "danger" 
                                    ? "bg-red-50 border-red-200" 
                                    : dueMeta.tone === "warning"
                                    ? "bg-amber-50 border-amber-200"
                                    : "bg-slate-50 border-slate-200";
                                  const textColor = dueMeta.tone === "danger"
                                    ? "text-red-900"
                                    : dueMeta.tone === "warning"
                                    ? "text-amber-900"
                                    : "text-slate-900";

                                  return (
                                    <div
                                      key={task.id}
                                      className={`${bgColor} border rounded transition-all ${
                                        isExpanded ? "shadow-md" : "hover:shadow-sm"
                                      }`}
                                    >
                                      <div
                                        className="p-2.5 sm:p-2 cursor-pointer"
                                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-1">
                                              <p className={`text-xs sm:text-sm font-medium truncate ${textColor}`}>
                                                {task.title}
                                              </p>
                                              {task.priority && (
                                                <Badge
                                                  variant="outline"
                                                  className={`text-[9px] sm:text-[10px] px-1 py-0 flex-shrink-0 ${
                                                    priorityColors[(task.priority || "medium").toLowerCase()] || priorityColors.medium
                                                  }`}
                                                >
                                                  {(task.priority || "medium").toUpperCase()}
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] text-slate-600">
                                              {dueMeta.label && <span className="whitespace-nowrap">{dueMeta.label}</span>}
                                              <Badge variant="outline" className="text-[9px] sm:text-[10px]">
                                                {task.status?.replace(/_/g, " ") || "pending"}
                                              </Badge>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            {isExpanded ? (
                                              <ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-500" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-500" />
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Expanded Task Details */}
                                      {isExpanded && (
                                        <div className="border-t border-slate-200 bg-white p-3 sm:p-3 space-y-3">
                                          {expandedTaskDetails && expandedTaskDetails.id === task.id ? (
                                            <>
                                              {expandedTaskDetails.description && (
                                                <div>
                                                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">Description</p>
                                                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap break-words">
                                                    {expandedTaskDetails.description}
                                                  </p>
                                                </div>
                                              )}
                                              <Separator />
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                                                <div>
                                                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">Status</p>
                                                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                                                    {expandedTaskDetails.status?.replace(/_/g, " ") || "pending"}
                                                  </Badge>
                                                </div>
                                                <div>
                                                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">Priority</p>
                                                  <Badge
                                                    variant="outline"
                                                    className={`text-[10px] sm:text-xs ${
                                                      priorityColors[(expandedTaskDetails.priority || "medium").toLowerCase()] || priorityColors.medium
                                                    }`}
                                                  >
                                                    {(expandedTaskDetails.priority || "medium").toUpperCase()}
                                                  </Badge>
                                                </div>
                                                {expandedTaskDetails.dueDate && (
                                                  <div>
                                                    <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">Due Date</p>
                                                    <p className="text-xs sm:text-sm text-slate-700">
                                                      {format(new Date(expandedTaskDetails.dueDate), "MMM d, yyyy")}
                                                    </p>
                                                  </div>
                                                )}
                                                {expandedTaskDetails.createdAt && (
                                                  <div>
                                                    <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">Created</p>
                                                    <p className="text-xs sm:text-sm text-slate-700">
                                                      {format(new Date(expandedTaskDetails.createdAt), "MMM d, yyyy")}
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                              {expandedTaskDetails.relatedEntityType && expandedTaskDetails.relatedEntityId && (
                                                <>
                                                  <Separator />
                                                  <div>
                                                    <p className="text-[10px] sm:text-xs font-medium text-slate-600 mb-1">Related</p>
                                                    <Link
                                                      href={
                                                        expandedTaskDetails.relatedEntityType === "job"
                                                          ? `/workshop/jobs/${expandedTaskDetails.relatedEntityId}`
                                                          : "#"
                                                      }
                                                      className="text-xs sm:text-sm text-blue-600 hover:underline break-all"
                                                    >
                                                      {expandedTaskDetails.relatedEntityType} #{expandedTaskDetails.relatedEntityId}
                                                    </Link>
                                                  </div>
                                                </>
                                              )}
                                              <Separator />
                                              <div className="flex flex-col sm:flex-row gap-2">
                                                {expandedTaskDetails.status !== "in_progress" && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 sm:h-7 text-xs flex-1"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateTaskMutation.mutate({ taskId: task.id, status: "in_progress" });
                                                    }}
                                                  >
                                                    <Play className="h-3 w-3 mr-1" />
                                                    <span className="hidden sm:inline">In Progress</span>
                                                    <span className="sm:hidden">Start</span>
                                                  </Button>
                                                )}
                                                {expandedTaskDetails.status !== "completed" && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 sm:h-7 text-xs flex-1"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      updateTaskMutation.mutate({ taskId: task.id, status: "completed" });
                                                    }}
                                                  >
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Complete
                                                  </Button>
                                                )}
                                                <Button 
                                                  size="sm" 
                                                  variant="outline" 
                                                  className="h-9 sm:h-7 text-xs flex-1"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTaskIdForDialog(task.id);
                                                    setIsTaskDetailDialogOpen(true);
                                                  }}
                                                >
                                                  <span className="hidden sm:inline">View Full Details</span>
                                                  <span className="sm:hidden">Details</span>
                                                  <ChevronRight className="h-3 w-3 ml-1" />
                                                </Button>
                                              </div>
                                            </>
                                          ) : (
                                            <div className="text-xs text-slate-500 text-center py-2">Loading details...</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-xs text-slate-500 text-center py-4">
                                  No tasks match your filters
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </>
                      )}

                      {metrics.myTasks.active > 0 && (
                        <Link href="/tasks">
                          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs sm:text-sm h-9 sm:h-7">
                            View all tasks
                            <ChevronRight className="h-3.5 w-3.5 sm:h-3 sm:w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                      {metrics.myTasks.active === 0 && (
                        <p className="text-xs sm:text-sm text-slate-500 italic text-center py-3 sm:py-2">No active tasks assigned</p>
                      )}
                    </div>
                  </CardContent>
                </TabsContent>

                {/* Jobs Tab */}
                <TabsContent value="jobs" className="mt-0">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-2 sm:space-y-3">
                      {metrics.myJobs.total > 0 ? (
                        <ScrollArea className="h-[300px] sm:h-[500px]">
                          <div className="space-y-2 pr-2">
                            {sortedMyJobs.map((job: any) => {
                              const customer = customers.find((c: any) => c.id === job.customerId);
                              const jobCreatedDate = job.createdAt ? new Date(job.createdAt) : null;
                              const daysSinceCreation = jobCreatedDate 
                                ? Math.floor((new Date().getTime() - jobCreatedDate.getTime()) / (1000 * 60 * 60 * 24))
                                : null;
                              const isOldJob = daysSinceCreation !== null && daysSinceCreation > 7;

                              return (
                                <Link 
                                  key={job.id} 
                                  href={`/workshop/jobs/${job.id}`}
                                  className="block"
                                >
                                  <div className="p-3 sm:p-3 bg-slate-50 border border-slate-200 rounded mb-2 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-1">
                                          <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                                            {job.jobId || `Job #${job.id}`}
                                          </p>
                                          <Badge variant="outline" className="text-[9px] sm:text-[10px] flex-shrink-0 w-fit">
                                            {job.status?.replace(/_/g, " ") || "Unknown"}
                                          </Badge>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-700 font-medium mb-1.5 sm:mb-1 truncate">
                                          {customer?.name || job.customerName || "Unknown Customer"}
                                        </p>
                                        {job.description && (
                                          <p className="text-[10px] sm:text-xs text-slate-600 mb-1 line-clamp-2 break-words">
                                            <span className="font-medium">Work:</span> {job.description}
                                          </p>
                                        )}
                                        {job.equipmentDescription && (
                                          <p className="text-[10px] sm:text-xs text-slate-600 mb-1 line-clamp-2 break-words">
                                            <span className="font-medium">Equipment:</span> {job.equipmentDescription}
                                          </p>
                                        )}
                                        {jobCreatedDate && (
                                          <p className="text-[10px] sm:text-xs text-slate-600 mb-1">
                                            Created: {format(jobCreatedDate, "MMM d, yyyy")}
                                          </p>
                                        )}
                                        {isOldJob && (
                                          <div className="mt-2 p-1.5 sm:p-2 bg-amber-50 border border-amber-200 rounded">
                                            <p className="text-[9px] sm:text-[10px] text-amber-700 font-medium flex items-center gap-1">
                                              <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                              <span className="break-words">This job was created more than 7 days ago</span>
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-500 italic text-center py-4 sm:py-6">No jobs assigned</p>
                      )}

                      {metrics.myJobs.total > 0 && (
                        <Link href="/workshop">
                          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs sm:text-sm h-9 sm:h-7">
                            View workshop
                            <ChevronRight className="h-3.5 w-3.5 sm:h-3 sm:w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </TabsContent>

                {/* Callbacks Tab */}
                <TabsContent value="callbacks" className="mt-0">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-2 sm:space-y-3">
                      {metrics.myCallbacks.total > 0 ? (
                        <ScrollArea className="h-[300px] sm:h-[500px]">
                          <div className="space-y-2 sm:space-y-2 pr-2">
                            {metrics.myCallbacks.activeList.map((callback: any) => (
                                <div
                                  key={callback.id}
                                  className="p-2.5 sm:p-2 bg-blue-50 border border-blue-200 rounded mb-2 hover:bg-blue-100 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setSelectedCallbackForDialog(callback);
                                    setIsCallbackDetailDialogOpen(true);
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs sm:text-sm font-medium text-blue-900 truncate mb-1">
                                        {callback.customerName || "Unknown Customer"}
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-blue-700 mt-0.5 line-clamp-2 break-words">
                                        {callback.subject || callback.details || "No details"}
                                      </p>
                                      {callback.phoneNumber && (
                                        <a 
                                          href={`tel:${callback.phoneNumber}`}
                                          className="text-[10px] sm:text-xs text-blue-600 mt-1 block hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {callback.phoneNumber}
                                        </a>
                                      )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 sm:h-3 sm:w-3 text-blue-600 flex-shrink-0 mt-0.5" />
                                  </div>
                                </div>
                              ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-500 italic text-center py-4 sm:py-6">No callbacks to do or follow up</p>
                      )}

                      {metrics.myCallbacks.total > 0 && (
                        <Link href="/callbacks">
                          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs sm:text-sm h-9 sm:h-7">
                            View callbacks
                            <ChevronRight className="h-3.5 w-3.5 sm:h-3 sm:w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product Tour */}
      <ProductTour
        open={isTourOpen}
        onOpenChange={setIsTourOpen}
        userName={user?.fullName || user?.username}
        userRole={user?.role}
      />

      {/* Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            onComplete={() => {
              setIsTaskDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Customer Creation Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            onComplete={() => {
              setIsCustomerDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
              queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
            }}
            onCancel={() => setIsCustomerDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Job Creation Dialog - JobWizard already includes its own Dialog */}
      <JobWizard
        open={isJobDialogOpen}
        onOpenChange={(open) => {
          setIsJobDialogOpen(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
          }
        }}
        mode="create"
      />

      {/* Task Detail Dialog */}
      <Dialog open={isTaskDetailDialogOpen} onOpenChange={setIsTaskDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTaskIdForDialog && (
            <TaskForm 
              taskId={selectedTaskIdForDialog} 
              editMode 
              onComplete={() => {
                setIsTaskDetailDialogOpen(false);
                setSelectedTaskIdForDialog(null);
                setExpandedTaskId(null); // Close the expanded view if open
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
                queryClient.invalidateQueries({ queryKey: [`/api/tasks/${selectedTaskIdForDialog}`] });
              }} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Callback Detail Dialog */}
      <Dialog open={isCallbackDetailDialogOpen} onOpenChange={setIsCallbackDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Callback Details</DialogTitle>
            <DialogDescription>
              View detailed information about this callback request.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCallbackForDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <span className="font-medium text-slate-600">Customer:</span>
                <span>{selectedCallbackForDialog.customerName}</span>
                
                <span className="font-medium text-slate-600">Phone:</span>
                <span>{selectedCallbackForDialog.phoneNumber}</span>
                
                <span className="font-medium text-slate-600">Subject:</span>
                <span>{selectedCallbackForDialog.subject}</span>
                
                <span className="font-medium text-slate-600">Status:</span>
                <span>{getStatusBadge(selectedCallbackForDialog.status)}</span>
                
                <span className="font-medium text-slate-600">Priority:</span>
                <span>{getPriorityBadge(selectedCallbackForDialog.priority)}</span>
                
                <span className="font-medium text-slate-600">Assigned To:</span>
                <span>
                  {selectedCallbackForDialog.assignedTo 
                    ? users?.find((u: any) => u.id === selectedCallbackForDialog.assignedTo)?.fullName 
                    : <Badge variant="outline" className="bg-slate-100 text-slate-700 text-[10px]">Unassigned</Badge>}
                </span>
                
                <span className="font-medium text-slate-600">Requested:</span>
                <span>{selectedCallbackForDialog.requestedAt ? format(new Date(selectedCallbackForDialog.requestedAt), 'PPp') : 'Unknown'}</span>
                
                {selectedCallbackForDialog.completedAt && (
                  <>
                    <span className="font-medium text-slate-600">Completed:</span>
                    <span>{format(new Date(selectedCallbackForDialog.completedAt), 'PPp')}</span>
                  </>
                )}
              </div>
              
              {selectedCallbackForDialog.details && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-600">Details:</h4>
                  <p className="text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-md">{selectedCallbackForDialog.details}</p>
                </div>
              )}
              
              {selectedCallbackForDialog.notes && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-600">Completion Notes:</h4>
                  <p className="text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-md">{selectedCallbackForDialog.notes}</p>
                </div>
              )}
              
              {selectedCallbackForDialog.status === 'pending' && (
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => {
                      setIsCallbackDetailDialogOpen(false);
                      setIsCallbackCompletionDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallbackDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Callback Completion Dialog */}
      <Dialog open={isCallbackCompletionDialogOpen} onOpenChange={(open) => {
        setIsCallbackCompletionDialogOpen(open);
        if (!open) {
          completionForm.reset();
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Callback Request</DialogTitle>
            <DialogDescription>
              Record the outcome of the callback and any follow-on actions needed.
            </DialogDescription>
          </DialogHeader>
          <Form {...completionForm}>
            <form onSubmit={completionForm.handleSubmit(handleCallbackCompletion)} className="space-y-6">
              {/* Call Outcome */}
              <FormField
                control={completionForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Outcome *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="contacted">✓ Successfully Contacted</SelectItem>
                        <SelectItem value="resolved">✓ Issue Resolved</SelectItem>
                        <SelectItem value="no_answer">✗ No Answer</SelectItem>
                        <SelectItem value="voicemail">📞 Left Voicemail</SelectItem>
                        <SelectItem value="wrong_number">✗ Wrong Number</SelectItem>
                        <SelectItem value="needs_followup">🔄 Needs Follow-up Call</SelectItem>
                        <SelectItem value="needs_job">🔧 Needs Job Created</SelectItem>
                        <SelectItem value="needs_quote">💬 Needs Quote/Estimate</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={completionForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter details about the call, what was discussed, and any important information..." 
                        {...field} 
                        rows={5}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Follow-up Date/Time - shown when outcome is needs_followup */}
              {completionForm.watch('outcome') === 'needs_followup' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={completionForm.control}
                    name="followUpDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follow-up Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={completionForm.control}
                    name="followUpTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follow-up Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Create Job Option */}
              {completionForm.watch('outcome') === 'needs_job' && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Job Creation Required</p>
                      <p className="text-sm text-blue-700 mt-1">
                        A job will be automatically created when you complete this callback. Please provide the job description below.
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={completionForm.control}
                    name="jobDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the work needed for the job (equipment, issue, etc.)..." 
                            {...field} 
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Create Task Option */}
              <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <FormField
                  control={completionForm.control}
                  name="createTask"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Create Follow-up Task</FormLabel>
                        <p className="text-sm text-slate-600">
                          Create a task for any follow-up work needed
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                {completionForm.watch('createTask') && (
                  <FormField
                    control={completionForm.control}
                    name="taskDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe what needs to be done..." 
                            {...field} 
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCallbackCompletionDialogOpen(false);
                    completionForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={completeCallbackMutation.isPending}
                >
                  {completeCallbackMutation.isPending ? 'Completing...' : 'Complete Callback'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
