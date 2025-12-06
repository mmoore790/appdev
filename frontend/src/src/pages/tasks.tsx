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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mt-6">
            <TaskBoard
              tasks={filteredTasks}
              users={users}
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
