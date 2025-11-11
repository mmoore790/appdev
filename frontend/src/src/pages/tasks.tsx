//
// This is the updated code for:
// frontend/src/src/pages/tasks.tsx
//
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskBoard } from "@/components/task-board"; // This component now handles ALL DnD logic
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDueDateMeta } from "@/lib/utils";
//
// All dnd-kit imports have been REMOVED from this file.
// All mutation logic has been REMOVED from this file.
// All handler logic (handleDragEnd) has been REMOVED from this file.
//

type QuickFilter = "all" | "overdue" | "dueSoon" | "completed";

export default function Tasks() {
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

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
      if (task.status === "deleted") {
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
  }, [allTasks, assignedToFilter, quickFilter, search]);

  const handleQuickFilterChange = (value: string) => {
    if (!value) {
      setQuickFilter("all");
    } else {
      setQuickFilter(value as QuickFilter);
    }
  };

    return (
      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Card className="border border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-6 pb-4">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold text-foreground">
                Tasks
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Monitor workloads, filter assignments, and keep the board moving smoothly.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative w-full sm:w-72">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 transform text-muted-foreground"
                  />
                  <Input
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border-border/70 bg-background/80 pl-9 focus-visible:ring-primary/40"
                  />
                </div>
                <Select
                  value={assignedToFilter}
                  onValueChange={setAssignedToFilter}
                >
                  <SelectTrigger className="w-full rounded-xl border-border/70 bg-background/80 sm:w-48">
                    <SelectValue placeholder="Assigned To" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.fullName || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ToggleGroup
                type="single"
                value={quickFilter}
                onValueChange={handleQuickFilterChange}
                className="flex flex-wrap gap-2 md:justify-end"
              >
                <ToggleGroupItem
                  value="all"
                  className="rounded-full border border-border/70 px-3 py-1 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                >
                  All
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="overdue"
                  className="rounded-full border border-red-200 px-3 py-1 text-xs data-[state=on]:bg-red-50 data-[state=on]:text-red-700 dark:border-red-500/30 dark:data-[state=on]:bg-red-500/20 dark:data-[state=on]:text-red-200"
                >
                  Overdue
                  <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-500/20 dark:text-red-200">
                    {quickMetrics.overdue}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dueSoon"
                  className="rounded-full border border-amber-200 px-3 py-1 text-xs data-[state=on]:bg-amber-50 data-[state=on]:text-amber-700 dark:border-amber-500/30 dark:data-[state=on]:bg-amber-500/20 dark:data-[state=on]:text-amber-200"
                >
                  Due Soon
                  <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
                    {quickMetrics.dueSoon}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="completed"
                  className="rounded-full border border-emerald-200 px-3 py-1 text-xs data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-700 dark:border-emerald-500/30 dark:data-[state=on]:bg-emerald-500/20 dark:data-[state=on]:text-emerald-200"
                >
                  Completed
                  <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                    {quickMetrics.completed}
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <TaskBoard
              tasks={filteredTasks}
              users={users}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    );
}
