import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskList } from "@/components/task-list";
import { TaskBoard } from "@/components/task-board";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm } from "@/components/task-form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDueDateMeta } from "@/lib/utils";

type QuickFilter = "all" | "overdue" | "dueSoon" | "completed";

export default function Tasks() {
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      if (meta.tone === "warning" && meta.daysUntil !== null && meta.daysUntil <= 2) dueSoon += 1;
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
        search.trim() === "" || task.title.toLowerCase().includes(search.toLowerCase());

      let matchesAssignedToFilter = true;
      if (assignedToFilter !== "all") {
        if (assignedToFilter === "unassigned") {
          matchesAssignedToFilter = !task.assignedTo;
        } else {
          const numericAssignee =
            typeof task.assignedTo === "string" ? parseInt(task.assignedTo, 10) : task.assignedTo;
          matchesAssignedToFilter = numericAssignee === parseInt(assignedToFilter, 10);
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
        return meta.tone === "warning" && meta.daysUntil !== null && meta.daysUntil <= 2;
      }

      if (quickFilter === "completed") {
        return task.status === "completed";
      }

      return true;
    });
  }, [allTasks, assignedToFilter, quickFilter, search]);

  const listViewTasks = useMemo(
    () =>
      filteredTasks.filter(
        (task: any) => task.status !== "archived" && task.status !== "deleted"
      ),
    [filteredTasks]
  );

  const handleQuickFilterChange = (value: string) => {
    if (!value) {
      setQuickFilter("all");
    } else {
      setQuickFilter(value as QuickFilter);
    }
  };

  return (
    <>
      <PageHeader 
        title="Task Management" 
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-700 hover:bg-green-800">
                <Plus size={18} className="mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-[600px]" 
              onEscapeKeyDown={() => setIsDialogOpen(false)} 
              onPointerDownOutside={() => setIsDialogOpen(false)}
            >
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Fill out the form below to create a new task
                </DialogDescription>
              </DialogHeader>
              <TaskForm onComplete={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <Card>
            <CardHeader className="space-y-4 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 sm:space-x-4">
                <CardTitle className="text-xl font-semibold text-neutral-800">Tasks</CardTitle>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-60">
                    <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-400" />
                    <Input
                      placeholder="Search tasks..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-full"
                    />
                  </div>
                  <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                    <SelectTrigger className="w-full sm:w-48">
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
              </div>
              <ToggleGroup
                type="single"
                value={quickFilter}
                onValueChange={handleQuickFilterChange}
                className="flex flex-wrap gap-2"
              >
                <ToggleGroupItem value="all" className="border border-neutral-200 px-3 py-1 text-xs">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="overdue"
                  className="border border-red-200 px-3 py-1 text-xs data-[state=on]:bg-red-50 data-[state=on]:text-red-700"
                >
                  Overdue
                  <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                    {quickMetrics.overdue}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dueSoon"
                  className="border border-amber-200 px-3 py-1 text-xs data-[state=on]:bg-amber-50 data-[state=on]:text-amber-700"
                >
                  Due Soon
                  <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                    {quickMetrics.dueSoon}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="completed"
                  className="border border-green-200 px-3 py-1 text-xs data-[state=on]:bg-green-50 data-[state=on]:text-green-700"
                >
                  Completed
                  <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                    {quickMetrics.completed}
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="board" className="w-full">
              <TabsList>
                <TabsTrigger value="board">Board View</TabsTrigger>
                <TabsTrigger value="list">List View</TabsTrigger>
              </TabsList>

                <TabsContent value="list" className="mt-4">
                  <TaskList
                    isLoading={isLoading}
                    tasks={listViewTasks}
                    users={users}
                    showAllDetails
                  />
                </TabsContent>

                <TabsContent value="board" className="mt-4">
                  <TaskBoard 
                    tasks={filteredTasks}
                    users={users}
                    isLoading={isLoading}
                  />
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
