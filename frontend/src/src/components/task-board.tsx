import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle,
  Clock,
  GripVertical,
  Plus,
  ClipboardList,
  Loader2,
  MoreVertical,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { TaskForm } from "./task-form";
import { apiRequest } from "../lib/queryClient";
import { cn, getDueDateMeta, getTaskPriorityColor, DueDateTone } from "../lib/utils";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "./ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { useToast } from "../hooks/use-toast";

type BoardStatus = "pending" | "in_progress" | "review" | "completed";
type TaskStatus = BoardStatus | "archived" | "deleted";

interface TaskBoardProps {
  tasks: any[];
  users?: any[];
  isLoading?: boolean;
}

interface StatusConfig {
  id: BoardStatus;
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

const isBoardStatus = (value: string): value is BoardStatus =>
  STATUS_CONFIG.some(status => status.id === value);

const DUE_TONE_CLASSES: Record<DueDateTone, string> = {
  muted: "text-neutral-500",
  warning: "text-amber-600",
  danger: "text-red-600",
  success: "text-green-600"
};

type ColumnState = Record<BoardStatus, any[]>;

interface DerivedBoardState {
  columns: ColumnState;
  archived: any[];
}

interface PendingMoveState {
  taskId: number;
  fromStatus: BoardStatus;
  toStatus: BoardStatus;
  taskTitle?: string;
}

const PRIORITY_SORT = { high: 1, medium: 2, low: 3 } as const;

const BOARD_STATUS_VALUES: TaskStatus[] = ["pending", "in_progress", "review", "completed", "archived", "deleted"];

const STATUS_ALIASES: Record<string, TaskStatus> = {
  todo: "pending",
  to_do: "pending",
  to_do_list: "pending",
  backlog: "pending",
  inprogress: "in_progress",
  "in-progress": "in_progress",
  "in_progress": "in_progress",
  "in progress": "in_progress",
  reviewing: "review",
  under_review: "review",
  "under-review": "review",
  awaiting_review: "review",
  done: "completed",
  complete: "completed",
  finished: "completed"
};

const normalizeBoardStatus = (status: unknown): TaskStatus => {
  if (typeof status !== "string") {
    return "pending";
  }

  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if ((BOARD_STATUS_VALUES as string[]).includes(normalized)) {
    return normalized as TaskStatus;
  }

  if (STATUS_ALIASES[normalized]) {
    return STATUS_ALIASES[normalized];
  }

  return "pending";
};

type StatusOverridesMap = Record<string, BoardStatus>;

const getTaskIdKey = (task: any): string | null => {
  if (!task) {
    return null;
  }
  const { id } = task;
  if (id === null || id === undefined) {
    return null;
  }
  const key = String(id);
  return key.length > 0 ? key : null;
};

const applyStatusOverrides = (tasks: any[], overrides: StatusOverridesMap): any[] => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return Array.isArray(tasks) ? tasks : [];
  }

  if (!overrides || Object.keys(overrides).length === 0) {
    return tasks;
  }

  let didOverride = false;

  const updatedTasks = tasks.map(task => {
    const key = getTaskIdKey(task);
    if (!key) {
      return task;
    }

    const override = overrides[key];
    if (!override) {
      return task;
    }

    const normalized = normalizeBoardStatus(task.status);
    if (normalized === override) {
      return task;
    }

    didOverride = true;
    return { ...task, status: override };
  });

  return didOverride ? updatedTasks : tasks;
};

interface UpdateTaskStatusVariables {
  taskId: number;
  newStatus: BoardStatus;
  previousStatus?: BoardStatus;
}

const sortTasksForColumn = (tasks: any[]) =>
  tasks.slice().sort((a, b) => {
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (dueA !== dueB) return dueA - dueB;
    const scoreA = PRIORITY_SORT[a.priority as keyof typeof PRIORITY_SORT] ?? 99;
    const scoreB = PRIORITY_SORT[b.priority as keyof typeof PRIORITY_SORT] ?? 99;
    return scoreA - scoreB;
  });

const getComparableDate = (task: any) => {
  const sources = [task.updatedAt, task.completedAt, task.dueDate, task.createdAt];
  for (const value of sources) {
    if (value) {
      const timestamp = new Date(value).getTime();
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
    }
  }
  return 0;
};

const sortArchivedTasks = (tasks: any[]) =>
  tasks.slice().sort((a, b) => getComparableDate(b) - getComparableDate(a));

const deriveBoardState = (tasks: any[]): DerivedBoardState => {
  const initial: ColumnState = {
    pending: [],
    in_progress: [],
    review: [],
    completed: []
  };
  const archived: any[] = [];

  tasks.forEach(task => {
    const status = normalizeBoardStatus(task?.status);
    const normalizedTask = status !== task?.status ? { ...task, status } : task;

    if (status === "archived") {
      archived.push(normalizedTask);
      return;
    }

    if (status === "deleted") {
      return;
    }

    if (initial[status as BoardStatus]) {
      initial[status as BoardStatus].push(normalizedTask);
    } else {
      initial.pending.push(normalizedTask);
    }
  });

  STATUS_CONFIG.forEach(({ id }) => {
    initial[id] = sortTasksForColumn(initial[id]);
  });

  return {
    columns: initial,
    archived: sortArchivedTasks(archived)
  };
};

export function TaskBoard({ tasks, users = [], isLoading = false }: TaskBoardProps) {
  const sanitizedTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const [statusOverrides, setStatusOverrides] = useState<StatusOverridesMap>({});
  const tasksWithOverrides = useMemo(
    () => applyStatusOverrides(sanitizedTasks, statusOverrides),
    [sanitizedTasks, statusOverrides]
  );
  const derived = useMemo(() => deriveBoardState(tasksWithOverrides), [tasksWithOverrides]);
  const [columns, setColumns] = useState<ColumnState>(derived.columns);
  const [archivedTasks, setArchivedTasks] = useState<any[]>(derived.archived);
  const skipHydrationRef = useRef(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    status?: BoardStatus;
    taskId?: number;
  }>({ isOpen: false, mode: "create", status: "pending" });
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "archive" | "delete"; task: any } | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMoveState | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false;
      return;
    }

    setColumns(derived.columns);
    setArchivedTasks(derived.archived);
  }, [derived]);

  useEffect(() => {
    setStatusOverrides(prev => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }

      const next: StatusOverridesMap = { ...prev };
      let changed = false;
      const validTaskIds = new Set<string>();

      sanitizedTasks.forEach(task => {
        const key = getTaskIdKey(task);
        if (!key) {
          return;
        }

        validTaskIds.add(key);
        const normalized = normalizeBoardStatus(task.status);
        if (next[key] && next[key] === normalized) {
          delete next[key];
          changed = true;
        }
      });

      Object.keys(prev).forEach(key => {
        if (!validTaskIds.has(key) && next[key] !== undefined) {
          delete next[key];
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }

      return Object.keys(next).length === 0 ? {} : next;
    });
  }, [sanitizedTasks]);

  const removeTaskFromColumns = (taskId: string | number) => {
    const idKey = String(taskId);
    setColumns(prev => ({
      pending: prev.pending.filter(task => String(task.id) !== idKey),
      in_progress: prev.in_progress.filter(task => String(task.id) !== idKey),
      review: prev.review.filter(task => String(task.id) !== idKey),
      completed: prev.completed.filter(task => String(task.id) !== idKey)
    }));
  };

  const addTaskToColumn = (task: any, status: BoardStatus) => {
    setColumns(prev => ({
      ...prev,
      [status]: sortTasksForColumn([...prev[status], task])
    }));
  };

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }
    return tasksWithOverrides.find(task => String(task.id) === activeTaskId) ?? null;
  }, [activeTaskId, tasksWithOverrides]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
 
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: UpdateTaskStatusVariables) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: newStatus });
    },
    onMutate: async ({ taskId, newStatus, previousStatus }: UpdateTaskStatusVariables) => {
      if (previousStatus) {
        skipHydrationRef.current = true;
      }

      setStatusOverrides(prev => {
        const idKey = String(taskId);
        if (prev[idKey] === newStatus) {
          return prev;
        }
        const next = { ...prev, [idKey]: newStatus };
        return next;
      });

      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previousTasks = queryClient.getQueryData<any[]>(["/api/tasks"]);

      queryClient.setQueryData<any[]>(["/api/tasks"], current => {
        if (!Array.isArray(current)) {
          return current;
        }
        const idKey = String(taskId);
        return current.map(task => (String(task.id) === idKey ? { ...task, status: newStatus } : task));
      });

      return { previousTasks, previousStatus };
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Task updated",
        description: `Moved to ${STATUS_CONFIG.find(status => status.id === variables.newStatus)?.title ?? "new column"}.`
      });
    },
    onError: (_error, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }

      let overridesSnapshot: StatusOverridesMap | null = null;
      setStatusOverrides(prev => {
        const next: StatusOverridesMap = { ...prev };
        const idKey = String(variables.taskId);
        if (context?.previousStatus) {
          next[idKey] = context.previousStatus;
        } else {
          delete next[idKey];
        }
        const normalizedNext = Object.keys(next).length === 0 ? {} : next;
        overridesSnapshot = normalizedNext;
        return normalizedNext;
      });

      skipHydrationRef.current = true;
      const appliedOverrides = overridesSnapshot ?? {};
      const { columns: resetColumns, archived: resetArchived } = deriveBoardState(
        applyStatusOverrides(sanitizedTasks, appliedOverrides)
      );
      setColumns(resetColumns);
      setArchivedTasks(resetArchived);

      toast({
        title: "Update failed",
        description: "We couldn't update that task. Please try again.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
    }
  });
  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: "archived" });
    },
    onSuccess: (updatedTask: any) => {
      removeTaskFromColumns(updatedTask.id);
      const updatedIdKey = String(updatedTask.id);
      setArchivedTasks(prev =>
        sortArchivedTasks([
          ...prev.filter(task => String(task.id) !== updatedIdKey),
          updatedTask
        ])
      );
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
      toast({
        title: "Task archived",
        description: "The task is now hidden from the main board."
      });
      setPendingAction(null);
    },
    onError: () => {
      toast({
        title: "Archive failed",
        description: "We couldn't archive that task right now. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: "deleted" });
    },
    onSuccess: (updatedTask: any) => {
      removeTaskFromColumns(updatedTask.id);
      const updatedIdKey = String(updatedTask.id);
      setArchivedTasks(prev => prev.filter(task => String(task.id) !== updatedIdKey));
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
      toast({
        title: "Task deleted",
        description: "The task has been removed from your workspace."
      });
      setPendingAction(null);
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "We couldn't delete that task right now. Please try again.",
        variant: "destructive"
      });
    }
  });

  const restoreTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: BoardStatus }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: (updatedTask: any, variables) => {
      removeTaskFromColumns(updatedTask.id);
      const updatedIdKey = String(updatedTask.id);
      setArchivedTasks(prev => prev.filter(task => String(task.id) !== updatedIdKey));
      addTaskToColumn(updatedTask, variables.status);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?pendingOnly=true"] });
      toast({
        title: "Task restored",
        description: `Returned to ${STATUS_CONFIG.find(status => status.id === variables.status)?.title ?? "the board"}.`
      });
    },
    onError: () => {
      toast({
        title: "Restore failed",
        description: "We couldn't restore that task right now. Please try again.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setRestoreTargetId(null);
    }
  });

  const openCreateDialog = (status: BoardStatus) => {
    setDialogState({ isOpen: true, mode: "create", status });
  };

  const openEditDialog = (taskId: number) => {
    setDialogState({ isOpen: true, mode: "edit", taskId });
  };

  const requestArchiveTask = (task: any) => setPendingAction({ type: "archive", task });
  const requestDeleteTask = (task: any) => setPendingAction({ type: "delete", task });

  const handleRestoreTask = (task: any) => {
    const idKey = String(task.id);
    setRestoreTargetId(idKey);
    const numericId = Number(task.id);
    if (Number.isNaN(numericId)) {
      toast({
        title: "Unable to restore task",
        description: "Task identifier is invalid.",
        variant: "destructive"
      });
      return;
    }
    restoreTaskMutation.mutate({ taskId: numericId, status: "pending" });
  };

  const handleCancelPendingMove = () => {
    if (!pendingMove) {
      return;
    }
    const { columns: resetColumns, archived: resetArchived } = deriveBoardState(
      applyStatusOverrides(sanitizedTasks, statusOverrides)
    );
    setColumns(resetColumns);
    setArchivedTasks(resetArchived);
    setPendingMove(null);
    skipHydrationRef.current = false;
  };

  const handleConfirmPendingMove = () => {
    if (!pendingMove || updateTaskStatusMutation.isPending) {
      return;
    }
    const move = pendingMove;
    setPendingMove(null);
    skipHydrationRef.current = true;
    updateTaskStatusMutation.mutate({
      taskId: move.taskId,
      newStatus: move.toStatus,
      previousStatus: move.fromStatus
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active?.id == null) {
      setActiveTaskId(null);
      return;
    }
    setActiveTaskId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeColumnId = active.data.current?.columnId as BoardStatus | undefined;
    const overColumnId =
      (over.data.current?.columnId as BoardStatus | undefined) ??
      (typeof over.id === "string" && isBoardStatus(over.id) ? (over.id as BoardStatus) : undefined);

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) return;

    setColumns(prev => {
      const activeTasks = prev[activeColumnId];
      const overTasks = prev[overColumnId];
      const activeIndex = activeTasks.findIndex(task => String(task.id) === activeId);
      if (activeIndex === -1) return prev;

      const overIndex = overTasks.findIndex(task => String(task.id) === overId);

      const updatedActive = [...activeTasks];
      const [movedTask] = updatedActive.splice(activeIndex, 1);
      const updatedOver = [...overTasks];
      const insertIndex = overIndex >= 0 ? overIndex : updatedOver.length;
      updatedOver.splice(insertIndex, 0, { ...movedTask, status: overColumnId });

      return {
        ...prev,
        [activeColumnId]: updatedActive,
        [overColumnId]: updatedOver
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active?.id == null) {
      setActiveTaskId(null);
      return;
    }

    if (pendingMove) {
      setActiveTaskId(null);
      return;
    }

    if (!over) {
      setActiveTaskId(null);
      const { columns: resetColumns, archived: resetArchived } = deriveBoardState(
        applyStatusOverrides(sanitizedTasks, statusOverrides)
      );
      setColumns(resetColumns);
      setArchivedTasks(resetArchived);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeColumnId = active.data.current?.columnId as BoardStatus | undefined;
    const overColumnId =
      (over.data.current?.columnId as BoardStatus | undefined) ??
      (typeof over.id === "string" && isBoardStatus(over.id) ? (over.id as BoardStatus) : undefined);

    if (!activeColumnId || !overColumnId) {
      setActiveTaskId(null);
      return;
    }

    if (activeColumnId === overColumnId) {
      setColumns(prev => {
        const columnTasks = prev[activeColumnId] ?? [];
        const currentActiveIndex = columnTasks.findIndex(task => String(task.id) === activeId);
        const currentOverIndex = columnTasks.findIndex(task => String(task.id) === overId);
        if (
          currentActiveIndex === -1 ||
          currentOverIndex === -1 ||
          currentActiveIndex === currentOverIndex
        ) {
          return prev;
        }

        return {
          ...prev,
          [activeColumnId]: arrayMove(columnTasks, currentActiveIndex, currentOverIndex)
        };
      });
      setActiveTaskId(null);
      return;
    }

    const numericTaskId = Number(active.id);
    if (Number.isNaN(numericTaskId)) {
      toast({
        title: "Unable to update task",
        description: "Task identifier is invalid.",
        variant: "destructive"
      });
      const { columns: resetColumns, archived: resetArchived } = deriveBoardState(
        applyStatusOverrides(sanitizedTasks, statusOverrides)
      );
      setColumns(resetColumns);
      setArchivedTasks(resetArchived);
      setActiveTaskId(null);
      return;
    }

    const sourceTasks = columns[activeColumnId] ?? [];
    const targetTasks = columns[overColumnId] ?? [];

    let updatedSource = [...sourceTasks];
    let updatedTarget = [...targetTasks];
    let movingTask: any | null = null;

    const sourceIndex = sourceTasks.findIndex(task => String(task.id) === activeId);
    if (sourceIndex !== -1) {
      [movingTask] = updatedSource.splice(sourceIndex, 1);
    }

    if (!movingTask) {
      const targetExistingIndex = targetTasks.findIndex(task => String(task.id) === activeId);
      if (targetExistingIndex !== -1) {
        const targetCopy = [...targetTasks];
        [movingTask] = targetCopy.splice(targetExistingIndex, 1);
        updatedTarget = targetCopy;
      }
    }

    if (!movingTask) {
      const fallbackTask =
        tasksWithOverrides.find(task => String(task.id) === activeId) ??
        sanitizedTasks.find(task => String(task.id) === activeId);

      if (!fallbackTask) {
        const { columns: resetColumns, archived: resetArchived } = deriveBoardState(
          applyStatusOverrides(sanitizedTasks, statusOverrides)
        );
        setColumns(resetColumns);
        setArchivedTasks(resetArchived);
        setActiveTaskId(null);
        return;
      }

      movingTask = fallbackTask;
      updatedSource = sourceTasks.filter(task => String(task.id) !== activeId);
    }

    const updatedTask = { ...movingTask, status: overColumnId };

    let insertIndex: number;
    if (over.data.current?.type === "column") {
      insertIndex = updatedTarget.length;
    } else {
      insertIndex = updatedTarget.findIndex(task => String(task.id) === overId);
      if (insertIndex === -1) {
        insertIndex = updatedTarget.length;
      }
    }

    const finalTarget = [...updatedTarget];
    finalTarget.splice(insertIndex, 0, updatedTask);

    const nextColumns: ColumnState = {
      ...columns,
      [activeColumnId]: updatedSource,
      [overColumnId]: finalTarget
    };

    setColumns(nextColumns);
    setPendingMove({
      taskId: numericTaskId,
      fromStatus: activeColumnId,
      toStatus: overColumnId,
      taskTitle: typeof updatedTask?.title === "string" ? updatedTask.title : undefined
    });
    skipHydrationRef.current = true;
    setActiveTaskId(null);
  };

  const filteredForMetrics = useMemo(
    () => tasksWithOverrides.filter(task => task.status !== "archived" && task.status !== "deleted"),
    [tasksWithOverrides]
  );

  const totalCounts = useMemo(() => {
    const overdueTasks = filteredForMetrics.filter(task => getDueDateMeta(task.dueDate).tone === "danger");
    const dueSoonTasks = filteredForMetrics.filter(task => {
      const meta = getDueDateMeta(task.dueDate);
      return meta.tone === "warning" && meta.daysUntil !== null && meta.daysUntil <= 2;
    });
    return {
      overdue: overdueTasks.length,
      dueSoon: dueSoonTasks.length
    };
  }, [filteredForMetrics]);

  const isArchivePending = pendingAction?.type === "archive" && archiveTaskMutation.isPending;
  const isDeletePending = pendingAction?.type === "delete" && deleteTaskMutation.isPending;
  const pendingMoveTargetConfig = pendingMove
    ? STATUS_CONFIG.find(status => status.id === pendingMove.toStatus)
    : undefined;
  const pendingMoveSourceConfig = pendingMove
    ? STATUS_CONFIG.find(status => status.id === pendingMove.fromStatus)
    : undefined;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
            <AlertCircle size={18} />
          </div>
          <CardHeader className="pb-3 text-white/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Overdue</p>
            <CardTitle className="text-3xl font-semibold text-white">{totalCounts.overdue}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-white/80">
            <p className="text-sm">Tasks past their due date</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-amber-200 via-amber-300 to-orange-400 text-amber-950 shadow-lg">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/40 text-amber-900">
            <Clock size={18} />
          </div>
          <CardHeader className="pb-3 text-amber-950/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Due Soon</p>
            <CardTitle className="text-3xl font-semibold text-amber-950">{totalCounts.dueSoon}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-amber-900/80">
            <p className="text-sm">Due within the next 48 hours</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
            <Loader2 size={18} />
          </div>
          <CardHeader className="pb-3 text-white/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">In Progress</p>
            <CardTitle className="text-3xl font-semibold text-white">{columns.in_progress.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-white/80">
            <p className="text-sm">Active tasks currently underway</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
            <CheckCircle size={18} />
          </div>
          <CardHeader className="pb-3 text-white/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Completed (30d)</p>
            <CardTitle className="text-3xl font-semibold text-white">{columns.completed.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-white/80">
            <p className="text-sm">Delivered in the last month</p>
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
          <div className="mt-6 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/60 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Board overview</p>
                <p className="text-sm text-neutral-600">Drag tasks between stages to keep work on track.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 focus-visible:ring-green-600"
                  onClick={() => openCreateDialog("pending")}
                >
                  <Plus size={16} className="mr-2" />
                  New Task
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100"
                  onClick={() => setIsArchiveDrawerOpen(true)}
                >
                  <Archive size={16} className="mr-2" />
                  Archived tasks
                  {archivedTasks.length > 0 && (
                    <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                      {archivedTasks.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
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
                  onArchiveTask={requestArchiveTask}
                  onDeleteTask={requestDeleteTask}
                />
              ))}
            </div>
          </div>

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
            <DialogTitle>{dialogState.mode === "create" ? "Create Task" : "Task Details"}</DialogTitle>
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

      <Sheet open={isArchiveDrawerOpen} onOpenChange={setIsArchiveDrawerOpen}>
        <SheetContent side="right" className="w-full max-w-xl overflow-y-auto border-l border-neutral-200/70 bg-neutral-50/60 backdrop-blur">
          <SheetHeader>
            <SheetTitle>Archived tasks</SheetTitle>
            <SheetDescription>
              Archived tasks stay off the board but remain accessible. Restore them to continue work or delete them
              permanently.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 pb-8">
            {archivedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
                No archived tasks yet. Archive a task from the board to keep your workspace focused.
              </div>
            ) : (
              archivedTasks.map(task => {
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

                return (
                  <Card key={task.id} className="border border-neutral-200/80 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <p className="text-sm font-semibold text-neutral-800">{task.title}</p>
                          {task.description && (
                            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">{task.description}</p>
                          )}
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
                        </div>
                        <Badge className={cn("rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide", priorityColors.bgColor, priorityColors.textColor)}>
                          {task.priority === "high" ? "High" : task.priority === "low" ? "Low" : "Medium"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100"
                            disabled={
                              (restoreTaskMutation.isPending && restoreTargetId === String(task.id)) ||
                              archiveTaskMutation.isPending ||
                              deleteTaskMutation.isPending
                            }
                            onClick={() => handleRestoreTask(task)}
                          >
                            <ArchiveRestore size={14} className="mr-2" />
                            {restoreTaskMutation.isPending && restoreTargetId === String(task.id) ? "Restoring..." : "Restore"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          disabled={archiveTaskMutation.isPending || deleteTaskMutation.isPending}
                          onClick={() => requestDeleteTask(task)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

        <AlertDialog
          open={Boolean(pendingMove)}
          onOpenChange={open => {
            if (!open) {
              handleCancelPendingMove();
            }
          }}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingMoveTargetConfig
                  ? `Move task to ${pendingMoveTargetConfig.title}?`
                  : "Move task to new column?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {`Would you like to move ${
                  pendingMove?.taskTitle ? `“${pendingMove.taskTitle}”` : "this task"
                } to ${
                  pendingMoveTargetConfig
                    ? pendingMoveTargetConfig.title
                    : pendingMove?.toStatus.replace(/_/g, " ")
                }?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={event => {
                  event.preventDefault();
                  handleCancelPendingMove();
                }}
                disabled={updateTaskStatusMutation.isPending}
              >
                {pendingMoveSourceConfig ? `Keep in ${pendingMoveSourceConfig.title}` : "Keep current column"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={event => {
                  event.preventDefault();
                  handleConfirmPendingMove();
                }}
                disabled={updateTaskStatusMutation.isPending}
              >
                {updateTaskStatusMutation.isPending
                  ? "Moving..."
                  : `Move to ${
                      pendingMoveTargetConfig
                        ? pendingMoveTargetConfig.title
                        : pendingMove?.toStatus.replace(/_/g, " ")
                    }`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !archiveTaskMutation.isPending && !deleteTaskMutation.isPending) {
            setPendingAction(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete" ? "Delete task" : "Archive task"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete"
                ? (
                  <>
                    This will mark{" "}
                    <span className="font-medium text-neutral-700">
                      {pendingAction?.task?.title ? `“${pendingAction.task.title}”` : "this task"}
                    </span>{" "}
                    as deleted and remove it from all views. This action cannot be undone.
                  </>
                )
                : (
                  <>
                    <span className="font-medium text-neutral-700">
                      {pendingAction?.task?.title ? `“${pendingAction.task.title}”` : "This task"}
                    </span>{" "}
                    will be hidden from the board but kept in the archive drawer. You can restore it anytime.
                  </>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={archiveTaskMutation.isPending || deleteTaskMutation.isPending}
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
              disabled={archiveTaskMutation.isPending || deleteTaskMutation.isPending}
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
                ? isDeletePending
                  ? "Deleting..."
                  : "Delete task"
                : isArchivePending
                  ? "Archiving..."
                  : "Archive task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  activeTaskId: string | null;
  onArchiveTask: (task: any) => void;
  onDeleteTask: (task: any) => void;
}

function TaskBoardColumn({
  status,
  tasks,
  users,
  onAddTask,
  onTaskClick,
  isLoading,
  activeTaskId,
  onArchiveTask,
  onDeleteTask
}: TaskBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppableColumn(status.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/column flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        isOver && "border-green-200 ring-2 ring-green-500/40"
      )}
      data-column={status.id}
    >
      <div className="flex items-start justify-between gap-4 rounded-t-2xl border-b border-neutral-200/70 bg-white/95 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100">
            <status.icon size={18} className={status.accent} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-800">{status.title}</h3>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", status.badge)}>
                {tasks.length}
              </span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-neutral-500">{status.description}</p>
          </div>
        </div>
        {status.id !== "completed" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-neutral-200 bg-white text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100"
            onClick={onAddTask}
          >
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        )}
      </div>

      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3 p-5">
          {isLoading && tasks.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl bg-neutral-100/80" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-5 text-center text-sm text-neutral-500">
              {status.emptyMessage}
            </div>
            ) : (
              tasks.map(task => (
                <TaskBoardCard
                  key={task.id}
                  task={task}
                  users={users}
                  columnId={status.id}
                  onClick={() => {
                    const numericId = Number(task.id);
                    if (!Number.isNaN(numericId)) {
                      onTaskClick(numericId);
                    }
                  }}
                  isActiveDrag={activeTaskId != null && String(task.id) === activeTaskId}
                  onArchiveRequest={() => onArchiveTask(task)}
                  onDeleteRequest={() => onDeleteTask(task)}
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
  onArchiveRequest?: () => void;
  onDeleteRequest?: () => void;
}

function TaskBoardCard({
  task,
  users,
  columnId,
  onClick,
  isActiveDrag = false,
  isOverlay = false,
  onArchiveRequest,
  onDeleteRequest
}: TaskBoardCardProps) {
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
  const priorityAccent = {
    high: "before:bg-red-500/90",
    medium: "before:bg-amber-400/90",
    low: "before:bg-blue-500/80"
  } as const;
  const priorityAccentClass = priorityAccent[task.priority as keyof typeof priorityAccent] ?? "before:bg-neutral-200";
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

  const showActions = !isOverlay && (onArchiveRequest || onDeleteRequest);

  const content = (
    <Card
      className={cn(
        "group relative cursor-grab overflow-hidden rounded-xl border border-neutral-200/80 bg-white/95 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md before:absolute before:left-0 before:top-0 before:h-1 before:w-full before:bg-neutral-200 before:transition-colors",
        priorityAccentClass,
        (isDragging || isActiveDrag || isOverlay) && "border-green-300 bg-green-50/40 shadow-lg before:bg-green-500/70",
        columnId === "completed" && "border-green-200 bg-green-50/40 before:bg-green-500/70"
      )}
      style={style}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <GripVertical size={14} className="mt-1 text-neutral-300 opacity-0 transition group-hover:opacity-100" />
            <div className="min-w-0 space-y-1">
              <p className={cn("truncate text-sm font-semibold text-neutral-800", task.status === "completed" && "line-through text-neutral-400")}>
                {task.title}
              </p>
              {task.description && (
                <p className="line-clamp-2 text-xs text-neutral-500">{task.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide", priorityColors.bgColor, priorityColors.textColor)}>
              {task.priority === "high" ? "High" : task.priority === "low" ? "Low" : "Medium"}
            </Badge>
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-neutral-400 transition hover:text-neutral-700"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44" onClick={(event) => event.stopPropagation()}>
                  {onArchiveRequest && (
                    <DropdownMenuItem
                      onSelect={() => {
                        onArchiveRequest();
                      }}
                    >
                      <Archive size={14} className="mr-2" />
                      Archive task
                    </DropdownMenuItem>
                  )}
                  {onDeleteRequest && (
                    <DropdownMenuItem
                      className="text-red-600 focus:bg-red-50 focus:text-red-600"
                      onSelect={() => {
                        onDeleteRequest();
                      }}
                    >
                      <Trash2 size={14} className="mr-2" />
                      Delete task
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          <span className={cn("flex items-center gap-1 font-medium", dueToneClass)}>
            <Clock size={12} />
            {dueMeta.label}
          </span>
          <span className="flex min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[11px]">
                {user?.fullName?.slice(0, 2)?.toUpperCase() ?? "UN"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-neutral-600">
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
