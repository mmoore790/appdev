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
    <div className={cn(
      "bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800",
      className
    )}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center space-x-3">
          {greetingIcon}
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {greeting}, <span className="text-green-600 dark:text-green-400">{userName}</span>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {userRole && (
                <span className="font-medium text-green-600 dark:text-green-400 mr-2">{userRole}</span>
              )}
              Welcome to Moore Horticulture Equipment Management
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          <div className="flex items-center space-x-1.5">
            <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{formattedDate}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{formattedTime}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/tasks" className="block w-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 mr-3">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {pendingTasksCount > 0 ? `${pendingTasksCount} pending tasks` : 'No pending tasks'}
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {pendingTasksCount > 0 ? 'View your task list' : 'Create a new task'}
              </p>
            </div>
            {pendingTasksCount > 0 && (
              <div className="ml-auto">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                  {pendingTasksCount}
                </span>
              </div>
            )}
          </div>
        </Link>

        <Link href="/workshop" className="block w-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 mr-3">
              <Wrench className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {urgentJobsCount > 0 ? `${urgentJobsCount} urgent repairs` : 'Workshop status'}
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {urgentJobsCount > 0 ? 'View urgent jobs' : 'View workshop jobs'}
              </p>
            </div>
            {urgentJobsCount > 0 && (
              <div className="ml-auto">
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-red-900/30 dark:text-red-300">
                  {urgentJobsCount}
                </span>
              </div>
            )}
          </div>
        </Link>

        <Link href="/callbacks" className="block w-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 mr-3">
              <PhoneCall className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {pendingCallbacksCount > 0 ? `${pendingCallbacksCount} customer callbacks` : 'No pending callbacks'}
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {pendingCallbacksCount > 0 ? 'Return customer calls' : 'View callbacks'}
              </p>
            </div>
            {pendingCallbacksCount > 0 && (
              <div className="ml-auto">
                <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-amber-900/30 dark:text-amber-300">
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