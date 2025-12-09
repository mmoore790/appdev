import { useEffect, useMemo, useRef, useState } from "react";
import {
  Collision,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  UniqueIdentifier,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  DragOverlay,
  KeyboardSensor,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
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
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { TaskForm } from "./task-form";
import { apiRequest } from "../lib/queryClient";
import {
  cn,
  getDueDateMeta,
  getTaskPriorityColor,
  DueDateTone,
} from "../lib/utils";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "./ui/toggle-group";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { useToast } from "../hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type BoardStatus = "pending" | "in_progress" | "review" | "completed";
type TaskStatus = BoardStatus | "archived" | "deleted";
type BoardDensity = "comfortable" | "cozy" | "compact";
type FocusMode = "none" | "dueSoon" | "overdue";

const BOARD_ORDER_STORAGE_KEY = "taskBoard:columnOrder";
const BOARD_PREFS_STORAGE_KEY = "taskBoard:prefs";

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
  wipLimit?: number | null;
  wipHelper?: string;
}

const DEFAULT_COLLAPSED_STATE: Record<BoardStatus, boolean> = {
  pending: false,
  in_progress: false,
  review: false,
  completed: false,
};

const COLUMN_PADDING: Record<BoardDensity, string> = {
  comfortable: "p-5",
  cozy: "p-4",
  compact: "p-3.5",
};

const COLUMN_GAP: Record<BoardDensity, string> = {
  comfortable: "gap-3",
  cozy: "gap-2.5",
  compact: "gap-2",
};

const CARD_DENSITY_STYLES: Record<
  BoardDensity,
  { 
    padding: string; 
    gap: string; 
    metaText: string; 
    descriptionText: string;
    titleText: string;
    avatarSize: string;
    iconSize: number;
  }
> = {
  comfortable: {
    padding: "p-3.5",
    gap: "gap-2.5",
    metaText: "text-xs",
    descriptionText: "text-xs",
    titleText: "text-sm",
    avatarSize: "h-5 w-5",
    iconSize: 12,
  },
  cozy: {
    padding: "p-3",
    gap: "gap-2",
    metaText: "text-[11px]",
    descriptionText: "text-[11px]",
    titleText: "text-[13px]",
    avatarSize: "h-5 w-5",
    iconSize: 11,
  },
  compact: {
    padding: "p-2.5",
    gap: "gap-1.5",
    metaText: "text-[10px]",
    descriptionText: "text-[10px] line-clamp-1",
    titleText: "text-[12px]",
    avatarSize: "h-4 w-4",
    iconSize: 10,
  },
};

const STATUS_CONFIG: StatusConfig[] = [
  {
    id: "pending",
    title: "To Do",
    description: "",
    accent: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    emptyMessage: "",
    icon: AlertCircle,
    wipLimit: null,
  },
  {
    id: "in_progress",
    title: "In Progress",
    description: "",
    accent: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    emptyMessage: "",
    icon: Clock,
    wipLimit: 6,
    wipHelper: "",
  },
  {
    id: "review",
    title: "Review",
    description: "",
    accent: "text-purple-600",
    badge: "bg-purple-100 text-purple-700",
    emptyMessage: "",
    icon: ClipboardList,
    wipLimit: 4,
    wipHelper: "",
  },
  {
    id: "completed",
    title: "Completed",
    description: "",
    accent: "text-green-600",
    badge: "bg-green-100 text-green-700",
    emptyMessage: "Completed tasks will drop in here automatically.",
    icon: CheckCircle,
    wipLimit: null,
  },
];

const isBoardStatus = (value: string): value is BoardStatus =>
  STATUS_CONFIG.some((status) => status.id === value);

const DUE_TONE_CLASSES: Record<DueDateTone, string> = {
  muted: "text-neutral-500",
  warning: "text-amber-600",
  danger: "text-red-600",
  success: "text-green-600",
};

type ColumnState = Record<BoardStatus, any[]>;

interface DerivedBoardState {
  columns: ColumnState;
  archived: any[];
}

const PRIORITY_SORT = { high: 1, medium: 2, low: 3 } as const;

const BOARD_STATUS_VALUES: TaskStatus[] = [
  "pending",
  "in_progress",
  "review",
  "completed",
  "archived",
  "deleted",
];

const STATUS_ALIASES: Record<string, TaskStatus> = {
  todo: "pending",
  to_do: "pending",
  to_do_list: "pending",
  backlog: "pending",
  inprogress: "in_progress",
  "in-progress": "in_progress",
  in_progress: "in_progress",
  "in progress": "in_progress",
  reviewing: "review",
  under_review: "review",
  "under-review": "review",
  awaiting_review: "review",
  done: "completed",
  complete: "completed",
  finished: "completed",
};

const normalizeBoardStatus = (status: unknown): TaskStatus => {
  if (typeof status !== "string") {
    return "pending";
  }

  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if ((BOARD_STATUS_VALUES as string[]).includes(normalized)) {
    return normalized as TaskStatus;
  }

  if (STATUS_ALIASES[normalized]) {
    return STATUS_ALIASES[normalized];
  }

  return "pending";
};

const collisionDetectionStrategy: CollisionDetection = (args) => {
  const getDroppableData = (id: UniqueIdentifier) =>
    args.droppableContainers.find((container) => container.id === id)?.data
      ?.current;

  const getColumnCollisions = (collisions: Collision[]) =>
    collisions.filter(({ id }) => getDroppableData(id)?.type === "column");

  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  const rectangleCollisions = rectIntersection(args);
  if (rectangleCollisions.length > 0) {
    const columnCollisions = getColumnCollisions(rectangleCollisions);
    return columnCollisions.length > 0 ? columnCollisions : rectangleCollisions;
  }

  const cornerCollisions = closestCorners(args);
  if (cornerCollisions.length > 0) {
    const columnCollisions = getColumnCollisions(cornerCollisions);
    return columnCollisions.length > 0 ? columnCollisions : cornerCollisions;
  }

  return [];
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
    const scoreA =
      PRIORITY_SORT[a.priority as keyof typeof PRIORITY_SORT] ?? 99;
    const scoreB =
      PRIORITY_SORT[b.priority as keyof typeof PRIORITY_SORT] ?? 99;
    return scoreA - scoreB;
  });

const getComparableDate = (task: any) => {
  const sources = [
    task.updatedAt,
    task.completedAt,
    task.dueDate,
    task.createdAt,
  ];
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
    completed: [],
  };
  const archived: any[] = [];

  tasks.forEach((task) => {
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
    archived: sortArchivedTasks(archived),
  };
};

const BOARD_STATUSES: BoardStatus[] = [
  "pending",
  "in_progress",
  "review",
  "completed",
];

const createColumnOrder = (
  columns: ColumnState,
): Record<BoardStatus, string[]> =>
  BOARD_STATUSES.reduce(
    (acc, status) => ({
      ...acc,
      [status]: columns[status].map((task) => String(task.id)),
    }),
    {} as Record<BoardStatus, string[]>,
  );

const mergeColumnOrder = (
  previous: Record<BoardStatus, string[]>,
  columns: ColumnState,
): Record<BoardStatus, string[]> => {
  const nextOrder: Record<BoardStatus, string[]> = { ...previous };

  for (const status of BOARD_STATUSES) {
    const tasks = columns[status];
    const taskIds = tasks.map((task) => String(task.id));
    const existing = previous[status] ?? [];
    const filtered = existing.filter((id) => taskIds.includes(id));

    for (const id of taskIds) {
      if (!filtered.includes(id)) {
        filtered.push(id);
      }
    }

    nextOrder[status] = filtered;
  }

  return nextOrder;
};

const applyManualOrder = (
  columns: ColumnState,
  orderMap: Record<BoardStatus, string[]>,
): ColumnState => {
  const orderedColumns = {} as ColumnState;

  for (const status of BOARD_STATUSES) {
    const tasks = columns[status];
    const order = orderMap[status] ?? [];
    if (order.length === 0) {
      orderedColumns[status] = tasks;
      continue;
    }

    const lookup = new Map<string, any>();
    tasks.forEach((task) => lookup.set(String(task.id), task));

    const orderedTasks: any[] = [];

    order.forEach((id) => {
      const task = lookup.get(id);
      if (task) {
        orderedTasks.push(task);
        lookup.delete(id);
      }
    });

    if (lookup.size > 0) {
      const remaining = Array.from(lookup.values());
      const sortedRemaining = sortTasksForColumn(remaining);
      orderedColumns[status] = [...orderedTasks, ...sortedRemaining];
    } else {
      orderedColumns[status] = orderedTasks;
    }
  }

  return orderedColumns;
};

export function TaskBoard({
  tasks,
  users = [],
  isLoading = false,
}: TaskBoardProps) {
  const sanitizedTasks = useMemo(
    () => (Array.isArray(tasks) ? tasks : []),
    [tasks],
  );
  const derived = useMemo(
    () => deriveBoardState(sanitizedTasks),
    [sanitizedTasks],
  );

  const initialBoard = useMemo(() => {
    const parseStoredColumn = (value: unknown): BoardStatus | null => {
      if (typeof value !== "string") {
        return null;
      }
      const normalized = value
        .trim()
        .toLowerCase()
        .replace(/^column[-_]?/, "")
        .replace(/[\s-]+/g, "_");
      if (isBoardStatus(normalized)) {
        return normalized;
      }
      const alias = STATUS_ALIASES[normalized];
      if (alias && isBoardStatus(alias)) {
        return alias;
      }
      return null;
    };

    const baseColumns = derived.columns;
    const baseOrder = createColumnOrder(baseColumns);
    let storedOrder = baseOrder;

    if (typeof window !== "undefined") {
      try {
        const rawOrder = window.localStorage.getItem(BOARD_ORDER_STORAGE_KEY);
        if (rawOrder) {
          const parsedOrder = JSON.parse(rawOrder);
          if (parsedOrder && typeof parsedOrder === "object") {
            const sanitizedOrder: Record<BoardStatus, string[]> = {
              ...baseOrder,
            };
            for (const status of BOARD_STATUSES) {
              const candidate = (parsedOrder as Record<string, unknown>)[status];
              if (Array.isArray(candidate)) {
                sanitizedOrder[status] = candidate.map((value) =>
                  String(value),
                );
              }
            }
            storedOrder = mergeColumnOrder(sanitizedOrder, baseColumns);
          }
        }
      } catch {
        storedOrder = baseOrder;
      }
    }

    const orderedColumns = applyManualOrder(baseColumns, storedOrder);

    const collapsedMap = { ...DEFAULT_COLLAPSED_STATE };
    let storedDensity: BoardDensity | undefined;
    let storedFocus: FocusMode | undefined;

    if (typeof window !== "undefined") {
      try {
        const rawPrefs = window.localStorage.getItem(BOARD_PREFS_STORAGE_KEY);
        if (rawPrefs) {
          const parsedPrefs = JSON.parse(rawPrefs);
          if (parsedPrefs && typeof parsedPrefs === "object") {
            if (
              typeof parsedPrefs.density === "string" &&
              ["comfortable", "cozy", "compact"].includes(parsedPrefs.density)
            ) {
              storedDensity = parsedPrefs.density as BoardDensity;
            }
            if (
              typeof parsedPrefs.focusMode === "string" &&
              ["none", "dueSoon", "overdue"].includes(parsedPrefs.focusMode)
            ) {
              storedFocus = parsedPrefs.focusMode as FocusMode;
            }
            if (Array.isArray(parsedPrefs.collapsedColumns)) {
              parsedPrefs.collapsedColumns.forEach((value: unknown) => {
                const status = parseStoredColumn(value);
                if (status) {
                  collapsedMap[status] = true;
                }
              });
            }
          }
        }
      } catch {
        // ignore malformed stored preferences
      }
    }

    return {
      columns: orderedColumns,
      order: storedOrder,
      prefs: {
        density: storedDensity ?? "comfortable",
        focusMode: storedFocus ?? "none",
        collapsedMap,
      },
    };
  }, [derived]);

  const [columns, setColumns] = useState<ColumnState>(initialBoard.columns);
  const [archivedTasks, setArchivedTasks] = useState<any[]>(derived.archived);
  const [columnOrder, setColumnOrder] = useState<Record<BoardStatus, string[]>>(
    initialBoard.order,
  );
  const [viewDensity, setViewDensity] = useState<BoardDensity>(
    initialBoard.prefs.density,
  );
  const [focusMode, setFocusMode] = useState<FocusMode>(
    initialBoard.prefs.focusMode,
  );
  const [collapsedColumns, setCollapsedColumns] = useState<
    Record<BoardStatus, boolean>
  >(initialBoard.prefs.collapsedMap);
  const skipHydrationRef = useRef(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    taskId: string | null;
    originColumnId: BoardStatus | null;
    currentColumnId: BoardStatus | null;
  }>({
    taskId: null,
    originColumnId: null,
    currentColumnId: null,
  });
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    status?: BoardStatus;
    taskId?: number;
  }>({ isOpen: false, mode: "create", status: "pending" });
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "archive" | "delete";
    task: any;
  } | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [archiveAllPending, setArchiveAllPending] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false;
      return;
    }

    setArchivedTasks(derived.archived);

    setColumnOrder((previous) => {
      const merged = mergeColumnOrder(previous, derived.columns);
      setColumns(applyManualOrder(derived.columns, merged));
      return merged;
    });
  }, [derived]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        BOARD_ORDER_STORAGE_KEY,
        JSON.stringify(columnOrder),
      );
    } catch {
      // Ignore storage failures (e.g., Safari private mode).
    }
  }, [columnOrder]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const collapsedList = (
      Object.entries(collapsedColumns) as [BoardStatus, boolean][]
    )
      .filter(([, value]) => value)
      .map(([key]) => key);

    try {
      window.localStorage.setItem(
        BOARD_PREFS_STORAGE_KEY,
        JSON.stringify({
          density: viewDensity,
          focusMode,
          collapsedColumns: collapsedList,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [viewDensity, focusMode, collapsedColumns]);

  const toggleColumnCollapse = (status: BoardStatus) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  const handleDensityChange = (value: string) => {
    if (!value || !["comfortable", "cozy", "compact"].includes(value)) {
      setViewDensity("comfortable");
      return;
    }
    setViewDensity(value as BoardDensity);
  };

  const handleFocusModeChange = (value: string) => {
    if (!value || value === "none") {
      setFocusMode("none");
      return;
    }
    if (value === "dueSoon" || value === "overdue") {
      setFocusMode(value as FocusMode);
    }
  };

  const removeTaskFromColumns = (taskId: string | number) => {
    const idKey = String(taskId);
    setColumns((prev) => ({
      pending: prev.pending.filter((task) => String(task.id) !== idKey),
      in_progress: prev.in_progress.filter((task) => String(task.id) !== idKey),
      review: prev.review.filter((task) => String(task.id) !== idKey),
      completed: prev.completed.filter((task) => String(task.id) !== idKey),
    }));
    setColumnOrder((prev) => ({
      pending: prev.pending.filter((id) => id !== idKey),
      in_progress: prev.in_progress.filter((id) => id !== idKey),
      review: prev.review.filter((id) => id !== idKey),
      completed: prev.completed.filter((id) => id !== idKey),
    }));
  };

  const addTaskToColumn = (task: any, status: BoardStatus) => {
    setColumns((prev) => {
      const updatedColumn = sortTasksForColumn([...prev[status], task]);
      const nextColumns = {
        ...prev,
        [status]: updatedColumn,
      };
      setColumnOrder((previousOrder) => ({
        ...previousOrder,
        [status]: updatedColumn.map((item) => String(item.id)),
      }));
      return nextColumns;
    });
  };

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }
    const fromTasks = sanitizedTasks.find(
      (task) => String(task.id) === activeTaskId,
    );
    if (fromTasks) {
      return fromTasks;
    }
    for (const columnTasks of Object.values(columns)) {
      const match = columnTasks.find(
        (task) => String(task.id) === activeTaskId,
      );
      if (match) {
        return match;
      }
    }
    return null;
  }, [activeTaskId, sanitizedTasks, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: UpdateTaskStatusVariables) => {
      console.log("📡 mutationFn calling apiRequest", { taskId, newStatus });
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: newStatus });
    },
    onMutate: async ({
      taskId,
      newStatus,
      previousStatus,
    }: UpdateTaskStatusVariables) => {
      if (previousStatus && previousStatus !== newStatus) {
        skipHydrationRef.current = true;
      }

      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previousTasks = queryClient.getQueryData<any[]>(["/api/tasks"]);

      queryClient.setQueryData<any[]>(["/api/tasks"], (current) => {
        if (!Array.isArray(current)) {
          return current;
        }
        const idKey = String(taskId);
        return current.map((task) =>
          String(task.id) === idKey ? { ...task, status: newStatus } : task,
        );
      });

      return { previousTasks };
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Task updated",
        description: `Moved to ${STATUS_CONFIG.find((status) => status.id === variables.newStatus)?.title ?? "new column"}.`,
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }

      skipHydrationRef.current = true;
      const fallbackTasks = Array.isArray(context?.previousTasks)
        ? context.previousTasks
        : sanitizedTasks;
      const { columns: resetColumns, archived: resetArchived } =
        deriveBoardState(fallbackTasks);
      setColumns(resetColumns);
      setArchivedTasks(resetArchived);

      toast({
        title: "Update failed",
        description: "We couldn't update that task. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks?pendingOnly=true"],
      });
    },
  });
  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status: "archived" });
    },
    onSuccess: (updatedTask: any) => {
      removeTaskFromColumns(updatedTask.id);
      const updatedIdKey = String(updatedTask.id);
      setArchivedTasks((prev) =>
        sortArchivedTasks([
          ...prev.filter((task) => String(task.id) !== updatedIdKey),
          updatedTask,
        ]),
      );
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
    onSuccess: (updatedTask: any) => {
      removeTaskFromColumns(updatedTask.id);
      const updatedIdKey = String(updatedTask.id);
      setArchivedTasks((prev) =>
        prev.filter((task) => String(task.id) !== updatedIdKey),
      );
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

  const restoreTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: {
      taskId: number;
      status: BoardStatus;
    }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: (updatedTask: any, variables) => {
      removeTaskFromColumns(updatedTask.id);
      const updatedIdKey = String(updatedTask.id);
      setArchivedTasks((prev) =>
        prev.filter((task) => String(task.id) !== updatedIdKey),
      );
      addTaskToColumn(updatedTask, variables.status);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks?pendingOnly=true"],
      });
      toast({
        title: "Task restored",
        description: `Returned to ${STATUS_CONFIG.find((status) => status.id === variables.status)?.title ?? "the board"}.`,
      });
    },
    onError: () => {
      toast({
        title: "Restore failed",
        description:
          "We couldn't restore that task right now. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRestoreTargetId(null);
    },
  });

  const parseBoardStatus = (value: unknown): BoardStatus | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^column[-_]?/, "")
      .replace(/[\s-]+/g, "_");
    if (isBoardStatus(normalized)) {
      return normalized as BoardStatus;
    }
    const alias = STATUS_ALIASES[normalized];
    if (alias && isBoardStatus(alias)) {
      return alias as BoardStatus;
    }
    return undefined;
  };

  const resolveColumnId = (
    entry: DragOverEvent["over"] | DragEndEvent["over"],
  ): BoardStatus | undefined => {
    if (!entry) {
      return undefined;
    }
    const dataColumn = parseBoardStatus(entry.data?.current?.columnId);
    if (dataColumn) {
      return dataColumn;
    }
    if (typeof entry.id === "string") {
      return parseBoardStatus(entry.id);
    }
    return undefined;
  };

  const openCreateDialog = (status: BoardStatus) => {
    setDialogState({ isOpen: true, mode: "create", status });
  };

  const openEditDialog = (taskId: number) => {
    setDialogState({ isOpen: true, mode: "edit", taskId });
  };

  const requestArchiveTask = (task: any) =>
    setPendingAction({ type: "archive", task });
  const requestDeleteTask = (task: any) =>
    setPendingAction({ type: "delete", task });

  const archiveAllCompletedMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      // Archive all tasks in parallel using allSettled to handle partial failures
      const promises = taskIds.map((taskId) =>
        apiRequest("PUT", `/api/tasks/${taskId}`, { status: "archived" })
          .catch((error) => {
            console.error(`Failed to archive task ${taskId}:`, error);
            return { id: taskId, error: error.message || "Unknown error" };
          })
      );
      const results = await Promise.allSettled(promises);
      
      // Separate successful and failed results
      const successful: any[] = [];
      const failed: Array<{ id: number; error: string }> = [];
      
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const value = result.value as any;
          if (value && typeof value === "object" && "error" in value) {
            // This is a failed task (caught in the catch block)
            failed.push({ id: taskIds[index], error: value.error || "Unknown error" });
          } else if (value && typeof value === "object" && "id" in value) {
            // This is a successful task
            successful.push(value);
          }
        } else {
          const reason = result.reason as any;
          failed.push({ id: taskIds[index], error: reason?.message || "Unknown error" });
        }
      });
      
      return { successful, failed };
    },
    onSuccess: ({ successful, failed }) => {
      // Remove all successfully archived tasks from columns
      successful.forEach((task) => {
        removeTaskFromColumns(task.id);
      });
      
      // Update archived tasks list
      setArchivedTasks((prev) =>
        sortArchivedTasks([
          ...prev.filter(
            (task) => !successful.some((t) => String(t.id) === String(task.id))
          ),
          ...successful,
        ])
      );
      
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/tasks?pendingOnly=true"],
      });
      
      if (failed.length > 0) {
        toast({
          title: "Partial archive success",
          description: `Successfully archived ${successful.length} task${successful.length === 1 ? "" : "s"}. ${failed.length} task${failed.length === 1 ? "" : "s"} could not be archived.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Tasks archived",
          description: `Successfully archived ${successful.length} task${successful.length === 1 ? "" : "s"}.`,
        });
      }
      setArchiveAllPending(false);
    },
    onError: (error: any) => {
      toast({
        title: "Archive failed",
        description: error?.message || "We couldn't archive all tasks right now. Please try again.",
        variant: "destructive",
      });
      setArchiveAllPending(false);
    },
  });

  const handleArchiveAllCompleted = () => {
    const completedTasks = columns.completed;
    if (completedTasks.length === 0) {
      toast({
        title: "No tasks to archive",
        description: "There are no completed tasks to archive.",
        variant: "destructive",
      });
      return;
    }
    // Show confirmation dialog
    setPendingAction({ 
      type: "archive", 
      task: { id: "all", title: `all ${completedTasks.length} completed task${completedTasks.length === 1 ? "" : "s"}` } 
    });
  };

  const confirmArchiveAll = () => {
    const completedTasks = columns.completed;
    if (completedTasks.length === 0) {
      setPendingAction(null);
      return;
    }
    setArchiveAllPending(true);
    setPendingAction(null);
    const taskIds = completedTasks
      .map((task) => Number(task.id))
      .filter((id) => !Number.isNaN(id));
    archiveAllCompletedMutation.mutate(taskIds);
  };

  const handleRestoreTask = (task: any) => {
    const idKey = String(task.id);
    setRestoreTargetId(idKey);
    const numericId = Number(task.id);
    if (Number.isNaN(numericId)) {
      toast({
        title: "Unable to restore task",
        description: "Task identifier is invalid.",
        variant: "destructive",
      });
      return;
    }
    restoreTaskMutation.mutate({ taskId: numericId, status: "pending" });
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log("⤴️ handleDragStart", {
      id: event?.active?.id,
      activeData: event?.active?.data?.current,
    });
    if (event.active?.id == null) {
      setActiveTaskId(null);
      dragStateRef.current = {
        taskId: null,
        originColumnId: null,
        currentColumnId: null,
      };
      return;
    }

    const columnId =
      parseBoardStatus(event.active?.data?.current?.columnId) ?? null;
    const activeId = String(event.active.id);

    dragStateRef.current = {
      taskId: activeId,
      originColumnId: columnId,
      currentColumnId: columnId,
    };

    setActiveTaskId(activeId);
  };

  const handleDragOver = (event: DragOverEvent) => {
    console.log("↔️ handleDragOver", {
      activeId: event.active?.id,
      overId: event.over?.id,
      overData: event.over?.data?.current,
    });

    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const dragState = dragStateRef.current;

    if (dragState.taskId && dragState.taskId !== activeId) {
      dragStateRef.current.taskId = activeId;
    }

    const activeColumnId =
      dragState.currentColumnId ??
      parseBoardStatus(active.data?.current?.columnId) ??
      undefined;
    const overColumnId = resolveColumnId(over);

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) {
      return;
    }

    setColumns((prev) => {
      const sourceTasks = prev[activeColumnId] ?? [];
      const targetTasks = prev[overColumnId] ?? [];
      const sourceIndex = sourceTasks.findIndex(
        (task) => String(task.id) === activeId,
      );

      if (sourceIndex === -1) {
        return prev;
      }

      const updatedSource = [...sourceTasks];
      const [movedTask] = updatedSource.splice(sourceIndex, 1);

      const updatedTarget = [...targetTasks];
      const existingIndex = updatedTarget.findIndex(
        (task) => String(task.id) === activeId,
      );
      if (existingIndex !== -1) {
        updatedTarget.splice(existingIndex, 1);
      }

      const overId = over.id != null ? String(over.id) : null;
      const targetIndex =
        overId != null
          ? updatedTarget.findIndex((task) => String(task.id) === overId)
          : -1;
      const insertIndex = targetIndex >= 0 ? targetIndex : updatedTarget.length;

      updatedTarget.splice(insertIndex, 0, {
        ...movedTask,
        status: overColumnId,
      });

      const nextColumns = {
        ...prev,
        [activeColumnId]: updatedSource,
        [overColumnId]: updatedTarget,
      };
      setColumnOrder((previousOrder) => ({
        ...previousOrder,
        [activeColumnId]: updatedSource.map((task) => String(task.id)),
        [overColumnId]: updatedTarget.map((task) => String(task.id)),
      }));
      return nextColumns;
    });

    dragStateRef.current = {
      ...dragStateRef.current,
      currentColumnId: overColumnId,
    };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!active?.id) {
      dragStateRef.current = {
        taskId: null,
        originColumnId: null,
        currentColumnId: null,
      };
      return;
    }

    console.log("🧩 active data", active.data.current);
    console.log("🧩 over data", over?.data?.current ?? null);

    console.log("⬇️ handleDragEnd", {
      activeId: active.id,
      overId: over?.id,
      activeData: active.data.current,
      overData: over?.data?.current,
    });

    if (!over) {
      setActiveTaskId(null);
      dragStateRef.current = {
        taskId: null,
        originColumnId: null,
        currentColumnId: null,
      };
      const { columns: resetColumns, archived: resetArchived } =
        deriveBoardState(sanitizedTasks);
      setColumns(applyManualOrder(resetColumns, columnOrder));
      setArchivedTasks(resetArchived);
      return;
    }

    const activeId = String(active.id);
    const originColumnId =
      dragStateRef.current.originColumnId ??
      parseBoardStatus(active.data?.current?.columnId);
    const destinationColumnId = resolveColumnId(over);

    if (!originColumnId || !destinationColumnId) {
      setActiveTaskId(null);
      dragStateRef.current = {
        taskId: null,
        originColumnId: null,
        currentColumnId: null,
      };
      return;
    }

    console.log(
      "🎯 activeColumnId:",
      originColumnId,
      "→ overColumnId:",
      destinationColumnId,
    );

    if (originColumnId === destinationColumnId) {
      setColumns((prev) => {
        const columnTasks = prev[destinationColumnId] ?? [];
        const activeIndex = columnTasks.findIndex(
          (task) => String(task.id) === activeId,
        );
        if (activeIndex === -1) {
          return prev;
        }

        let targetIndex = -1;
        if (over?.data?.current?.type === "task") {
          const overId = String(over.id);
          targetIndex = columnTasks.findIndex(
            (task) => String(task.id) === overId,
          );
        } else {
          targetIndex = columnTasks.length - 1;
        }

        if (targetIndex < 0) {
          targetIndex = columnTasks.length - 1;
        }

        if (targetIndex === activeIndex) {
          return prev;
        }

        const reorderedColumn = arrayMove(
          columnTasks,
          activeIndex,
          targetIndex,
        );
        const nextColumns = {
          ...prev,
          [destinationColumnId]: reorderedColumn,
        };
        setColumnOrder((previousOrder) => ({
          ...previousOrder,
          [destinationColumnId]: reorderedColumn.map((task) => String(task.id)),
        }));
        return nextColumns;
      });

      setActiveTaskId(null);
      dragStateRef.current = {
        taskId: null,
        originColumnId: null,
        currentColumnId: null,
      };
      return;
    }

    const numericTaskId = Number(activeId);
    if (Number.isNaN(numericTaskId)) {
      toast({
        title: "Unable to update task",
        description: "Invalid task identifier.",
        variant: "destructive",
      });
      setActiveTaskId(null);
      dragStateRef.current = {
        taskId: null,
        originColumnId: null,
        currentColumnId: null,
      };
      return;
    }

    console.log(
      "🚚 Moving task",
      numericTaskId,
      "from",
      originColumnId,
      "to",
      destinationColumnId,
    );

    let mutationPayload: UpdateTaskStatusVariables | null = null;

    setColumns((prev) => {
      const sourceTasks = prev[originColumnId] ?? [];
      const destinationTasks = prev[destinationColumnId] ?? [];

      const updatedSource = [...sourceTasks];
      const updatedDestination = [...destinationTasks];

      let movedTask: any | undefined;
      const sourceIndex = updatedSource.findIndex(
        (task) => String(task.id) === activeId,
      );

      if (sourceIndex !== -1) {
        movedTask = updatedSource.splice(sourceIndex, 1)[0];
      } else {
        const existingIndex = updatedDestination.findIndex(
          (task) => String(task.id) === activeId,
        );
        if (existingIndex !== -1) {
          movedTask = updatedDestination.splice(existingIndex, 1)[0];
        }
      }

      if (!movedTask) {
        return prev;
      }

      const overId = over.id != null ? String(over.id) : null;
      let insertIndex =
        over?.data?.current?.type === "task" && overId
          ? updatedDestination.findIndex((task) => String(task.id) === overId)
          : -1;

      if (insertIndex < 0) {
        insertIndex = updatedDestination.length;
      }

      updatedDestination.splice(insertIndex, 0, {
        ...movedTask,
        status: destinationColumnId,
      });

      mutationPayload = {
        taskId: numericTaskId,
        newStatus: destinationColumnId,
        previousStatus: originColumnId,
      };

      const nextColumns = {
        ...prev,
        [originColumnId]: updatedSource,
        [destinationColumnId]: updatedDestination,
      };
      setColumnOrder((previousOrder) => ({
        ...previousOrder,
        [originColumnId]: updatedSource.map((task) => String(task.id)),
        [destinationColumnId]: updatedDestination.map((task) =>
          String(task.id),
        ),
      }));
      return nextColumns;
    });

    if (mutationPayload) {
      console.log("📡 Updating server:", mutationPayload);
      skipHydrationRef.current = true;
      updateTaskStatusMutation.mutate(mutationPayload);
    }

    setActiveTaskId(null);
    dragStateRef.current = {
      taskId: null,
      originColumnId: null,
      currentColumnId: null,
    };
  };

  const filteredForMetrics = useMemo(
    () =>
      sanitizedTasks.reduce((acc, task) => {
        const normalizedStatus = normalizeBoardStatus(task?.status);

        if (normalizedStatus === "archived" || normalizedStatus === "deleted") {
          return acc;
        }

        if (normalizedStatus !== task?.status) {
          acc.push({ ...task, status: normalizedStatus });
        } else {
          acc.push(task);
        }

        return acc;
      }, [] as any[]),
    [sanitizedTasks],
  );

  const totalCounts = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueTasks = filteredForMetrics.filter(
      (task) => getDueDateMeta(task.dueDate).tone === "danger",
    );
    const dueSoonTasks = filteredForMetrics.filter((task) => {
      const meta = getDueDateMeta(task.dueDate);
      return (
        task.status !== "completed" &&
        meta.tone === "warning" &&
        meta.daysUntil !== null &&
        meta.daysUntil <= 2
      );
    });

    const completedLast30Days = sanitizedTasks.reduce((count, task) => {
      const normalizedStatus = normalizeBoardStatus(task?.status);

      if (normalizedStatus === "deleted") {
        return count;
      }

      if (!task?.completedAt) {
        return count;
      }

      const completedAtDate = new Date(task.completedAt);
      if (Number.isNaN(completedAtDate.getTime())) {
        return count;
      }

      return completedAtDate >= thirtyDaysAgo ? count + 1 : count;
    }, 0);

    return {
      overdue: overdueTasks.length,
      dueSoon: dueSoonTasks.length,
      completedLast30Days,
    };
  }, [filteredForMetrics, sanitizedTasks]);

  const focusDescriptor = useMemo(() => {
    if (focusMode === "overdue") {
      return "Focus mode: spotlighting overdue work";
    }
    if (focusMode === "dueSoon") {
      return "Focus mode: highlighting deadlines within 48 hours";
    }
    return null;
  }, [focusMode]);

  const isArchivePending =
    pendingAction?.type === "archive" && archiveTaskMutation.isPending;
  const isDeletePending =
    pendingAction?.type === "delete" && deleteTaskMutation.isPending;

  return (
    <TooltipProvider delayDuration={120}>
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
              <Loader2 size={18} />
            </div>
            <CardHeader className="pb-3 text-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                In Progress
              </p>
              <CardTitle className="text-3xl font-semibold text-white">
                {columns.in_progress.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-white/80">
              <p className="text-sm">Active tasks currently underway</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-amber-200 via-amber-300 to-orange-400 text-amber-950 shadow-lg">
            <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/40 text-amber-900">
              <Clock size={18} />
            </div>
            <CardHeader className="pb-3 text-amber-950/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                Due Soon
              </p>
              <CardTitle className="text-3xl font-semibold text-amber-950">
                {totalCounts.dueSoon}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-amber-900/80">
              <p className="text-sm">Due within the next 48 hours</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg">
            <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
              <AlertCircle size={18} />
            </div>
            <CardHeader className="pb-3 text-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Overdue
              </p>
              <CardTitle className="text-3xl font-semibold text-white">
                {totalCounts.overdue}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-white/80">
              <p className="text-sm">Tasks past their due date</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden cursor-default select-none border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
            <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
              <CheckCircle size={18} />
            </div>
            <CardHeader className="pb-3 text-white/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Completed (30d)
              </p>
              <CardTitle className="text-3xl font-semibold text-white">
                {totalCounts.completedLast30Days}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-white/80">
              <p className="text-sm">
                Delivered in the last month, including archived tasks
              </p>
            </CardContent>
          </Card>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          <div className="mt-6 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-neutral-200/60 px-4 py-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Board overview
                </p>
                <p className="text-sm text-neutral-600">
                  Drag tasks between stages to keep work on track.
                </p>
                {focusDescriptor && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    {focusDescriptor}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={focusMode}
                    onValueChange={handleFocusModeChange}
                    className="flex rounded-full border border-neutral-200 bg-white p-0.5 text-xs shadow-sm"
                  >
                    <ToggleGroupItem
                      value="none"
                      className="rounded-full px-3 py-1 font-medium text-neutral-500 transition data-[state=on]:bg-neutral-900 data-[state=on]:text-white"
                    >
                      All
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="dueSoon"
                      className="flex items-center gap-1 rounded-full px-3 py-1 font-medium text-neutral-500 transition data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700"
                    >
                      <Clock size={12} />
                      48h
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="overdue"
                      className="flex items-center gap-1 rounded-full px-3 py-1 font-medium text-neutral-500 transition data-[state=on]:bg-red-100 data-[state=on]:text-red-700"
                    >
                      <AlertCircle size={12} />
                      Overdue
                    </ToggleGroupItem>
                  </ToggleGroup>
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
                    className="rounded-full border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-100"
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
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
              {STATUS_CONFIG.map((status) => (
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
                  onArchiveAll={status.id === "completed" ? handleArchiveAllCompleted : undefined}
                  density={viewDensity}
                  focusMode={focusMode}
                  isCollapsed={collapsedColumns[status.id]}
                  onToggleCollapse={() => toggleColumnCollapse(status.id)}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeTask ? (
              <TaskBoardCard
                task={activeTask}
                users={users}
                columnId={activeTask.status}
                isOverlay
                density={viewDensity}
                focusMode={focusMode}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

      <Dialog
        open={dialogState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState((prev) => ({
              ...prev,
              isOpen: false,
              taskId: undefined,
            }));
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
                setDialogState((prev) => ({
                  ...prev,
                  isOpen: false,
                  taskId: undefined,
                }));
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              }}
            />
          ) : dialogState.mode === "edit" && dialogState.taskId ? (
            <TaskForm
              taskId={dialogState.taskId}
              editMode
              onComplete={() => {
                setDialogState((prev) => ({
                  ...prev,
                  isOpen: false,
                  taskId: undefined,
                }));
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={isArchiveDrawerOpen} onOpenChange={setIsArchiveDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-xl overflow-y-auto border-l border-neutral-200/70 bg-neutral-50/60 backdrop-blur"
        >
          <SheetHeader>
            <SheetTitle>Archived tasks</SheetTitle>
            <SheetDescription>
              Archived tasks stay off the board but remain accessible. Restore
              them to continue work or delete them permanently.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 pb-8">
            {archivedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
                No archived tasks yet. Archive a task from the board to keep
                your workspace focused.
              </div>
            ) : (
              archivedTasks.map((task) => {
                const dueMeta = getDueDateMeta(task.dueDate);
                const dueToneClass =
                  DUE_TONE_CLASSES[dueMeta.tone] ?? DUE_TONE_CLASSES.muted;
                const priorityColors = getTaskPriorityColor(task.priority);
                const assigneeId =
                  task.assignedTo === "unassigned" ||
                  task.assignedTo === null ||
                  task.assignedTo === undefined
                    ? null
                    : typeof task.assignedTo === "string"
                      ? parseInt(task.assignedTo, 10)
                      : task.assignedTo;
                const user =
                  typeof assigneeId === "number" && !Number.isNaN(assigneeId)
                    ? users.find((u) => u.id === assigneeId)
                    : undefined;

                return (
                  <Card
                    key={task.id}
                    className="border border-neutral-200/80 bg-white shadow-sm"
                  >
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <p className="text-sm font-semibold text-neutral-800">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                            <span
                              className={cn(
                                "flex items-center gap-1 font-medium",
                                dueToneClass,
                              )}
                            >
                              <Clock size={12} />
                              {dueMeta.label}
                            </span>
                            <span className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[11px]">
                                  {user?.fullName?.slice(0, 2)?.toUpperCase() ??
                                    "UN"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-neutral-600">
                                {user?.fullName ||
                                  user?.username ||
                                  "Unassigned"}
                              </span>
                            </span>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide",
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
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100"
                          disabled={
                            (restoreTaskMutation.isPending &&
                              restoreTargetId === String(task.id)) ||
                            archiveTaskMutation.isPending ||
                            deleteTaskMutation.isPending
                          }
                          onClick={() => handleRestoreTask(task)}
                        >
                          <ArchiveRestore size={14} className="mr-2" />
                          {restoreTaskMutation.isPending &&
                          restoreTargetId === String(task.id)
                            ? "Restoring..."
                            : "Restore"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          disabled={
                            archiveTaskMutation.isPending ||
                            deleteTaskMutation.isPending
                          }
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
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (
            !open &&
            !archiveTaskMutation.isPending &&
            !deleteTaskMutation.isPending &&
            !archiveAllCompletedMutation.isPending
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
                : pendingAction?.task?.id === "all"
                  ? "Archive all completed tasks"
                  : "Archive task"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete" ? (
                <>
                  This will mark{" "}
                  <span className="font-medium text-neutral-700">
                    {pendingAction?.task?.title
                      ? `“${pendingAction.task.title}”`
                      : "this task"}
                  </span>{" "}
                  as deleted and remove it from all views. This action cannot be
                  undone.
                </>
              ) : (
                <>
                  <span className="font-medium text-neutral-700">
                    {pendingAction?.task?.title
                      ? `“${pendingAction.task.title}”`
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
                deleteTaskMutation.isPending ||
                archiveAllCompletedMutation.isPending
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
                deleteTaskMutation.isPending ||
                archiveAllCompletedMutation.isPending
              }
              onClick={() => {
                if (!pendingAction) return;
                if (pendingAction.type === "archive") {
                  if (pendingAction.task.id === "all") {
                    confirmArchiveAll();
                  } else {
                    archiveTaskMutation.mutate(pendingAction.task.id);
                  }
                } else {
                  deleteTaskMutation.mutate(pendingAction.task.id);
                }
              }}
            >
              {pendingAction?.type === "delete"
                ? isDeletePending
                  ? "Deleting..."
                  : "Delete task"
                : pendingAction?.task?.id === "all"
                  ? archiveAllCompletedMutation.isPending
                    ? "Archiving..."
                    : "Archive all"
                  : isArchivePending
                    ? "Archiving..."
                    : "Archive task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
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
  onArchiveAll?: () => void;
  density: BoardDensity;
  focusMode: FocusMode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  onDeleteTask,
  onArchiveAll,
  density,
  focusMode,
  isCollapsed,
  onToggleCollapse,
}: TaskBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppableColumn(status.id);
  const columnPadding = COLUMN_PADDING[density];
  const columnGap = COLUMN_GAP[density];

  const priorityBreakdown = useMemo(() => {
    const breakdown: Record<"high" | "medium" | "low", number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    tasks.forEach((task) => {
      const priority =
        typeof task.priority === "string"
          ? task.priority.toLowerCase()
          : "medium";
      if (priority === "high") {
        breakdown.high += 1;
      } else if (priority === "low") {
        breakdown.low += 1;
      } else {
        breakdown.medium += 1;
      }
    });
    return breakdown;
  }, [tasks]);

  const dueSummary = useMemo(() => {
    const summary = { overdue: 0, dueSoon: 0 };
    tasks.forEach((task) => {
      const meta = getDueDateMeta(task.dueDate);
      if (meta.tone === "danger") {
        summary.overdue += 1;
      } else if (
        meta.tone === "warning" &&
        meta.daysUntil !== null &&
        meta.daysUntil <= 2
      ) {
        summary.dueSoon += 1;
      }
    });
    return summary;
  }, [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/column flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        isOver && "border-green-200 ring-2 ring-green-500/40",
        isCollapsed && "bg-neutral-50",
      )}
      data-column={status.id}
    >
      <div className="rounded-t-2xl bg-white/95 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1 overflow-hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 flex-shrink-0">
              <status.icon size={18} className={status.accent} />
            </div>
            <div className="space-y-2 min-w-0 flex-1 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-800 truncate">
                  {status.title}
                </h3>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold transition flex-shrink-0",
                    status.badge,
                  )}
                >
                </span>
              </div>
              <p className="text-xs leading-relaxed text-neutral-500 line-clamp-2">
                {status.description}
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-neutral-400 transition hover:text-neutral-700 flex-shrink-0"
                onClick={onToggleCollapse}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isCollapsed ? "Expand column" : "Collapse column"}
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Action buttons below header */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-200">
          {status.id === "completed" && onArchiveAll && tasks.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 whitespace-nowrap rounded-full border-neutral-200 bg-white text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
                  onClick={onArchiveAll}
                >
                  <Archive size={14} className="mr-1" />
                  Archive All
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Archive all {tasks.length} completed task{tasks.length === 1 ? "" : "s"}
              </TooltipContent>
            </Tooltip>
          )}
          {status.id !== "completed" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-neutral-200 bg-white text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
              onClick={onAddTask}
            >
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      <SortableContext
        items={tasks.map((task) => String(task.id))}
        strategy={verticalListSortingStrategy}
      >
        {isCollapsed ? (
          <div className={cn("flex flex-1 flex-col justify-center", columnPadding)}>
            <div className="flex min-h-[140px] flex-col justify-between rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-4 text-xs text-neutral-500">
              {tasks.length === 0 ? (
                <p>{status.emptyMessage}</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Snapshot
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["high", "medium", "low"] as const).map((priority) =>
                        priorityBreakdown[priority] > 0 ? (
                          <span
                            key={priority}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              priority === "high"
                                ? "bg-red-100 text-red-600"
                                : priority === "medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-600",
                            )}
                          >
                            {priorityBreakdown[priority]} {priority}
                          </span>
                        ) : null,
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle size={12} />
                        {dueSummary.overdue} overdue
                      </span>
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock size={12} />
                        {dueSummary.dueSoon} due soon
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Expand to view {tasks.length} task
                    {tasks.length === 1 ? "" : "s"}.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col",
              columnPadding,
              columnGap,
              tasks.length > 10 
                ? "overflow-y-auto h-[70vh] flex-shrink-0" 
                : "flex-1",
            )}
          >
            {isLoading && tasks.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className={cn(
                      "h-24 rounded-xl bg-neutral-100/80",
                      density === "compact" && "h-20",
                    )}
                  />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-5 text-center text-sm text-neutral-500">
                {status.emptyMessage}
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex-shrink-0">
                  <TaskBoardCard
                    task={task}
                    users={users}
                    columnId={status.id}
                    onClick={() => {
                      const numericId = Number(task.id);
                      if (!Number.isNaN(numericId)) {
                        onTaskClick(numericId);
                      }
                    }}
                    isActiveDrag={
                      activeTaskId != null && String(task.id) === activeTaskId
                    }
                    onArchiveRequest={() => onArchiveTask(task)}
                    onDeleteRequest={() => onDeleteTask(task)}
                    density={density}
                    focusMode={focusMode}
                  />
                </div>
              ))
            )}
          </div>
        )}
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
  density: BoardDensity;
  focusMode: FocusMode;
}

function TaskBoardCard({
  task,
  users,
  columnId,
  onClick,
  isActiveDrag = false,
  isOverlay = false,
  onArchiveRequest,
  onDeleteRequest,
  density,
  focusMode,
}: TaskBoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(task.id),
    data: {
      // ✅ always reflect real current status
      columnId: task.status,
      type: "task",
    },
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : {};
  const densityStyles = CARD_DENSITY_STYLES[density];

  const dueMeta = getDueDateMeta(task.dueDate);
  const dueToneClass = DUE_TONE_CLASSES[dueMeta.tone] ?? DUE_TONE_CLASSES.muted;
  const priorityAccent = {
    high: "before:bg-red-500/90",
    medium: "before:bg-amber-400/90",
    low: "before:bg-blue-500/80",
  } as const;
  const priorityAccentClass =
    priorityAccent[task.priority as keyof typeof priorityAccent] ??
    "before:bg-neutral-200";
  const isDueSoonTarget =
    dueMeta.tone === "danger" ||
    (dueMeta.tone === "warning" &&
      dueMeta.daysUntil !== null &&
      dueMeta.daysUntil <= 2);
  const shouldDim =
    !isOverlay &&
    ((focusMode === "overdue" && dueMeta.tone !== "danger") ||
      (focusMode === "dueSoon" && !isDueSoonTarget));
  const assigneeId =
    task.assignedTo === "unassigned" ||
    task.assignedTo === null ||
    task.assignedTo === undefined
      ? null
      : typeof task.assignedTo === "string"
        ? parseInt(task.assignedTo, 10)
        : task.assignedTo;
  const user =
    typeof assigneeId === "number" && !Number.isNaN(assigneeId)
      ? users.find((u) => u.id === assigneeId)
      : undefined;

  const showActions = !isOverlay && (onArchiveRequest || onDeleteRequest);

  const content = (
    <Card
      className={cn(
        "group relative cursor-grab overflow-hidden border border-neutral-200/80 bg-white/95 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md before:absolute before:left-0 before:top-0 before:h-0.5 before:w-full before:bg-neutral-200 before:transition-colors",
        density === "compact" ? "rounded-lg" : "rounded-xl",
        priorityAccentClass,
        (isDragging || isActiveDrag || isOverlay) &&
          "border-green-300 bg-green-50/40 shadow-lg before:bg-green-500/70",
        columnId === "completed" &&
          "border-green-200 bg-green-50/40 before:bg-green-500/70",
        shouldDim && "opacity-60 saturate-75",
      )}
      style={style}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <CardContent
        className={cn("flex flex-col", densityStyles.gap, densityStyles.padding)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <GripVertical
              size={12}
              className="mt-0.5 text-neutral-300 opacity-0 transition group-hover:opacity-100 flex-shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-0.5 text-left w-full">
              <p
                className={cn(
                  "font-semibold text-neutral-800 text-left break-words break-all leading-tight w-full",
                  densityStyles.titleText,
                  task.status === "completed" &&
                    "line-through text-neutral-400",
                )}
              >
                {task.title}
              </p>
              {task.description && (
                <p
                  className={cn(
                    "text-neutral-500 text-left",
                    densityStyles.descriptionText,
                  )}
                >
                  {task.description}
                </p>
              )}
            </div>
          </div>
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full text-neutral-400 transition hover:text-neutral-700 flex-shrink-0",
                    density === "compact" ? "h-6 w-6" : "h-7 w-7"
                  )}
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreVertical size={density === "compact" ? 12 : 14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44"
                onClick={(event) => event.stopPropagation()}
              >
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

        <div
          className={cn(
            "flex items-center gap-2 text-neutral-500",
            densityStyles.metaText,
          )}
        >
          <span
            className={cn(
              "flex items-center gap-1 font-medium flex-shrink-0",
              dueToneClass,
            )}
          >
            <Clock size={densityStyles.iconSize} />
            <span className="truncate">{dueMeta.label}</span>
          </span>
          <span className="h-3 w-px bg-neutral-200 flex-shrink-0" />
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <Avatar className={cn("flex-shrink-0", densityStyles.avatarSize)}>
              <AvatarFallback className={cn(
                densityStyles.metaText,
                density === "compact" ? "text-[9px]" : "text-[10px]"
              )}>
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
    data: { columnId, type: "column" },
  });

  return { setNodeRef, isOver };
}
