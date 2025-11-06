import { useQuery } from "@tanstack/react-query";
import { 
  Wrench, 
  Clock, 
  Download, 
  TrendingUp, 
  Calendar,
  Activity,
  BarChart3,
  Settings,
  PhoneCall
} from "lucide-react";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TaskList } from "@/components/task-list";
import { WorkshopActivity } from "@/components/workshop-activity";
import { AddMenu } from "@/components/ui/add-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useState } from "react";

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
    if (hour < 12) return <Activity className="h-8 w-8 text-white" />;
    if (hour < 18) return <span className="text-3xl">👋</span>;
    return <Activity className="h-8 w-8 text-white" />;
  };

  const todayDate = format(currentTime, "EEEE, MMMM do, yyyy");
  const currentTimeStr = format(currentTime, "h:mm a");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {getGreeting()}, {user?.fullName || user?.username || 'User'}
                </h1>
                <div className="flex items-center space-x-4 mt-1">
                  <p className="text-slate-600 font-medium">
                    {user?.role && (
                      <span className="capitalize bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-semibold mr-2">
                        {user.role}
                      </span>
                    )}
                    Moore Horticulture Equipment
                  </p>
                  <div className="flex items-center text-sm text-slate-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    {todayDate}
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <Clock className="h-4 w-4 mr-1" />
                    {currentTimeStr}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <AddMenu size="sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Workshop Overview</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <StatCard
              title="Active Jobs"
              value={analyticsLoading ? "..." : analytics.activeJobs}
              icon={<Wrench size={24} />}
              iconColor="bg-blue-500"
              footerText="View workshop"
              footerLink="/workshop"
            />
            <StatCard
              title="Pending Tasks"
              value={analyticsLoading ? "..." : analytics.pendingTasks}
              icon={<Clock size={24} />}
              iconColor="bg-amber-500"
              footerText="Manage tasks"
              footerLink="/tasks"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/workshop">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Workshop</p>
                      <p className="text-xs text-slate-500">Manage jobs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/tasks">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Tasks</p>
                      <p className="text-xs text-slate-500">View pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/callbacks">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <PhoneCall className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Callbacks</p>
                      <p className="text-xs text-slate-500">Customer calls</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/analytics">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Analytics</p>
                      <p className="text-xs text-slate-500">View reports</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
            <WorkshopActivity 
              isLoading={activitiesLoading} 
              activities={activities}
              limit={10}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Priority Tasks</h2>
            <TaskList 
              isLoading={tasksLoading} 
              tasks={tasks} 
              users={users}
              showAddButton 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
