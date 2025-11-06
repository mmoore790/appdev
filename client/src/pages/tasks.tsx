import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskList } from "@/components/task-list";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm } from "@/components/task-form";

export default function Tasks() {
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: allTasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const filteredTasks = (allTasks as any[])?.filter((task: any) => {
    const matchesSearch = search.trim() === "" || 
      task.title.toLowerCase().includes(search.toLowerCase());
    
    // Apply assigned-to filter
    let matchesAssignedToFilter = true;
    if (assignedToFilter !== "all") {
      if (assignedToFilter === "unassigned") {
        matchesAssignedToFilter = !task.assignedTo;
      } else {
        matchesAssignedToFilter = task.assignedTo === parseInt(assignedToFilter);
      }
    }
    
    return matchesSearch && matchesAssignedToFilter;
  }) || [];

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
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-4">
            <CardTitle>Tasks</CardTitle>
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
                  tasks={filteredTasks}
                  users={users} 
                  showAllDetails
                />
              </TabsContent>
              
              <TabsContent value="board" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* To Do Column */}
                  <div className="bg-neutral-50 rounded-lg p-4 min-h-[700px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-neutral-700 flex items-center">
                        <AlertCircle size={16} className="text-amber-500 mr-2" />
                        To Do
                        <span className="ml-2 bg-neutral-200 text-neutral-700 text-xs px-2 py-0.5 rounded-full">
                          {filteredTasks.filter(t => t.status === "pending").length}
                        </span>
                      </h3>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Plus size={14} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Create New Task</DialogTitle>
                            <DialogDescription>
                              Create a new task in the To Do column
                            </DialogDescription>
                          </DialogHeader>
                          <TaskForm onComplete={() => {}} defaultStatus="pending" />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="space-y-3">
                      <TaskList 
                        tasks={filteredTasks.filter((t: any) => t.status === "pending")}
                        users={users}
                        variant="card"
                      />
                    </div>
                  </div>
                  
                  {/* In Progress Column */}
                  <div className="bg-blue-50 rounded-lg p-4 min-h-[700px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-neutral-700 flex items-center">
                        <Clock size={16} className="text-blue-600 mr-2" />
                        In Progress
                        <span className="ml-2 bg-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {filteredTasks.filter(t => t.status === "in_progress").length}
                        </span>
                      </h3>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Plus size={14} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Create New Task</DialogTitle>
                            <DialogDescription>
                              Create a new task in the In Progress column
                            </DialogDescription>
                          </DialogHeader>
                          <TaskForm onComplete={() => {}} defaultStatus="in_progress" />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="space-y-3">
                      <TaskList 
                        tasks={filteredTasks.filter((t: any) => t.status === "in_progress")}
                        users={users}
                        variant="card"
                      />
                    </div>
                  </div>
                  
                  {/* Review Column */}
                  <div className="bg-purple-50 rounded-lg p-4 min-h-[700px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-neutral-700 flex items-center">
                        <AlertCircle size={16} className="text-purple-600 mr-2" />
                        Review
                        <span className="ml-2 bg-purple-200 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                          {filteredTasks.filter(t => t.status === "review").length}
                        </span>
                      </h3>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Plus size={14} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Create New Task</DialogTitle>
                            <DialogDescription>
                              Create a new task in the Review column
                            </DialogDescription>
                          </DialogHeader>
                          <TaskForm onComplete={() => {}} defaultStatus="review" />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="space-y-3">
                      <TaskList 
                        tasks={filteredTasks.filter((t: any) => t.status === "review")}
                        users={users}
                        variant="card"
                      />
                    </div>
                  </div>
                  
                  {/* Completed Column */}
                  <div className="bg-green-50 rounded-lg p-4 h-[700px] flex flex-col">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                      <h3 className="font-medium text-neutral-700 flex items-center">
                        <CheckCircle size={16} className="text-green-600 mr-2" />
                        Completed
                        <span className="ml-2 bg-green-200 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          {filteredTasks.filter((t: any) => t.status === "completed").length}
                        </span>
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      <TaskList 
                        tasks={filteredTasks.filter((t: any) => t.status === "completed")}
                        users={users}
                        variant="card"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
