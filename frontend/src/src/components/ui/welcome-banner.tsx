import { useEffect, useState } from "react";
import { Bell, Calendar, Clock, Sun, Moon, Wrench, PhoneCall } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface WelcomeBannerProps {
  userName: string;
  userRole?: string;
  className?: string;
}

export function WelcomeBanner({ userName, userRole, className }: WelcomeBannerProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [greetingIcon, setGreetingIcon] = useState<React.ReactNode>(null);
  
  // Fetch real-time data for actionable information
  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks?pendingOnly=true"],
  });
  
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs?activeOnly=true"],
  });
  
  const { data: callbacks = [] } = useQuery<any[]>({
    queryKey: ["/api/callbacks?status=pending"],
    queryFn: () => apiRequest('GET', '/api/callbacks?status=pending'),
  });
  
  const pendingTasksCount = tasks.length;
  const urgentJobsCount = jobs.filter(job => 
    job.status === "emergency" || job.priority === "high"
  ).length;
  const pendingCallbacksCount = callbacks.length;

  // Update the time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Determine the greeting based on time of day
  useEffect(() => {
    const hours = currentTime.getHours();
    if (hours >= 5 && hours < 12) {
      setGreeting("Good morning");
      setGreetingIcon(<Sun className="h-7 w-7 text-amber-400" />);
    } else if (hours >= 12 && hours < 18) {
      setGreeting("Good afternoon");
      setGreetingIcon(<Sun className="h-7 w-7 text-orange-400" />);
    } else {
      setGreeting("Good evening");
      setGreetingIcon(<Moon className="h-7 w-7 text-indigo-400" />);
    }
  }, [currentTime]);

  // Format the current date
  const formattedDate = format(currentTime, "EEEE, MMMM do, yyyy");
  const formattedTime = format(currentTime, "h:mm a");

  return (
      <div
        className={cn(
          "rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-5 shadow-sm shadow-black/5 backdrop-blur",
          className,
        )}
      >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center space-x-3">
          {greetingIcon}
          <div>
              <h1 className="text-2xl font-bold text-foreground">
                {greeting},{" "}
                <span className="text-primary">
                  {userName}
                </span>
            </h1>
              <p className="text-sm text-muted-foreground">
              {userRole && (
                  <span className="mr-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {userRole}
                  </span>
              )}
              Welcome to Moore Horticulture Equipment Management
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          <div className="flex items-center space-x-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{formattedDate}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{formattedTime}</span>
          </div>
        </div>
      </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/tasks" className="block w-full">
            <div className="flex items-center rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-lg">
              <div className="mr-3 rounded-2xl bg-primary/10 p-2 text-primary">
                <Clock className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {pendingTasksCount > 0 ? `${pendingTasksCount} pending tasks` : 'No pending tasks'}
              </p>
                <p className="text-sm font-semibold text-foreground">
                {pendingTasksCount > 0 ? 'View your task list' : 'Create a new task'}
              </p>
            </div>
            {pendingTasksCount > 0 && (
              <div className="ml-auto">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {pendingTasksCount}
                </span>
              </div>
            )}
          </div>
        </Link>

        <Link href="/workshop" className="block w-full">
            <div className="flex items-center rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-lg">
              <div className="mr-3 rounded-2xl bg-accent/15 p-2 text-accent">
                <Wrench className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {urgentJobsCount > 0 ? `${urgentJobsCount} urgent repairs` : 'Workshop status'}
              </p>
                <p className="text-sm font-semibold text-foreground">
                {urgentJobsCount > 0 ? 'View urgent jobs' : 'View workshop jobs'}
              </p>
            </div>
            {urgentJobsCount > 0 && (
              <div className="ml-auto">
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-500/20 dark:text-red-200">
                  {urgentJobsCount}
                </span>
              </div>
            )}
          </div>
        </Link>

        <Link href="/callbacks" className="block w-full">
            <div className="flex items-center rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-lg">
              <div className="mr-3 rounded-2xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
                <PhoneCall className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {pendingCallbacksCount > 0 ? `${pendingCallbacksCount} customer callbacks` : 'No pending callbacks'}
              </p>
                <p className="text-sm font-semibold text-foreground">
                {pendingCallbacksCount > 0 ? 'Return customer calls' : 'View callbacks'}
              </p>
            </div>
            {pendingCallbacksCount > 0 && (
              <div className="ml-auto">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
                  {pendingCallbacksCount}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}