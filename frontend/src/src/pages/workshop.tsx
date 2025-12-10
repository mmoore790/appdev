import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Plus, Calendar, ChevronRight, Briefcase, Wrench, LayoutGrid, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { WorkshopJobsTable } from "@/components/workshop-jobs-table";
import { WorkshopJobsKanban } from "@/components/workshop-jobs-kanban";
import { JobWizard } from "@/components/job-wizard";
import { PrintWorkOrders } from "@/components/print-work-orders";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const STATUS_TABS = [
  { value: "all", label: "All Jobs", shortLabel: "All Jobs", statuses: "all" as const },
  { value: "waiting", label: "Waiting Assessment", shortLabel: "Waiting Assignment", statuses: ["waiting_assessment"] as const },
  { value: "in-progress", label: "In Progress", shortLabel: "In Progress", statuses: ["in_progress"] as const },
  { value: "on-hold", label: "On Hold", shortLabel: "On Hold", statuses: ["on_hold"] as const },
  { value: "ready", label: "Ready for Pickup", shortLabel: "Ready", statuses: ["ready_for_pickup"] as const },
  { value: "completed", label: "Completed", shortLabel: "Completed", statuses: ["completed"] as const },
] as const;

type StatusTabValue = (typeof STATUS_TABS)[number]["value"];
type ViewMode = "list" | "kanban";

const WORKSHOP_VIEW_PREFERENCE_KEY = "workshop:defaultView";
const WORKSHOP_STAFF_FILTER_KEY = "workshop:staffFilter";

export default function Workshop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTabValue>("all");
  
  // Load staff filter from localStorage on mount
  const [selectedUser, setSelectedUser] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(WORKSHOP_STAFF_FILTER_KEY);
      if (saved && (saved === "all" || saved === "unassigned" || !isNaN(Number(saved)))) {
        return saved;
      }
    }
    return "all";
  });
  
  // Load default view from localStorage on mount
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(WORKSHOP_VIEW_PREFERENCE_KEY);
    return (saved === "list" || saved === "kanban") ? saved : "list";
  });
  
  const previousViewMode = useRef<ViewMode>(viewMode);
  const isInitialMount = useRef(true);

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

  const assignableUsers = Array.isArray(users)
    ? users.filter((user: any) => {
        const role = typeof user.role === "string" ? user.role.toLowerCase() : "";
        return role === "mechanic" || role === "admin" || role === "staff";
      })
    : [];

  // Validate and update selectedUser if the saved user no longer exists
  useEffect(() => {
    if (selectedUser !== "all" && selectedUser !== "unassigned") {
      const userId = Number(selectedUser);
      if (!Number.isNaN(userId)) {
        const userExists = assignableUsers.some((u: any) => u.id === userId);
        if (!userExists) {
          // Saved user no longer exists, reset to "all"
          setSelectedUser("all");
          localStorage.setItem(WORKSHOP_STAFF_FILTER_KEY, "all");
        }
      }
    }
  }, [selectedUser, assignableUsers]);

  // Save staff filter selection to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKSHOP_STAFF_FILTER_KEY, selectedUser);
    }
  }, [selectedUser]);

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

  const userFilteredJobs = useMemo(() => {
    if (!Array.isArray(dateFilteredJobs)) return [];
    if (selectedUser === "all") {
      return dateFilteredJobs;
    }
    if (selectedUser === "unassigned") {
      return dateFilteredJobs.filter((job: any) => !job.assignedTo);
    }
    const userId = Number(selectedUser);
    if (Number.isNaN(userId)) {
      return dateFilteredJobs;
    }
    return dateFilteredJobs.filter((job: any) => job.assignedTo === userId);
  }, [dateFilteredJobs, selectedUser]);

  const tabbedJobs = useMemo<Record<StatusTabValue, any[]>>(() => {
    const base: Record<StatusTabValue, any[]> = {
      all: userFilteredJobs,
      waiting: [],
      "in-progress": [],
      "on-hold": [],
      ready: [],
      completed: [],
    };

    userFilteredJobs.forEach((job: any) => {
      switch (job.status) {
        case "waiting_assessment":
          base.waiting.push(job);
          break;
        case "in_progress":
          base["in-progress"].push(job);
          break;
        case "on_hold":
          base["on-hold"].push(job);
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
  }, [userFilteredJobs]);

  const statusCounts = useMemo<Record<StatusTabValue, number>>(
    () => ({
      all: tabbedJobs.all.length,
      waiting: tabbedJobs.waiting.length,
      "in-progress": tabbedJobs["in-progress"].length,
      "on-hold": tabbedJobs["on-hold"].length,
      ready: tabbedJobs.ready.length,
      completed: tabbedJobs.completed.length,
    }),
    [tabbedJobs]
  );

  const currentTab = STATUS_TABS.find((tab) => tab.value === activeTab);
  const currentTabCount = statusCounts[activeTab] ?? 0;

  const userLabel = useMemo(() => {
    if (selectedUser === "all") {
      return "All staff";
    }
    if (selectedUser === "unassigned") {
      return "Unassigned";
    }
    const match = assignableUsers.find((user: any) => String(user.id) === selectedUser);
    return match?.fullName || match?.username || "Staff";
  }, [assignableUsers, selectedUser]);

  const tabSummaryText = useMemo(() => {
    const plural = currentTabCount === 1 ? "job" : "jobs";
    const parts: string[] = [`Showing ${currentTabCount} ${plural}`];

    if (currentTab?.value === "all") {
      parts.push("across all statuses");
    } else if (currentTab) {
      parts.push(`in ${currentTab.label.toLowerCase()}`);
    }

    if (selectedUser === "unassigned") {
      parts.push("unassigned");
    } else if (selectedUser !== "all") {
      parts.push(userLabel);
    }

    return parts.join(" • ");
  }, [currentTab, currentTabCount, userLabel, selectedUser]);

  // Calculate jobs assigned to current user (excluding completed)
  const myAssignedJobsCount = useMemo(() => {
    if (!user?.id || !Array.isArray(jobs)) return 0;
    return jobs.filter((job: any) => 
      job.assignedTo === user.id && job.status !== "completed"
    ).length;
  }, [jobs, user?.id]);

  // Show toast notification when view mode changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousViewMode.current = viewMode;
      return;
    }

    // Only show toast if view actually changed
    if (previousViewMode.current !== viewMode) {
      const viewLabel = viewMode === "list" ? "List" : "Kanban";
      const currentDefault = localStorage.getItem(WORKSHOP_VIEW_PREFERENCE_KEY);
      const isCurrentDefault = currentDefault === viewMode;

      // Only show toast if this isn't already the default
      if (!isCurrentDefault) {
        toast({
          title: `Switched to ${viewLabel} view`,
          description: "Make this your default view?",
          action: (
            <ToastAction
              altText="Set as default"
              onClick={() => {
                localStorage.setItem(WORKSHOP_VIEW_PREFERENCE_KEY, viewMode);
                toast({
                  title: "Default view updated",
                  description: `${viewLabel} view is now your default.`,
                });
              }}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Set as default
            </ToastAction>
          ),
        });
      }

      previousViewMode.current = viewMode;
    }
  }, [viewMode, toast]);

  return (
    <>
      <div className="container mx-auto py-2 sm:py-3 px-2 sm:px-4 max-w-[1920px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">Workshop Operations</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">Filter by technician, focus on bottlenecks, and keep every repair moving.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs sm:text-sm">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "MMM dd")} – ${format(dateRange.to, "MMM dd, yyyy")}`
                      : "Select dates"}
                  </span>
                  <span className="sm:hidden">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                      : "Dates"}
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
            <PrintWorkOrders
              trigger={
                <Button variant="outline" size="sm" className="h-9 text-xs sm:text-sm">
                  <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Print Work Orders</span>
                  <span className="sm:hidden">Print</span>
                </Button>
              }
            />
            <Button
              size="sm"
              className="h-9 bg-green-700 hover:bg-green-800 text-xs sm:text-sm"
              onClick={() => setWizardOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">New Job</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        <div className="w-full">
          <div className="space-y-6">
          <Card className="border border-neutral-200 shadow-sm">
            <CardHeader className="space-y-4 sm:space-y-6 border-b border-neutral-100 pb-4 sm:pb-6">
              <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl sm:text-2xl font-semibold text-neutral-800">
                    Job Pipeline
                  </CardTitle>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="w-full sm:w-64">
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="h-10 sm:h-11 w-full border-neutral-200 text-sm">
                        <SelectValue placeholder="All staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All staff</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {assignableUsers.map((user: any) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.fullName || user.username || `User ${user.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value) => {
                      if (value && value !== viewMode) {
                        setViewMode(value as ViewMode);
                      }
                    }}
                    className="border border-neutral-200 rounded-lg p-0.5 sm:p-1"
                  >
                    <ToggleGroupItem
                      value="list"
                      aria-label="List view"
                      className="data-[state=on]:bg-green-600 data-[state=on]:text-white h-9 sm:h-10 px-2 sm:px-3"
                    >
                      <List className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline text-xs sm:text-sm">List</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="kanban"
                      aria-label="Kanban view"
                      className="data-[state=on]:bg-green-600 data-[state=on]:text-white h-9 sm:h-10 px-2 sm:px-3"
                    >
                      <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline text-xs sm:text-sm">Kanban</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              {user?.id && myAssignedJobsCount > 0 && (
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-green-200 bg-green-50 px-2 sm:px-3 py-1.5 sm:py-2 w-fit">
                  <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-700 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-green-800">
                    {myAssignedJobsCount} {myAssignedJobsCount === 1 ? "job" : "jobs"} assigned to me
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6">
              {viewMode === "kanban" ? (
                <div className="space-y-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
                  <div className="text-sm font-medium text-neutral-700">
                    {tabSummaryText}
                  </div>
                  <WorkshopJobsKanban
                    isLoading={jobsLoading}
                    jobs={userFilteredJobs}
                  />
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StatusTabValue)}>
                  <TabsList className="flex h-auto w-full flex-nowrap gap-1 sm:gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-1.5 sm:p-2 overflow-x-auto">
                    {STATUS_TABS.map((tab, index) => (
                      <div key={tab.value} className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                        <TabsTrigger
                          value={tab.value}
                          className="group flex min-w-[80px] xs:min-w-[100px] sm:min-w-[120px] items-center justify-between gap-1 sm:gap-1.5 sm:gap-2 rounded-lg border border-transparent bg-white px-1.5 sm:px-2 sm:px-2.5 py-1.5 sm:py-2 text-[10px] xs:text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-green-200 hover:text-green-700 data-[state=active]:border-green-600 data-[state=active]:bg-green-600 data-[state=active]:text-white sm:text-sm whitespace-nowrap"
                        >
                          <span className="truncate">{tab.shortLabel}</span>
                          <span className="flex h-4 sm:h-5 sm:h-6 min-w-[1.5rem] sm:min-w-[1.75rem] sm:min-w-[2rem] items-center justify-center rounded-full bg-neutral-100 px-0.5 sm:px-1 sm:px-1.5 text-[9px] sm:text-[10px] sm:text-[11px] font-semibold text-neutral-600 transition-colors group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white flex-shrink-0">
                            {statusCounts[tab.value]}
                          </span>
                        </TabsTrigger>
                        {index < STATUS_TABS.length - 1 && (
                          <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neutral-400 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </TabsList>

                  <div className="mt-3 sm:mt-4 text-xs sm:text-sm font-medium text-neutral-700">
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
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
      <JobWizard open={wizardOpen} onOpenChange={setWizardOpen} mode="create" />
    </>
  );
}
