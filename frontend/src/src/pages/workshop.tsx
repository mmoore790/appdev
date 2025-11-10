import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Plus,
  Calendar as CalendarIcon,
  Wrench,
  ClipboardList,
  CalendarClock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { WorkshopJobsTable } from "@/components/workshop-jobs-table";
import { JobWizard } from "@/components/job-wizard";
import { PrintWorkOrders } from "@/components/print-work-orders";
import { Badge } from "@/components/ui/badge";
import { format, isWithinInterval, startOfYear, subDays } from "date-fns";
import { StatCard } from "@/components/ui/stat-card";

export default function Workshop() {
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

  const waitingJobs = useMemo(
    () => (Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === "waiting_assessment") : []),
    [filteredJobs]
  );

  const inProgressJobs = useMemo(
    () => (Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === "in_progress") : []),
    [filteredJobs]
  );

  const partsOrderedJobs = useMemo(
    () => (Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === "parts_ordered") : []),
    [filteredJobs]
  );

  const readyForPickupJobs = useMemo(
    () => (Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === "ready_for_pickup") : []),
    [filteredJobs]
  );

  const completedJobs = useMemo(
    () => (Array.isArray(filteredJobs) ? filteredJobs.filter((job: any) => job.status === "completed") : []),
    [filteredJobs]
  );

  const statusCounts = useMemo(() => {
    const total = Array.isArray(filteredJobs) ? filteredJobs.length : 0;
    return {
      all: total,
      waiting: waitingJobs.length,
      inProgress: inProgressJobs.length,
      parts: partsOrderedJobs.length,
      ready: readyForPickupJobs.length,
      completed: completedJobs.length,
    };
  }, [filteredJobs, waitingJobs, inProgressJobs, partsOrderedJobs, readyForPickupJobs, completedJobs]);

  const formatJobCount = (count: number) => `${count} ${count === 1 ? "job" : "jobs"}`;

  const formattedRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return "All time";
    }

    const fromLabel = format(dateRange.from, "MMM dd, yyyy");
    const toLabel = format(dateRange.to, "MMM dd, yyyy");
    return fromLabel === toLabel ? fromLabel : `${fromLabel} → ${toLabel}`;
  }, [dateRange]);

  const handleQuickRange = (preset: "7" | "31" | "90" | "ytd") => {
    const today = new Date();

    if (preset === "ytd") {
      const start = startOfYear(today);
      setDateRange({
        from: start,
        to: today
      });
      return;
    }

    const days = Number(preset);
    setDateRange({
      from: subDays(today, days),
      to: today
    });
  };

  const tabConfig = useMemo(() => [
    {
      value: "all",
      label: "All Jobs",
      description: "Everything in range",
      count: statusCounts.all,
      badgeClass: "bg-neutral-100 text-neutral-700"
    },
    {
      value: "waiting",
      label: "Waiting Assessment",
      description: "Needs intake & diagnostics",
      count: statusCounts.waiting,
      badgeClass: "bg-amber-100 text-amber-700"
    },
    {
      value: "in-progress",
      label: "In Progress",
      description: "Active repairs underway",
      count: statusCounts.inProgress,
      badgeClass: "bg-sky-100 text-sky-700"
    },
    {
      value: "parts",
      label: "Parts Ordered",
      description: "Waiting on supplier parts",
      count: statusCounts.parts,
      badgeClass: "bg-indigo-100 text-indigo-700"
    },
    {
      value: "ready",
      label: "Ready for Pickup",
      description: "Awaiting customer collection",
      count: statusCounts.ready,
      badgeClass: "bg-emerald-100 text-emerald-700"
    },
    {
      value: "completed",
      label: "Completed",
      description: "Recently wrapped jobs",
      count: statusCounts.completed,
      badgeClass: "bg-neutral-200 text-neutral-700"
    }
  ], [statusCounts]);

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
    <div className="max-w-7xl mx-auto space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-0 shadow-lg">
        <CardHeader className="gap-6 border-b border-neutral-200/70 bg-white/95">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <CardTitle className="text-3xl font-semibold text-neutral-900">
                Workshop
              </CardTitle>
              <CardDescription className="text-base text-neutral-500">
                Keep intake, repair workflows, and pickups organised without jumping between tools.
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-green-100 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {formatJobCount(statusCounts.all)} in view
                </Badge>
                <Badge variant="outline" className="rounded-full border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
                  {mechanics.length} active mechanic{mechanics.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrintWorkOrders
                trigger={
                  <Button
                    variant="outline"
                    className="h-10 rounded-lg border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 shadow-sm hover:border-neutral-300 hover:bg-neutral-100"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print orders
                  </Button>
                }
              />
              <Button
                className="h-10 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New job
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Date range
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-lg border-neutral-200 bg-white px-4 text-left font-medium text-neutral-700 shadow-sm hover:border-neutral-300 hover:bg-neutral-100 sm:w-[280px]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-neutral-500" />
                    <span className="truncate">{formattedRange}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="border-b border-neutral-200 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleQuickRange("7")}>
                        Last 7 days
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickRange("31")}>
                        Last 31 days
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickRange("90")}>
                        Last 90 days
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickRange("ytd")}>
                        Year to date
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
              <p className="text-sm text-neutral-500">
                Showing {formatJobCount(statusCounts.all)} scheduled between the selected dates.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-600 shadow-sm hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                onClick={() => handleQuickRange("7")}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-600 shadow-sm hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                onClick={() => handleQuickRange("31")}
              >
                Last 31 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-600 shadow-sm hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                onClick={() => handleQuickRange("90")}
              >
                Last 90 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-600 shadow-sm hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                onClick={() => handleQuickRange("ytd")}
              >
                Year to date
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Jobs in Progress"
          value={workshopMetrics.jobsInProgress}
          icon={<Wrench className="h-5 w-5" />}
          iconColor="bg-blue-500"
          className="border-0 bg-white/95 shadow-md"
        />
        <StatCard
          title="Active Jobs"
          value={workshopMetrics.activeJobs}
          icon={<ClipboardList className="h-5 w-5" />}
          iconColor="bg-amber-500"
          className="border-0 bg-white/95 shadow-md"
        />
        <StatCard
          title="Jobs Last 7 Days"
          value={workshopMetrics.jobsLast7Days}
          icon={<CalendarClock className="h-5 w-5" />}
          iconColor="bg-green-500"
          className="border-0 bg-white/95 shadow-md"
        />
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-0">
          <CardTitle className="text-xl font-semibold text-neutral-900">
            Job pipeline
          </CardTitle>
          <CardDescription className="text-sm text-neutral-500">
            Switch between workflow stages to prioritise what needs attention next.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="waiting" className="w-full">
            <TabsList className="grid gap-2 rounded-2xl bg-neutral-50 p-2 sm:grid-cols-3 xl:grid-cols-6">
              {tabConfig.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="group flex w-full flex-col items-start gap-2 rounded-xl border border-transparent bg-white px-4 py-3 text-left text-sm font-medium text-neutral-600 shadow-sm transition hover:border-neutral-200 hover:bg-neutral-50 data-[state=active]:border-green-600 data-[state=active]:bg-green-50 data-[state=active]:text-green-700"
                >
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <div className="flex w-full items-center justify-between text-xs text-neutral-500">
                    <span className="group-data-[state=active]:text-green-700/80">{tab.description}</span>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${tab.badgeClass} group-data-[state=active]:bg-green-600 group-data-[state=active]:text-white`}
                    >
                      {tab.count}
                    </span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <WorkshopJobsTable
                isLoading={jobsLoading}
                jobs={filteredJobs}
                showSearch
                showPagination
                title="All jobs"
                subtitle={`${formatJobCount(statusCounts.all)} scheduled within the selected date range.`}
              />
            </TabsContent>

            <TabsContent value="waiting" className="mt-6">
              <WorkshopJobsTable
                isLoading={jobsLoading}
                jobs={waitingJobs}
                showSearch
                showPagination
                title="Waiting assessment"
                subtitle={`${formatJobCount(statusCounts.waiting)} awaiting intake, diagnostics, or customer approval.`}
              />
            </TabsContent>

            <TabsContent value="in-progress" className="mt-6">
              <WorkshopJobsTable
                isLoading={jobsLoading}
                jobs={inProgressJobs}
                showSearch
                showPagination
                title="In progress"
                subtitle={`${formatJobCount(statusCounts.inProgress)} currently being worked on by the team.`}
              />
            </TabsContent>

            <TabsContent value="parts" className="mt-6">
              <WorkshopJobsTable
                isLoading={jobsLoading}
                jobs={partsOrderedJobs}
                showSearch
                showPagination
                title="Parts ordered"
                subtitle={`${formatJobCount(statusCounts.parts)} paused while parts are on order.`}
              />
            </TabsContent>

            <TabsContent value="ready" className="mt-6">
              <WorkshopJobsTable
                isLoading={jobsLoading}
                jobs={readyForPickupJobs}
                showSearch
                showPagination
                title="Ready for pickup"
                subtitle={`${formatJobCount(statusCounts.ready)} awaiting customer collection.`}
              />
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <WorkshopJobsTable
                isLoading={jobsLoading}
                jobs={completedJobs}
                showSearch
                showPagination
                title="Completed"
                subtitle={`${formatJobCount(statusCounts.completed)} completed in the selected timeframe.`}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <JobWizard open={wizardOpen} onOpenChange={setWizardOpen} mode="create" />
    </div>
  );
}
