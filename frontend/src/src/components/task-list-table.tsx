import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, MoreVertical, Archive, Trash2, Edit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { TaskForm } from "./task-form";
import { apiRequest } from "../lib/queryClient";
import { cn, getDueDateMeta, getTaskPriorityColor } from "../lib/utils";
import { useToast } from "../hooks/use-toast";
import { Skeleton } from "./ui/skeleton";

export interface TaskListTableProps {
  tasks: any[];
  isLoading?: boolean;
  users?: any[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  review: { bg: "bg-purple-100", text: "text-purple-700" },
  completed: { bg: "bg-green-100", text: "text-green-700" },
  archived: { bg: "bg-neutral-100", text: "text-neutral-700" },
};

export function TaskListTable({
  tasks = [],
  isLoading = false,
  users = [],
}: TaskListTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "archive" | "delete";
    task: any;
  } | null>(null);

  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: "archived" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks?pendingOnly=true"],
      });
      toast({
        title: "Task archived",
        description: "The task is now hidden from the main board.",
      });
      setPendingAction(null);
    },
    onError: () => {
      toast({
        title: "Archive failed",
        description:
          "We couldn't archive that task right now. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: "deleted" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks?pendingOnly=true"],
      });
      toast({
        title: "Task deleted",
        description: "The task has been removed from your workspace.",
      });
      setPendingAction(null);
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description:
          "We couldn't delete that task right now. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsTaskDetailOpen(true);
  };

  const handleArchiveRequest = (task: any) => {
    setPendingAction({ type: "archive", task });
  };

  const handleDeleteRequest = (task: any) => {
    setPendingAction({ type: "delete", task });
  };

  const getUserName = (userId: number | null | undefined) => {
    if (!userId) return "Unassigned";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.fullName || user.username : `User #${userId}`;
  };

  const getUserInitials = (userId: number | null | undefined) => {
    if (!userId) return "UN";
    const user = users.find((u: any) => u.id === userId);
    if (user) {
      return (user.fullName || user.username || "UN")
        .slice(0, 2)
        .toUpperCase();
    }
    return "UN";
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-8 text-center text-sm text-neutral-500">
        No tasks found. Create a new task to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/50">
              <TableHead className="w-[300px]">Task</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[150px]">Due Date</TableHead>
              <TableHead className="w-[150px]">Assigned To</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const dueMeta = getDueDateMeta(task.dueDate);
              const dueToneClass =
                dueMeta.tone === "danger"
                  ? "text-red-600"
                  : dueMeta.tone === "warning"
                    ? "text-amber-600"
                    : "text-neutral-500";
              const priorityColors = getTaskPriorityColor(task.priority);
              const statusConfig = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
              const assigneeId =
                task.assignedTo === "unassigned" ||
                task.assignedTo === null ||
                task.assignedTo === undefined
                  ? null
                  : typeof task.assignedTo === "string"
                    ? parseInt(task.assignedTo, 10)
                    : task.assignedTo;

              return (
                <TableRow
                  key={task.id}
                  className="hover:bg-neutral-50/50 cursor-pointer transition-colors"
                  onClick={() => handleTaskClick(task.id)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p
                        className={cn(
                          "font-medium text-sm text-neutral-800",
                          task.status === "completed" &&
                            "line-through text-neutral-400",
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-neutral-500 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        statusConfig.bg,
                        statusConfig.text,
                      )}
                    >
                      {STATUS_LABELS[task.status] || task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        priorityColors.bgColor,
                        priorityColors.textColor,
                      )}
                    >
                      {task.priority === "high"
                        ? "High"
                        : task.priority === "low"
                          ? "Low"
                          : "Medium"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className={cn("flex-shrink-0", dueToneClass)} />
                      <span className={cn("text-sm", dueToneClass)}>
                        {dueMeta.label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {getUserInitials(assigneeId)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-neutral-600 truncate">
                        {getUserName(assigneeId)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-neutral-400 hover:text-neutral-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskClick(task.id);
                          }}
                        >
                          <Edit size={14} className="mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {task.status !== "archived" && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveRequest(task);
                            }}
                          >
                            <Archive size={14} className="mr-2" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600 focus:bg-red-50 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRequest(task);
                          }}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isTaskDetailOpen}
        onOpenChange={setIsTaskDetailOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTaskId && (
            <TaskForm
              taskId={selectedTaskId}
              editMode
              onComplete={() => {
                setIsTaskDetailOpen(false);
                setSelectedTaskId(null);
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (
            !open &&
            !archiveTaskMutation.isPending &&
            !deleteTaskMutation.isPending
          ) {
            setPendingAction(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete"
                ? "Delete task"
                : "Archive task"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete" ? (
                <>
                  This will mark{" "}
                  <span className="font-medium text-neutral-700">
                    {pendingAction?.task?.title
                      ? `"${pendingAction.task.title}"`
                      : "this task"}
                  </span>{" "}
                  as deleted and remove it from all views. This action cannot be
                  undone.
                </>
              ) : (
                <>
                  <span className="font-medium text-neutral-700">
                    {pendingAction?.task?.title
                      ? `"${pendingAction.task.title}"`
                      : "This task"}
                  </span>{" "}
                  will be hidden from the board but kept in the archive drawer.
                  You can restore it anytime.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                archiveTaskMutation.isPending ||
                deleteTaskMutation.isPending
              }
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                pendingAction?.type === "delete"
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
              }
              disabled={
                archiveTaskMutation.isPending ||
                deleteTaskMutation.isPending
              }
              onClick={() => {
                if (!pendingAction) return;
                if (pendingAction.type === "archive") {
                  archiveTaskMutation.mutate(pendingAction.task.id);
                } else {
                  deleteTaskMutation.mutate(pendingAction.task.id);
                }
              }}
            >
              {pendingAction?.type === "delete"
                ? deleteTaskMutation.isPending
                  ? "Deleting..."
                  : "Delete task"
                : archiveTaskMutation.isPending
                  ? "Archiving..."
                  : "Archive task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}




