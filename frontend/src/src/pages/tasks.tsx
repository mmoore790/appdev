//
// This is the updated code for:
// frontend/src/src/pages/tasks.tsx
//
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, LayoutGrid, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TaskBoard } from "@/components/task-board"; // This component now handles ALL DnD logic
import { TaskListTable } from "@/components/task-list-table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDueDateMeta } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
//
// All dnd-kit imports have been REMOVED from this file.
// All mutation logic has been REMOVED from this file.
// All handler logic (handleDragEnd) has been REMOVED from this file.
//

type QuickFilter = "all" | "overdue" | "dueSoon" | "completed";
type ViewMode = "list" | "kanban";

const TASK_VIEW_PREFERENCE_KEY = "tasks:defaultView";
const TASK_STAFF_FILTER_KEY = "tasks:staffFilter";

export default function Tasks() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [assignedToFilter, setAssignedToFilter] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TASK_STAFF_FILTER_KEY);
      return saved || "all";
    }
    return "all";
  });
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  
  // Get taskId from URL parameters
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const taskIdFromUrl = urlParams.get("taskId");
  const initialTaskId = taskIdFromUrl ? parseInt(taskIdFromUrl, 10) : null;
  
  // Load default view from localStorage on mount
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TASK_VIEW_PREFERENCE_KEY);
      return (saved === "list" || saved === "kanban") ? saved : "kanban";
    }
    return "kanban";
  });
  
  const previousViewMode = useRef<ViewMode>(viewMode);
  const isInitialMount = useRef(true);

  const { data: allTasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const quickMetrics = useMemo(() => {
    const tasksArray = Array.isArray(allTasks) ? (allTasks as any[]) : [];
    let overdue = 0;
    let dueSoon = 0;
    let completed = 0;

    tasksArray.forEach((task: any) => {
      if (task.status === "archived" || task.status === "deleted") {
        return;
      }

      const meta = getDueDateMeta(task.dueDate);
      if (meta.tone === "danger") overdue += 1;
      if (
        task.status !== "completed" &&
        meta.tone === "warning" &&
        meta.daysUntil !== null &&
        meta.daysUntil <= 2
      ) {
        dueSoon += 1;
      }
      if (task.status === "completed") completed += 1;
    });

    return { overdue, dueSoon, completed };
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    const tasksArray = Array.isArray(allTasks) ? (allTasks as any[]) : [];
    return tasksArray.filter((task: any) => {
      // Always exclude deleted tasks
      if (task.status === "deleted") {
        return false;
      }

      // Exclude archived tasks unless showArchived is true
      if (task.status === "archived" && !showArchived) {
        return false;
      }

      const matchesSearch =
        search.trim() === "" ||
        task.title.toLowerCase().includes(search.toLowerCase());

      let matchesAssignedToFilter = true;
      if (assignedToFilter !== "all") {
        if (assignedToFilter === "unassigned") {
          matchesAssignedToFilter = !task.assignedTo;
        } else {
          const numericAssignee =
            typeof task.assignedTo === "string"
              ? parseInt(task.assignedTo, 10)
              : task.assignedTo;
          matchesAssignedToFilter =
            numericAssignee === parseInt(assignedToFilter, 10);
        }
      }

      if (!matchesSearch || !matchesAssignedToFilter) {
        return false;
      }

      if (quickFilter === "overdue") {
        return getDueDateMeta(task.dueDate).tone === "danger";
      }

      if (quickFilter === "dueSoon") {
        const meta = getDueDateMeta(task.dueDate);
        return (
          task.status !== "completed" &&
          meta.tone === "warning" &&
          meta.daysUntil !== null &&
          meta.daysUntil <= 2
        );
      }

      if (quickFilter === "completed") {
        return task.status === "completed";
      }

      return true;
    });
  }, [allTasks, assignedToFilter, quickFilter, search, showArchived]);

  const handleQuickFilterChange = (value: string) => {
    if (!value) {
      setQuickFilter("all");
    } else {
      setQuickFilter(value as QuickFilter);
    }
  };

  // Persist staff filter to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TASK_STAFF_FILTER_KEY, assignedToFilter);
    }
  }, [assignedToFilter]);

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
      const currentDefault = localStorage.getItem(TASK_VIEW_PREFERENCE_KEY);
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
                localStorage.setItem(TASK_VIEW_PREFERENCE_KEY, viewMode);
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
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 mt-4 sm:mt-6 md:mt-8">
      <Card>
        <CardHeader className="space-y-6 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl sm:text-2xl font-semibold text-neutral-800">
              Tasks
            </CardTitle>
            <p className="text-xs sm:text-sm text-neutral-500">
              Monitor workloads, filter assignments, and keep the board moving
              smoothly.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative w-full sm:w-72">
                <Search
                  size={16}
                  className="absolute left-2 top-1/2 -translate-y-1/2 transform text-neutral-400"
                />
                <Input
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8"
                />
              </div>
              <Select
                value={assignedToFilter}
                onValueChange={setAssignedToFilter}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.fullName || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-white">
                <Checkbox
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={(checked) => setShowArchived(checked === true)}
                />
                <Label
                  htmlFor="show-archived"
                  className="text-sm font-medium text-neutral-700 cursor-pointer"
                >
                  Show archived
                </Label>
              </div>
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value && value !== viewMode) {
                  setViewMode(value as ViewMode);
                }
              }}
              className="border border-neutral-200 rounded-lg p-1"
            >
              <ToggleGroupItem
                value="kanban"
                aria-label="Kanban view"
                className="data-[state=on]:bg-green-600 data-[state=on]:text-white"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Kanban</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="list"
                aria-label="List view"
                className="data-[state=on]:bg-green-600 data-[state=on]:text-white"
              >
                <List className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">List</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mt-6">
            {viewMode === "kanban" ? (
              <TaskBoard
                tasks={filteredTasks}
                users={users}
                isLoading={isLoading}
                initialTaskId={initialTaskId}
                onTaskDialogClose={() => {
                  // Remove taskId from URL when dialog closes
                  if (taskIdFromUrl) {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.delete("taskId");
                    setLocation(newUrl.pathname + newUrl.search, { replace: true });
                  }
                }}
              />
            ) : (
              <TaskListTable
                tasks={filteredTasks}
                users={users}
                isLoading={isLoading}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
