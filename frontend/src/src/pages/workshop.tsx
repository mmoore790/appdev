import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Plus, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { WorkshopJobsTable } from "@/components/workshop-jobs-table";
import { JobWizard } from "@/components/job-wizard";
import { PrintWorkOrders } from "@/components/print-work-orders";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const STATUS_TABS = [
  { value: "all", label: "All Jobs", shortLabel: "All Jobs", statuses: "all" as const },
  { value: "waiting", label: "Waiting Assessment", shortLabel: "Waiting", statuses: ["waiting_assessment"] as const },
  { value: "in-progress", label: "In Progress", shortLabel: "In Progress", statuses: ["in_progress"] as const },
  { value: "ready", label: "Ready for Pickup", shortLabel: "Ready", statuses: ["ready_for_pickup"] as const },
  { value: "completed", label: "Completed", shortLabel: "Completed", statuses: ["completed"] as const },
] as const;

type StatusTabValue = (typeof STATUS_TABS)[number]["value"];

export default function Workshop() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTabValue>("all");
  const [selectedMechanic, setSelectedMechanic] = useState<string>("all");

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const thirtyOneDaysAgo = subDays(today, 31);
    return {
      from: thirtyOneDaysAgo,
      to: today,
    };
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const mechanics = Array.isArray(users)
    ? users.filter((user: any) => user.role === "mechanic")
    : [];

  const dateFilteredJobs = useMemo(() => {
    if (!jobs || !dateRange.from || !dateRange.to) return Array.isArray(jobs) ? jobs : [];
    if (!Array.isArray(jobs)) return [];

    // Normalize the range to whole days so newly created jobs later today are still included
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);

    return jobs.filter((job: any) => {
      const jobDate = new Date(job.createdAt);
      return isWithinInterval(jobDate, {
        start: rangeStart,
        end: rangeEnd,
      });
    });
  }, [jobs, dateRange]);

  const mechanicFilteredJobs = useMemo(() => {
    if (!Array.isArray(dateFilteredJobs)) return [];
    if (selectedMechanic === "all") {
      return dateFilteredJobs;
    }
    if (selectedMechanic === "unassigned") {
      return dateFilteredJobs.filter((job: any) => !job.assignedTo);
    }
    const mechanicId = Number(selectedMechanic);
    if (Number.isNaN(mechanicId)) {
      return dateFilteredJobs;
    }
    return dateFilteredJobs.filter((job: any) => job.assignedTo === mechanicId);
  }, [dateFilteredJobs, selectedMechanic]);

  const tabbedJobs = useMemo<Record<StatusTabValue, any[]>>(() => {
    const base: Record<StatusTabValue, any[]> = {
      all: mechanicFilteredJobs,
      waiting: [],
      "in-progress": [],
      ready: [],
      completed: [],
    };

    mechanicFilteredJobs.forEach((job: any) => {
      switch (job.status) {
        case "waiting_assessment":
          base.waiting.push(job);
          break;
        case "in_progress":
          base["in-progress"].push(job);
          break;
        case "ready_for_pickup":
          base.ready.push(job);
          break;
        case "completed":
          base.completed.push(job);
          break;
        default:
          break;
      }
    });

    return base;
  }, [mechanicFilteredJobs]);

  const statusCounts = useMemo<Record<StatusTabValue, number>>(
    () => ({
      all: tabbedJobs.all.length,
      waiting: tabbedJobs.waiting.length,
      "in-progress": tabbedJobs["in-progress"].length,
      ready: tabbedJobs.ready.length,
      completed: tabbedJobs.completed.length,
    }),
    [tabbedJobs]
  );

  const currentTab = STATUS_TABS.find((tab) => tab.value === activeTab);
  const currentTabCount = statusCounts[activeTab] ?? 0;

  const mechanicLabel = useMemo(() => {
    if (selectedMechanic === "all") {
      return "All mechanics";
    }
    if (selectedMechanic === "unassigned") {
      return "Unassigned";
    }
    const match = mechanics.find((mechanic: any) => String(mechanic.id) === selectedMechanic);
    return match?.fullName || match?.username || "Mechanic";
  }, [mechanics, selectedMechanic]);

  const tabSummaryText = useMemo(() => {
    const plural = currentTabCount === 1 ? "job" : "jobs";
    const parts: string[] = [`Showing ${currentTabCount} ${plural}`];

    if (currentTab?.value === "all") {
      parts.push("across all statuses");
    } else if (currentTab) {
      parts.push(`in ${currentTab.label.toLowerCase()}`);
    }

    if (selectedMechanic === "unassigned") {
      parts.push("unassigned");
    } else if (selectedMechanic !== "all") {
      parts.push(mechanicLabel);
    }

    return parts.join(" • ");
  }, [currentTab, currentTabCount, mechanicLabel, selectedMechanic]);

  return (
    <>
      <PageHeader
        title="Workshop Management"
        description="Monitor throughput, triage incoming repairs, and keep every technician aligned."
        actions={
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Date Range
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start gap-2 text-left font-medium sm:min-w-[240px]"
                  >
                    <Calendar className="h-4 w-4 text-green-700" />
                    <span className="truncate">
                      {dateRange?.from && dateRange?.to
                        ? `${format(dateRange.from, "MMM dd")} – ${format(dateRange.to, "MMM dd, yyyy")}`
                        : "Select dates"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setDateRange({
                            from: today,
                            to: today,
                          });
                        }}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setDateRange({
                            from: subDays(today, 7),
                            to: today,
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
                            to: today,
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
                            to: today,
                          });
                        }}
                      >
                        Last 90 days
                      </Button>
                    </div>
                  </div>
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      if (!range) return;
                      const { from, to } = range;
                      if (from && to) {
                        setDateRange({ from, to });
                      } else if (from) {
                        setDateRange({ from, to: from });
                      }
                    }}
                    numberOfMonths={1}
                    className="w-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <PrintWorkOrders
                trigger={
                  <Button variant="outline" className="h-11 w-full sm:w-auto">
                    <Printer size={18} className="mr-2" />
                    Print Work Orders
                  </Button>
                }
              />
              <Button
                className="h-11 w-full bg-green-700 hover:bg-green-800 sm:w-auto"
                onClick={() => setWizardOpen(true)}
              >
                <Plus size={18} className="mr-2" />
                New Job
              </Button>
            </div>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <div className="space-y-6">
          <Card className="border border-neutral-200 shadow-sm">
            <CardHeader className="space-y-6 border-b border-neutral-100 pb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold text-neutral-800">
                    Job Pipeline
                  </CardTitle>
                  <p className="text-sm text-neutral-500">
                    Filter by technician, focus on bottlenecks, and keep every repair moving.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="w-full sm:w-64">
                    <Select value={selectedMechanic} onValueChange={setSelectedMechanic}>
                      <SelectTrigger className="h-11 w-full border-neutral-200">
                        <SelectValue placeholder="All mechanics" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All mechanics</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {mechanics.map((mechanic: any) => (
                          <SelectItem key={mechanic.id} value={String(mechanic.id)}>
                            {mechanic.fullName || mechanic.username || `Mechanic ${mechanic.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-600">
                  {mechanicFilteredJobs.length} {mechanicFilteredJobs.length === 1 ? "job" : "jobs"} in view
                </Badge>
                {dateRange?.from && dateRange?.to && (
                  <Badge variant="outline" className="border-neutral-200 text-neutral-500">
                    {`${format(dateRange.from, "MMM dd")} – ${format(dateRange.to, "MMM dd, yyyy")}`}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StatusTabValue)}>
                <TabsList className="flex h-auto w-full flex-wrap gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 overflow-x-auto">
                  {STATUS_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="group flex min-w-[120px] sm:min-w-[150px] flex-1 items-center justify-between gap-2 sm:gap-3 rounded-lg border border-transparent bg-white px-2 sm:px-3 py-2 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-green-200 hover:text-green-700 data-[state=active]:border-green-600 data-[state=active]:bg-green-600 data-[state=active]:text-white sm:text-sm"
                    >
                      <span className="truncate">{tab.shortLabel}</span>
                      <span className="flex h-5 sm:h-6 min-w-[2rem] sm:min-w-[2.5rem] items-center justify-center rounded-full bg-neutral-100 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-semibold text-neutral-600 transition-colors group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                        {statusCounts[tab.value]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="mt-4 text-sm font-medium text-neutral-700">
                  {tabSummaryText}
                </div>

                {STATUS_TABS.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-6">
                    <WorkshopJobsTable
                      isLoading={jobsLoading}
                      jobs={tabbedJobs[tab.value]}
                      showSearch
                      showPagination
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <JobWizard open={wizardOpen} onOpenChange={setWizardOpen} mode="create" />
    </>
  );
}
