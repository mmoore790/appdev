import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  DragOverlay,
  KeyboardSensor,
  useDroppable
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, GripVertical, Plus, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { TaskForm } from "./task-form";
import { apiRequest } from "../lib/queryClient";
import { cn, getDueDateMeta, getTaskPriorityColor, DueDateTone } from "../lib/utils";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "../hooks/use-toast";

type TaskStatus = "pending" | "in_progress" | "review" | "completed";

interface TaskBoardProps {
  tasks: any[];
  users?: any[];
  isLoading?: boolean;
}

interface StatusConfig {
  id: TaskStatus;
  title: string;
  description: string;
  accent: string;
  badge: string;
  emptyMessage: string;
  icon: typeof AlertCircle;
}

const STATUS_CONFIG: StatusConfig[] = [
  {
    id: "pending",
    title: "To Do",
    description: "Ideas and requests waiting to be picked up.",
    accent: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    emptyMessage: "Drop a task here when you're ready to schedule it.",
    icon: AlertCircle
  },
  {
    id: "in_progress",
    title: "In Progress",
    description: "Active work that is currently underway.",
    accent: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    emptyMessage: "Drag tasks here when work is underway.",
    icon: Clock
  },
  {
    id: "review",
    title: "Review",
    description: "Work pending feedback or quality checks.",
    accent: "text-purple-600",
    badge: "bg-purple-100 text-purple-700",
    emptyMessage: "Tasks that need review will appear here.",
    icon: ClipboardList
  },
  {
    id: "completed",
    title: "Completed",
    description: "Recently delivered work and closed loops.",
    accent: "text-green-600",
    badge: "bg-green-100 text-green-700",
    emptyMessage: "Completed tasks will drop in here automatically.",
    icon: CheckCircle
  }
];

const DUE_TONE_CLASSES: Record<DueDateTone, string> = {
  muted: "text-neutral-500",
  warning: "text-amber-600",
  danger: "text-red-600",
  success: "text-green-600"
};

type ColumnState = Record<TaskStatus, any[]>;

const deriveColumnsFromTasks = (tasks: any[]): ColumnState => {
  const initial: ColumnState = {
    pending: [],
    in_progress: [],
    review: [],
    completed: []
  };

  tasks.forEach(task => {
    const status = (task.status as TaskStatus) || "pending";
    if (initial[status]) {
      initial[status].push(task);
    } else {
      initial.pending.push(task);
    }
  });

  // Sort each column by due date (earliest first), then priority
  STATUS_CONFIG.forEach(({ id }) => {
    initial[id] = initial[id].sort((a, b) => {
      const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (dueA !== dueB) return dueA - dueB;
      const priorityScore = { high: 1, medium: 2, low: 3 };
      return (priorityScore[a.priority] || 99) - (priorityScore[b.priority] || 99);
    });
  });

  return initial;
};

export function TaskBoard({ tasks, users = [], isLoading = false }: TaskBoardProps) {
  const [columns, setColumns] = useState<ColumnState>(() => deriveColumnsFromTasks(tasks));
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    status?: TaskStatus;
    taskId?: number;
  }>({ isOpen: false, mode: "create", status: "pending" });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setColumns(deriveColumnsFromTasks(tasks));
  }, [tasks]);

  const activeTask = useMemo(
    () => tasks.find(task => task.id === activeTaskId) ?? null,
    [activeTaskId, tasks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: number; newStatus: TaskStatus }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: newStatus });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
      toast({
        title: "Task updated",
        description: `Moved to ${STATUS_CONFIG.find(status => status.id === variables.newStatus)?.title ?? "new column"}.`
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "We couldn't update that task. Please try again.",
        variant: "destructive"
      });
      setColumns(deriveColumnsFromTasks(tasks)); // revert UI
    }
  });

  const openCreateDialog = (status: TaskStatus) => {
    setDialogState({ isOpen: true, mode: "create", status });
  };

  const openEditDialog = (taskId: number) => {
    setDialogState({ isOpen: true, mode: "edit", taskId });
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (typeof event.active.id === "number") {
      setActiveTaskId(event.active.id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const activeColumnId = active.data.current?.columnId as TaskStatus | undefined;
    const overColumnId = (over.data.current?.columnId as TaskStatus | undefined) ?? (typeof overId === "string" ? (overId as TaskStatus) : undefined);

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) return;

    setColumns(prev => {
      const activeTasks = prev[activeColumnId];
      const overTasks = prev[overColumnId];
      const activeIndex = activeTasks.findIndex(task => task.id === activeId);
      if (activeIndex === -1) return prev;

      const overIndex = overTasks.findIndex(task => task.id === overId);

      const updatedActive = [...activeTasks];
      const [movedTask] = updatedActive.splice(activeIndex, 1);
      const updatedOver = [...overTasks];
      const insertIndex = overIndex >= 0 ? overIndex : updatedOver.length;
      updatedOver.splice(insertIndex, 0, movedTask);

      return {
        ...prev,
        [activeColumnId]: updatedActive,
        [overColumnId]: updatedOver
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveTaskId(null);
      setColumns(deriveColumnsFromTasks(tasks));
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    const activeColumnId = active.data.current?.columnId as TaskStatus | undefined;
    const overColumnId = (over.data.current?.columnId as TaskStatus | undefined) ?? (typeof overId === "string" ? (overId as TaskStatus) : undefined);

    if (!activeColumnId || !overColumnId) {
      setActiveTaskId(null);
      return;
    }

    if (activeColumnId === overColumnId) {
      const activeIndex = columns[activeColumnId].findIndex(task => task.id === activeId);
      const overIndex = columns[overColumnId].findIndex(task => task.id === overId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setColumns(prev => ({
          ...prev,
          [activeColumnId]: arrayMove(prev[activeColumnId], activeIndex, overIndex)
        }));
      }
    } else {
      setColumns(prev => {
        const updated = { ...prev };
        const sourceIndex = updated[activeColumnId].findIndex(task => task.id === activeId);
        if (sourceIndex === -1) return prev;
        const [movedTask] = updated[activeColumnId].splice(sourceIndex, 1);
        movedTask.status = overColumnId;

        const targetIndex = over.data.current?.type === "column"
          ? updated[overColumnId].length
          : updated[overColumnId].findIndex(task => task.id === overId);

        if (targetIndex >= 0) {
          updated[overColumnId].splice(targetIndex, 0, movedTask);
        } else {
          updated[overColumnId].push(movedTask);
        }
        return updated;
      });

      if (typeof activeId === "number") {
        updateTaskStatusMutation.mutate({ taskId: activeId, newStatus: overColumnId });
      }
    }

    setActiveTaskId(null);
  };

  const totalCounts = useMemo(() => {
    const overdueTasks = tasks.filter(task => getDueDateMeta(task.dueDate).tone === "danger");
    const dueSoonTasks = tasks.filter(task => {
      const meta = getDueDateMeta(task.dueDate);
      return meta.tone === "warning" && meta.daysUntil !== null && meta.daysUntil <= 2;
    });
    return {
      overdue: overdueTasks.length,
      dueSoon: dueSoonTasks.length
    };
  }, [tasks]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{totalCounts.overdue}</div>
            <p className="text-xs text-neutral-500 mt-1">Tasks past their due date</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Due Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-amber-600">{totalCounts.dueSoon}</div>
            <p className="text-xs text-neutral-500 mt-1">Due within the next 48 hours</p>
          </CardContent>
        </Card>
        <Card className="border border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-600">{columns.in_progress.length}</div>
            <p className="text-xs text-neutral-500 mt-1">Active tasks currently being worked on</p>
          </CardContent>
        </Card>
        <Card className="border border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Completed (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">{columns.completed.length}</div>
            <p className="text-xs text-neutral-500 mt-1">Delivered in the last month</p>
          </CardContent>
        </Card>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <ScrollArea className="mt-6">
          <div className="flex gap-4 pb-4 min-w-[1200px]">
            {STATUS_CONFIG.map(status => (
              <TaskBoardColumn
                key={status.id}
                status={status}
                tasks={columns[status.id]}
                users={users}
                onAddTask={() => openCreateDialog(status.id)}
                onTaskClick={openEditDialog}
                isLoading={isLoading}
                activeTaskId={activeTaskId}
              />
            ))}
          </div>
        </ScrollArea>

        <DragOverlay>
          {activeTask ? (
            <TaskBoardCard task={activeTask} users={users} columnId={activeTask.status} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={dialogState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState(prev => ({ ...prev, isOpen: false, taskId: undefined }));
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "create" ? "Create Task" : "Task Details"}
            </DialogTitle>
          </DialogHeader>
          {dialogState.mode === "create" && dialogState.status ? (
            <TaskForm
              defaultStatus={dialogState.status}
              onComplete={() => {
                setDialogState(prev => ({ ...prev, isOpen: false, taskId: undefined }));
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              }}
            />
          ) : dialogState.mode === "edit" && dialogState.taskId ? (
            <TaskForm
              taskId={dialogState.taskId}
              editMode
              onComplete={() => {
                setDialogState(prev => ({ ...prev, isOpen: false, taskId: undefined }));
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TaskBoardColumnProps {
  status: StatusConfig;
  tasks: any[];
  users: any[];
  onAddTask: () => void;
  onTaskClick: (taskId: number) => void;
  isLoading: boolean;
  activeTaskId: number | null;
}

function TaskBoardColumn({
  status,
  tasks,
  users,
  onAddTask,
  onTaskClick,
  isLoading,
  activeTaskId
}: TaskBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppableColumn(status.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-full min-w-[260px] flex-col rounded-xl border border-neutral-200/70 bg-white shadow-sm transition",
        isOver && "ring-2 ring-green-500/60"
      )}
      data-column={status.id}
    >
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 p-4">
        <div>
          <div className="flex items-center gap-2">
            <status.icon size={16} className={status.accent} />
            <h3 className="text-sm font-semibold text-neutral-700">{status.title}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.badge)}>
              {tasks.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">{status.description}</p>
        </div>
        {status.id !== "completed" && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onAddTask}>
            <Plus size={16} />
          </Button>
        )}
      </div>

      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 p-4">
          {isLoading && tasks.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-md bg-neutral-100" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
              {status.emptyMessage}
            </div>
          ) : (
            tasks.map(task => (
              <TaskBoardCard
                key={task.id}
                task={task}
                users={users}
                columnId={status.id}
                onClick={() => onTaskClick(task.id)}
                isActiveDrag={activeTaskId === task.id}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface TaskBoardCardProps {
  task: any;
  users: any[];
  columnId: TaskStatus;
  onClick?: () => void;
  isActiveDrag?: boolean;
  isOverlay?: boolean;
}

function TaskBoardCard({ task, users, columnId, onClick, isActiveDrag = false, isOverlay = false }: TaskBoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      columnId,
      type: "task"
    }
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        transition
      }
    : {};

  const dueMeta = getDueDateMeta(task.dueDate);
  const dueToneClass = DUE_TONE_CLASSES[dueMeta.tone] ?? DUE_TONE_CLASSES.muted;
  const priorityColors = getTaskPriorityColor(task.priority);
  const assigneeId =
    task.assignedTo === "unassigned" || task.assignedTo === null || task.assignedTo === undefined
      ? null
      : typeof task.assignedTo === "string"
        ? parseInt(task.assignedTo, 10)
        : task.assignedTo;
  const user =
    typeof assigneeId === "number" && !Number.isNaN(assigneeId)
      ? users.find(u => u.id === assigneeId)
      : undefined;

  const content = (
    <Card
      className={cn(
        "group cursor-grab border border-neutral-200/80 shadow-sm transition hover:border-neutral-300 hover:shadow-md",
        (isDragging || isActiveDrag || isOverlay) && "border-green-400 bg-green-50/40 shadow-lg",
        columnId === "completed" && "bg-green-50/40"
      )}
      style={style}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <GripVertical size={14} className="mt-1 text-neutral-300 opacity-0 transition group-hover:opacity-100" />
            <div>
              <p className={cn("text-sm font-medium text-neutral-700", task.status === "completed" && "line-through text-neutral-400")}>
                {task.title}
              </p>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{task.description}</p>
              )}
            </div>
          </div>
          <Badge className={cn("text-xs", priorityColors.bgColor, priorityColors.textColor)}>
            {task.priority === "high" ? "High" : task.priority === "low" ? "Low" : "Medium"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          <span className={cn("flex items-center gap-1 font-medium", dueToneClass)}>
            <Clock size={12} />
            {dueMeta.label}
          </span>
          <span className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[11px]">
                {user?.fullName?.slice(0, 2)?.toUpperCase() ?? "UN"}
              </AvatarFallback>
            </Avatar>
            <span className="text-neutral-600">
              {user?.fullName || user?.username || "Unassigned"}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (isOverlay) {
    return content;
  }

  return content;
}

function useDroppableColumn(columnId: TaskStatus) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { columnId, type: "column" }
  });

  return { setNodeRef, isOver };
}
