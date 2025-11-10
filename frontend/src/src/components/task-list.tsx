import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, User, MoreVertical, FileText } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { TaskForm } from "./task-form";
import { cn, getTaskPriorityColor, getDueDateMeta, DueDateTone } from "../lib/utils";
import { apiRequest } from "../lib/queryClient";
import { Link } from "wouter";

const DUE_TONE_CLASSES: Record<DueDateTone, string> = {
  muted: "text-neutral-500",
  warning: "text-amber-600",
  danger: "text-red-600",
  success: "text-green-600"
};

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

  const getUserName = (userId: number | string | null) => {
    if (!userId || userId === "unassigned") return "Unassigned";
    const numericId = typeof userId === "string" ? parseInt(userId, 10) : userId;
    if (!Number.isFinite(numericId)) return "Unassigned";
    if (!users) return `User #${numericId}`;
    const user = users.find(u => u.id === numericId);
    return user ? user.fullName || user.username : `User #${numericId}`;
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
            {tasks.map(task => {
              const dueMeta = getDueDateMeta(task.dueDate);
              const dueToneClass = DUE_TONE_CLASSES[dueMeta.tone] ?? DUE_TONE_CLASSES.muted;

              return (
                <Card
                  key={task.id}
                  className="transition hover:shadow-md cursor-pointer"
                  onClick={() => handleTaskClick(task.id)}
                >
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
                        <div className="flex items-center justify-between gap-2">
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
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className={cn("text-neutral-400", dueToneClass)} />
                            <span className={cn(dueToneClass)}>{dueMeta.label}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-neutral-400" />
                            <span className="text-neutral-600">{getUserName(task.assignedTo)}</span>
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-neutral-600 line-clamp-2">{task.description}</p>
                        )}
                      </div>
                  </div>
                  </CardContent>
                </Card>
              );
            })}
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
              {tasks.map(task => {
                const dueMeta = getDueDateMeta(task.dueDate);
                const dueToneClass = DUE_TONE_CLASSES[dueMeta.tone] ?? DUE_TONE_CLASSES.muted;

                return (
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
                    <div className="ml-7 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className={cn("text-neutral-400", dueToneClass)} />
                        <span className={cn(dueToneClass)}>{dueMeta.label}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} className="text-neutral-400" />
                        <span className="text-neutral-600">{getUserName(task.assignedTo)}</span>
                      </span>
                      {showAllDetails && task.description && (
                        <span className="flex items-center gap-1 text-neutral-500">
                          <FileText size={12} className="text-neutral-400" />
                          <span className="truncate max-w-[200px]">{task.description}</span>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
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