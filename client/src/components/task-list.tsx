import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, User, MoreVertical, Edit, FileText } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TaskForm } from "@/components/task-form";
import { cn, formatTimeAgo, getTaskPriorityColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface TaskListProps {
  tasks: any[];
  isLoading?: boolean;
  showAddButton?: boolean;
  showAllDetails?: boolean;
  variant?: "default" | "card";
  users?: any[];
}

export function TaskList({ 
  tasks, 
  isLoading = false,
  showAddButton = false,
  showAllDetails = false,
  variant = "default",
  users
}: TaskListProps) {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [checkedTasks, setCheckedTasks] = useState<Set<number>>(new Set());
  
  const queryClient = useQueryClient();
  
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: number; newStatus: string }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
    }
  });
  
  const handleTaskCheck = (taskId: number, checked: boolean) => {
    const newCheckedTasks = new Set(checkedTasks);
    if (checked) {
      newCheckedTasks.add(taskId);
    } else {
      newCheckedTasks.delete(taskId);
    }
    setCheckedTasks(newCheckedTasks);
  };

  const markSelectedTasksComplete = () => {
    checkedTasks.forEach(taskId => {
      updateTaskStatusMutation.mutate({ taskId, newStatus: "completed" });
    });
    setCheckedTasks(new Set()); // Clear selections after marking complete
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsTaskDetailOpen(true);
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    if (!users) return `User #${userId}`;
    const user = users.find(u => u.id === userId);
    return user ? user.fullName || user.username : `User #${userId}`;
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDateCopy = new Date(dueDate);
    dueDateCopy.setHours(0, 0, 0, 0);
    
    if (dueDateCopy.getTime() === today.getTime()) {
      return "Due today";
    } else if (dueDateCopy < today) {
      const daysDiff = Math.floor((today.getTime() - dueDateCopy.getTime()) / (1000 * 60 * 60 * 24));
      return `Overdue by ${daysDiff} day${daysDiff > 1 ? 's' : ''}`;
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (dueDateCopy.getTime() === tomorrow.getTime()) {
        return "Due tomorrow";
      } else {
        // Check if due date is within a week
        const oneWeek = new Date(today);
        oneWeek.setDate(today.getDate() + 7);
        
        if (dueDateCopy <= oneWeek) {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return `Due ${days[dueDateCopy.getDay()]}`;
        } else {
          return `Due in ${Math.ceil((dueDateCopy.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} days`;
        }
      }
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "Medium";
    }
  };

  const selectedTask = selectedTaskId ? tasks.find((t: any) => t.id === selectedTaskId) : null;

  if (variant === "card") {
    return (
      <>
        {/* Mark as Complete Button - shows when tasks are selected */}
        {checkedTasks.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {checkedTasks.size} task{checkedTasks.size > 1 ? 's' : ''} selected
              </span>
              <Button 
                onClick={markSelectedTasksComplete}
                disabled={updateTaskStatusMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {updateTaskStatusMutation.isPending ? "Completing..." : "Mark as Complete"}
              </Button>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {tasks.map(task => (
            <Card key={task.id} className="transition hover:shadow-md cursor-pointer" onClick={() => handleTaskClick(task.id)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id={`task-card-${task.id}`}
                    checked={checkedTasks.has(task.id)}
                    onCheckedChange={(checked) => handleTaskCheck(task.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={task.status === "completed"}
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <label 
                        htmlFor={`task-card-${task.id}`}
                        className={cn(
                          "text-sm font-medium",
                          task.status === "completed" && "line-through text-neutral-400"
                        )}
                      >
                        {task.title}
                      </label>
                      <span 
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          getTaskPriorityColor(task.priority).bgColor,
                          getTaskPriorityColor(task.priority).textColor
                        )}
                      >
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-neutral-500 space-x-2">
                      <Clock size={12} />
                      <span>{formatDueDate(task.dueDate)}</span>
                      <User size={12} />
                      <span>{getUserName(task.assignedTo)}</span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-neutral-600 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Task Detail Dialog */}
        <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Task Details</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <TaskForm 
                taskId={selectedTask.id} 
                editMode 
                onComplete={() => {
                  setIsTaskDetailOpen(false);
                  setSelectedTaskId(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
                }} 
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Card>
      <CardHeader className="px-4 py-5 sm:px-6 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg leading-6 font-medium text-neutral-700">
            Tasks
          </CardTitle>
          {showAddButton && (
            <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus size={16} className="mr-1" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <TaskForm onComplete={() => setIsTaskFormOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Mark as Complete Button for default view */}
        {checkedTasks.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {checkedTasks.size} task{checkedTasks.size > 1 ? 's' : ''} selected
              </span>
              <Button 
                onClick={markSelectedTasksComplete}
                disabled={updateTaskStatusMutation.isPending}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {updateTaskStatusMutation.isPending ? "Completing..." : "Mark as Complete"}
              </Button>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="space-y-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex space-x-3">
                <div className="h-6 w-6 bg-neutral-200 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-neutral-200 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-neutral-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-20 text-center text-neutral-500">
            No tasks found.
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map(task => (
              <li key={task.id} className="group">
                <div className="flex items-center">
                  <Checkbox 
                    id={`task-${task.id}`}
                    checked={checkedTasks.has(task.id)}
                    onCheckedChange={(checked) => handleTaskCheck(task.id, checked as boolean)}
                    className="mr-3"
                    disabled={task.status === "completed"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <label 
                          htmlFor={`task-${task.id}`}
                          className={cn(
                            "text-sm font-medium cursor-pointer hover:text-green-600",
                            task.status === "completed" && "line-through text-neutral-400"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            handleTaskClick(task.id);
                          }}
                        >
                          {task.title}
                        </label>
                        <span 
                          className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                            getTaskPriorityColor(task.priority).bgColor,
                            getTaskPriorityColor(task.priority).textColor
                          )}
                        >
                          {getPriorityLabel(task.priority)}
                        </span>
                      </div>
                      {showAllDetails && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical size={12} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Dialog>
                                <DialogTrigger className="w-full text-left">Edit Task</DialogTrigger>
                                <DialogContent>
                                  <TaskForm taskId={task.id} editMode onComplete={() => {}} />
                                </DialogContent>
                              </Dialog>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const newStatus = task.status === "completed" ? "in_progress" : "completed";
                              updateTaskStatusMutation.mutate({ taskId: task.id, newStatus });
                            }}>
                              {task.status === "completed" ? "Mark as In Progress" : "Mark as Completed"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-7 flex items-center text-sm text-neutral-400 mt-1">
                  <Clock size={12} className="mr-1" />
                  {formatDueDate(task.dueDate)}
                  <User size={12} className="mx-2" />
                  {getUserName(task.assignedTo)}
                  {showAllDetails && task.description && (
                    <>
                      <FileText size={12} className="mx-2" />
                      <span className="truncate max-w-[200px]">{task.description}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      
      {!showAllDetails && (
        <CardFooter className="bg-neutral-100 px-4 py-3 text-sm text-right">
          <Link href="/tasks" className="font-medium text-green-700 hover:text-green-800">
            View all tasks
          </Link>
        </CardFooter>
      )}
      
      {/* Task Detail Dialog for default view */}
      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskForm 
              taskId={selectedTask.id} 
              editMode 
              onComplete={() => {
                setIsTaskDetailOpen(false);
                setSelectedTaskId(null);
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}