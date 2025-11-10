import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, User, MoreVertical, Edit, FileText } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { TaskForm } from "./task-form";
import { cn, formatTimeAgo, getTaskPriorityColor } from "../lib/utils";
import { apiRequest } from "../lib/queryClient";
import { Link } from "wouter";

// --- START: Added DnD Imports ---
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// --- END: Added DnD Imports ---

interface TaskListProps {
  tasks: any[];
  isLoading?: boolean;
  showAddButton?: boolean;
  showAllDetails?: boolean;
  variant?: "default" | "card";
  users?: any[];
}

// --- START: Added Draggable Wrapper Component ---
/**
 * This component wraps the Task Card to make it draggable.
 * It uses the task.id as its unique identifier for dnd-kit.
 */
function DraggableTaskCard({ task, children }: { task: any; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id, // This is crucial: the draggable ID is the task ID
    data: { type: 'task', status: task.status } // Pass task data for context
  });

  // Apply styles for dragging (movement, transition, opacity)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
// --- END: Added Draggable Wrapper Component ---


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
  
  // ... (all other existing functions like handleTaskCheck, markSelectedTasksComplete, etc. remain unchanged) ...
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


  // --- START: Modified "card" variant ---
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
          {/* Wrap the card in the DraggableTaskCard component */}
          {tasks.map(task => (
            <DraggableTaskCard key={task.id} task={task}>
              <Card 
                className="transition hover:shadow-md cursor-grab" // Changed cursor to grab
                onClick={() => handleTaskClick(task.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id={`task-card-${task.id}`}
                      checked={checkedTasks.has(task.id)}
                      onCheckedChange={(checked) => handleTaskCheck(task.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()} // Prevents click from bubbling to card
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
            </DraggableTaskCard>
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
  // --- END: Modified "card" variant ---


  // --- Default list variant (no changes needed here) ---
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
        {/* ... (rest of the default list view is unchanged) ... */}
      </CardContent>
      {/* ... (rest of the component is unchanged) ... */}
    </Card>
  );
}