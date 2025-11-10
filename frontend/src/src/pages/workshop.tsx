import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Plus, Calendar } from "lucide-react";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { WorkshopJobsTable } from "@/components/workshop-jobs-table";
import { JobWizard } from "@/components/job-wizard";
import { PrintWorkOrders } from "@/components/print-work-orders";
import { format, subDays, isWithinInterval } from "date-fns";
import { StatCard } from "@/components/ui/stat-card";

export default function Workshop() {
  const [triggerJobCreation, setTriggerJobCreation] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  
  // Date filter state - default to last 31 days
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const thirtyOneDaysAgo = subDays(today, 31);
    return {
      from: thirtyOneDaysAgo,
      to: today
    };
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const mechanics = Array.isArray(users) ? users.filter((user: any) => user.role === "mechanic") : [];

  // Filter jobs by date range
  const filteredJobs = useMemo(() => {
    if (!jobs || !dateRange.from || !dateRange.to) return jobs || [];
    
    return Array.isArray(jobs) ? jobs.filter((job: any) => {
      const jobDate = new Date(job.createdAt);
      return isWithinInterval(jobDate, {
        start: dateRange.from,
        end: dateRange.to
      });
    }) : [];
  }, [jobs, dateRange]);

  const getJobsByStatus = (status: string) => {
    return Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === status) : [];
  };

  const getJobsByMechanic = (mechanicId: number) => {
    return Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.assignedTo === mechanicId) : [];
  };

  const getCompletedJobs = () => {
    return Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === "completed") : [];
  };

  // Workshop capacity metrics
  const workshopMetrics = useMemo(() => {
    if (!jobs || !Array.isArray(jobs)) {
      return {
        jobsInProgress: 0,
        activeJobs: 0,
        jobsLast7Days: 0
      };
    }

    // Jobs currently in progress (including parts ordered)
    const jobsInProgress = jobs.filter((job: any) => 
      job.status === "in_progress" || job.status === "parts_ordered"
    ).length;

    // Active jobs (excluding ready for pickup and completed)
    const activeJobs = jobs.filter((job: any) => 
      job.status !== "ready_for_pickup" && 
      job.status !== "completed"
    ).length;

    // Jobs created in the last 7 days
    const sevenDaysAgo = subDays(new Date(), 7);
    const jobsLast7Days = jobs.filter((job: any) => {
      const jobDate = new Date(job.createdAt);
      return jobDate >= sevenDaysAgo;
    }).length;

    return {
      jobsInProgress,
      activeJobs,
      jobsLast7Days
    };
  }, [jobs]);

  return (
    <>
      <PageHeader 
        title="Workshop Management" 
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Date Filter - Mobile Responsive */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium hidden sm:inline">Date Range:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick dates"
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setDateRange({
                            from: subDays(today, 7),
                            to: today
                          });
                        }}
                      >
                        Last 7 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setDateRange({
                            from: subDays(today, 31),
                            to: today
                          });
                        }}
                      >
                        Last 31 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setDateRange({
                            from: subDays(today, 90),
                            to: today
                          });
                        }}
                      >
                        Last 90 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          const startOfYear = new Date(today.getFullYear(), 0, 1);
                          setDateRange({
                            from: startOfYear,
                            to: today
                          });
                        }}
                      >
                        This year
                      </Button>
                    </div>
                  </div>
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range && range.from && range.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={1}
                    className="w-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2">
              <PrintWorkOrders 
                trigger={
                  <PageHeaderAction variant="outline" icon={<Printer size={18} />}>
                    <span className="hidden sm:inline">Print Work Orders</span>
                    <span className="sm:hidden">Print</span>
                  </PageHeaderAction>
                }
              />
              <Button 
                className="bg-green-700 hover:bg-green-800"
                onClick={() => setWizardOpen(true)}
              >
                <Plus size={18} className="mr-2" />
                <span className="hidden sm:inline">New Job</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>
        }
      />

      {/* Workshop Capacity Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Jobs In Progress"
            value={workshopMetrics.jobsInProgress}
            icon="⚙️"
            iconColor="bg-blue-500"
          />
          <StatCard
            title="Active Jobs"
            value={workshopMetrics.activeJobs}
            icon="📋"
            iconColor="bg-amber-500"
          />
          <StatCard
            title="Jobs Last 7 Days"
            value={workshopMetrics.jobsLast7Days}
            icon="📈"
            iconColor="bg-green-500"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Workshop Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="waiting">
              <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4 h-auto">
                <TabsTrigger value="waiting" className="text-xs sm:text-sm px-2 py-2">
                  <span className="sm:hidden">Waiting</span>
                  <span className="hidden sm:inline">Waiting Assessment</span>
                </TabsTrigger>
                <TabsTrigger value="in-progress" className="text-xs sm:text-sm px-2 py-2">
                  <span className="sm:hidden">Progress</span>
                  <span className="hidden sm:inline">In Progress</span>
                </TabsTrigger>
                <TabsTrigger value="parts" className="text-xs sm:text-sm px-2 py-2">
                  <span className="sm:hidden">Parts</span>
                  <span className="hidden sm:inline">Parts Ordered</span>
                </TabsTrigger>
                <TabsTrigger value="ready" className="text-xs sm:text-sm px-2 py-2">
                  <span className="sm:hidden">Ready</span>
                  <span className="hidden sm:inline">Ready for Pickup</span>
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs sm:text-sm px-2 py-2">
                  <span className="sm:hidden">Done</span>
                  <span className="hidden sm:inline">Completed</span>
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs sm:text-sm px-2 py-2">All Jobs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-4">
                <WorkshopJobsTable 
                  isLoading={jobsLoading} 
                  jobs={jobs as any[] || []} 
                  showSearch 
                  showPagination
                  triggerJobCreation={triggerJobCreation}
                />
              </TabsContent>
              
              <TabsContent value="waiting" className="mt-4">
                <WorkshopJobsTable 
                  isLoading={jobsLoading} 
                  jobs={getJobsByStatus("waiting_assessment")} 
                  showSearch 
                  showPagination
                />
              </TabsContent>
              
              <TabsContent value="in-progress" className="mt-4">
                <WorkshopJobsTable 
                  isLoading={jobsLoading} 
                  jobs={getJobsByStatus("in_progress")} 
                  showSearch 
                  showPagination
                />
              </TabsContent>
              
              <TabsContent value="parts" className="mt-4">
                <WorkshopJobsTable 
                  isLoading={jobsLoading} 
                  jobs={getJobsByStatus("parts_ordered")} 
                  showSearch 
                  showPagination
                />
              </TabsContent>
              
              <TabsContent value="ready" className="mt-4">
                <WorkshopJobsTable 
                  isLoading={jobsLoading} 
                  jobs={getJobsByStatus("ready_for_pickup")} 
                  showSearch 
                  showPagination
                />
              </TabsContent>
              
              <TabsContent value="completed" className="mt-4">
                <WorkshopJobsTable 
                  isLoading={jobsLoading} 
                  jobs={getCompletedJobs()} 
                  showSearch 
                  showPagination
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Job Creation Wizard */}
      <JobWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        mode="create"
      />
    </>
  );
}
