import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ChevronRight
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [additionalMetricsOpen, setAdditionalMetricsOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  
  // Dialog states
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);

  const { data: analytics = { 
    activeJobs: 0, 
    totalCustomers: 0, 
    pendingTasks: 0, 
    completedThisWeek: 0 
  } as AnalyticsSummaryData, isLoading: analyticsLoading } = useQuery<AnalyticsSummaryData>({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: callbacks = [] } = useQuery<any[]>({
    queryKey: ["/api/callbacks"],
  });




  // Auto-open the product tour the first time this user lands on the dashboard
  useEffect(() => {
    if (!user) return;

    // If the user has dismissed the more detailed Getting Started page in the past,
    // respect that and don't force the tour.
    const hasDismissedGettingStarted = Boolean(
      // @ts-expect-error gettingStartedDismissedAt is part of the backend User type
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
    const pendingCallbacks = callbacks.filter((cb: any) => cb.status === "pending").length;
    // Use the same logic as the rest of the app to determine overdue tasks
    const overdueTasks = tasks.filter((task: any) => {
      // Exclude completed, archived, deleted, and cancelled tasks
      if (
        task.status === "completed" ||
        task.status === "archived" ||
        task.status === "deleted" ||
        task.status === "cancelled"
      ) {
        return false;
      }
      // Only check overdue for tasks with a due date
      if (!task.dueDate) return false;
      // Use getDueDateMeta to properly determine if task is overdue
      const dueMeta = getDueDateMeta(task.dueDate);
      return dueMeta.tone === "danger"; // "danger" tone means overdue
    }).length;
    
    const completedJobs = jobs.filter((j: any) => j.status === "completed").length;
    const totalJobs = jobs.length;
    const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
    
    // Count tasks by status - using actual status values from the system
    const tasksByStatus = {
      todo: tasks.filter((t: any) => 
        t.status === "pending" || t.status === "todo"
      ).length,
      in_progress: tasks.filter((t: any) => 
        t.status === "in_progress" || t.status === "inprogress"
      ).length,
      completed: tasks.filter((t: any) => 
        t.status === "completed" || t.status === "done"
      ).length,
    };

    const jobsByStatusData = analytics.jobsByStatus || [];
    const jobStatusChartData = jobsByStatusData.map((item: any) => {
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
    });

    return {
      pendingCallbacks,
      overdueTasks,
      completionRate,
      tasksByStatus,
      jobStatusChartData,
    };
  }, [callbacks, tasks, jobs, analytics.jobsByStatus]);

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
    { name: "Completed", value: metrics.tasksByStatus.completed, color: "#10b981" },
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* Header Section - Clean and Simple */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {user?.fullName?.split(" ")[0] || user?.username || "User"}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {todayDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {currentTimeStr}
            </span>
            {user?.role && (
              <span className="capitalize px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                {user.role}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 text-xs"
            onClick={() => setIsTourOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            Product tour
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Quick Overview</h2>
            <Link href="/analytics">
              <Button variant="ghost" size="sm" className="text-xs h-7">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Analytics
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border-slate-200 hover:border-emerald-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Active Jobs</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {analyticsLoading ? "..." : analytics.activeJobs}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <Wrench className="h-6 w-6 text-white" />
                  </div>
                </div>
                <Link href="/workshop" className="block mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  View workshop →
                </Link>
              </CardContent>
            </Card>
            <Card className="border-slate-200 hover:border-amber-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Pending Tasks</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {analyticsLoading ? "..." : analytics.pendingTasks}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-amber-500 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
                <Link href="/tasks" className="block mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium">
                  Manage tasks →
                </Link>
              </CardContent>
            </Card>
            <Card className={`border-slate-200 transition-colors ${metrics.overdueTasks > 0 ? 'border-red-300 bg-red-50/30' : 'hover:border-red-300'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Overdue Tasks</p>
                    <p className={`text-3xl font-bold ${metrics.overdueTasks > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {metrics.overdueTasks}
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${metrics.overdueTasks > 0 ? 'bg-red-500' : 'bg-slate-400'}`}>
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <Link href="/tasks" className="block mt-3 text-xs text-red-600 hover:text-red-700 font-medium">
                  View tasks →
                </Link>
              </CardContent>
            </Card>
            <Card className="border-slate-200 hover:border-blue-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Callbacks</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {metrics.pendingCallbacks}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-blue-500 flex items-center justify-center">
                    <PhoneCall className="h-6 w-6 text-white" />
                  </div>
                </div>
                <Link href="/callbacks" className="block mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View callbacks →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Metrics - Compact Row */}
        <Collapsible open={additionalMetricsOpen} onOpenChange={setAdditionalMetricsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <Card className="cursor-pointer hover:bg-slate-50 transition-colors border-slate-200">
                <CardHeader className="pb-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Additional Metrics</CardTitle>
                      <CardDescription className="text-xs">Performance statistics</CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${additionalMetricsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </Card>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-slate-200">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Customers</p>
                    <p className="text-xl font-bold text-slate-900">
                      {analyticsLoading ? "..." : analytics.totalCustomers || 0}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Avg Repair</p>
                    <p className="text-xl font-bold text-slate-900">
                      {analyticsLoading ? "..." : analytics.avgRepairTime ? `${analytics.avgRepairTime}d` : "N/A"}
                    </p>
                  </div>

                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Completion</p>
                    <p className="text-xl font-bold text-slate-900">
                      {metrics.completionRate}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Charts Section - Collapsible */}
        <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <Card className="cursor-pointer hover:bg-slate-50 transition-colors border-slate-200">
                <CardHeader className="pb-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Charts & Visualizations</CardTitle>
                      <CardDescription className="text-xs">Status breakdowns</CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${chartsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </Card>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
              {/* Job Status Distribution */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 border-b border-slate-200">
                  <CardTitle className="text-sm font-semibold">Job Status</CardTitle>
                  <CardDescription className="text-xs">Breakdown by status</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-slate-500">Loading...</div>
                    </div>
                  ) : metrics.jobStatusChartData.length > 0 ? (
                    <ChartContainer
                      config={{
                        jobs: {
                          label: "Jobs",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.jobStatusChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {metrics.jobStatusChartData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-500">
                      No job data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Task Status Summary */}
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 border-b border-slate-200">
                  <CardTitle className="text-sm font-semibold">Task Status</CardTitle>
                  <CardDescription className="text-xs">Task distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {tasksLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-slate-500">Loading...</div>
                    </div>
                  ) : (
                    <ChartContainer
                      config={{
                        tasks: {
                          label: "Tasks",
                        },
                      }}
                      className="h-[300px]"
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
          </CollapsibleContent>
        </Collapsible>


        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Task Summary Card */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900">Task Overview</h2>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Manage
                </Button>
              </Link>
            </div>
            <Card className="h-[500px] flex flex-col border-slate-200">
              <CardHeader className="border-b border-slate-200 px-4 py-3">
                <CardTitle className="text-base">Task Summary</CardTitle>
                <CardDescription className="text-xs">Current task distribution</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-4">
                {tasksLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-slate-500">Loading tasks...</div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div>
                          <p className="text-xs text-amber-700 mb-1">To Do</p>
                          <p className="text-3xl font-bold text-amber-900">{metrics.tasksByStatus.todo}</p>
                        </div>
                        <div className="h-10 w-10 rounded bg-amber-500 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <p className="text-xs text-blue-700 mb-1">In Progress</p>
                          <p className="text-3xl font-bold text-blue-900">{metrics.tasksByStatus.in_progress}</p>
                        </div>
                        <div className="h-10 w-10 rounded bg-blue-500 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div>
                          <p className="text-xs text-emerald-700 mb-1">Completed</p>
                          <p className="text-3xl font-bold text-emerald-900">{metrics.tasksByStatus.completed}</p>
                        </div>
                        <div className="h-10 w-10 rounded bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                    
                    {metrics.overdueTasks > 0 && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-red-900 text-sm">{metrics.overdueTasks} Overdue Task{metrics.overdueTasks > 1 ? 's' : ''}</div>
                            <div className="text-xs text-red-700 mt-0.5">Requires immediate attention</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-slate-200">
                      <Link href="/tasks">
                        <Button className="w-full" variant="outline" size="sm">
                          <Zap className="h-3.5 w-3.5 mr-2" />
                          View All Tasks
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
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
    </div>
  );
}
