import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  Clock,
  TrendingUp,
  Calendar,
  Activity,
  PhoneCall,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { TaskList } from "@/components/task-list";
import { WorkshopActivity } from "@/components/workshop-activity";
import { AddMenu } from "@/components/ui/add-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Define types for analytics data
interface AnalyticsSummaryData {
  activeJobs: number;
  activeCustomers: number;
  pendingTasks: number;
  completedThisWeek: number;
  jobsByStatus?: Record<string, number>;
  jobsByEquipmentType?: Array<{name: string; value: number}>;
  avgRepairTime?: string;
  customerSatisfaction?: number;
  revenueByMonth?: Array<{month: string; value: number}>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: analytics = { 
    activeJobs: 0, 
    activeCustomers: 0, 
    pendingTasks: 0, 
    completedThisWeek: 0 
  } as AnalyticsSummaryData, isLoading: analyticsLoading } = useQuery<AnalyticsSummaryData>({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks?pendingOnly=true"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<any[]>({
    queryKey: ["/api/activities"],
  });

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
    if (hour < 12) return <Activity className="h-4 w-4" />;
    if (hour < 18) return <span className="text-base">👋</span>;
    return <Activity className="h-4 w-4" />;
  };

  const todayDate = format(currentTime, "EEEE, MMMM do, yyyy");
  const currentTimeStr = format(currentTime, "h:mm a");

  const quickActions = [
    {
      title: "Workshop",
      description: "Manage jobs",
      href: "/workshop",
      icon: <Wrench className="h-5 w-5" />,
      accent: "bg-primary/10 text-primary",
    },
    {
      title: "Tasks",
      description: "View pending",
      href: "/tasks",
      icon: <Clock className="h-5 w-5" />,
      accent: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200",
    },
    {
      title: "Callbacks",
      description: "Customer calls",
      href: "/callbacks",
      icon: <PhoneCall className="h-5 w-5" />,
      accent: "bg-accent/15 text-accent",
    },
    {
      title: "Analytics",
      description: "View reports",
      href: "/analytics",
      icon: <TrendingUp className="h-5 w-5" />,
      accent: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-200",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <section className="rounded-3xl border border-border/60 bg-card/80 shadow-sm shadow-black/5 backdrop-blur">
        <div className="flex flex-col gap-8 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                    {getGreetingIcon()}
                  </span>
                  {getGreeting()}
                </span>
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {todayDate}
              </span>
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <Clock className="h-4 w-4" />
                {currentTimeStr}
              </span>
            </div>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
              {getGreeting()}, {user?.fullName || user?.username || "User"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {user?.role && (
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">
                  {user.role}
                </span>
              )}
              <span>Moore Horticulture Equipment</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AddMenu size="sm" />
          </div>
        </div>
      </section>

      <section className="space-y-8">
        {/* Key Metrics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Workshop Overview
            </h2>
            <span className="text-xs text-muted-foreground/80">
              Live snapshot of performance
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              title="Active Jobs"
              value={analyticsLoading ? "..." : analytics.activeJobs}
              icon={<Wrench size={24} />}
              iconColor="bg-primary/15 text-primary"
              footerText="View workshop"
              footerLink="/workshop"
            />
            <StatCard
              title="Pending Tasks"
              value={analyticsLoading ? "..." : analytics.pendingTasks}
              icon={<Clock size={24} />}
              iconColor="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200"
              footerText="Manage tasks"
              footerLink="/tasks"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Quick Actions
            </h2>
            <span className="text-xs text-muted-foreground/80">
              Navigate to frequent workflows
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href}>
                <Card className="group cursor-pointer border border-border/50 bg-card/70 transition-all hover:-translate-y-1 hover:border-border hover:shadow-lg hover:shadow-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "rounded-2xl p-2 transition-transform transition-colors duration-200 group-hover:scale-105",
                          action.accent,
                        )}
                      >
                        {action.icon}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{action.title}</p>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Recent Activity
            </h2>
            <span className="text-xs text-muted-foreground/80">
              Latest updates across the workshop
            </span>
          </div>
          <WorkshopActivity
            isLoading={activitiesLoading}
            activities={activities}
            limit={10}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Priority Tasks
            </h2>
            <span className="text-xs text-muted-foreground/80">
              Focus on the work that needs attention
            </span>
          </div>
          <TaskList
            isLoading={tasksLoading}
            tasks={tasks}
            users={users}
            showAddButton
          />
        </div>
      </section>
    </div>
  );
}
