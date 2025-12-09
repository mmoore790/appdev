import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Printer,
  Phone,
  Mail,
  MapPin,
  FileText as FileTextIcon,
  Clock,
  Search,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { formatDate, getStatusColor, cn } from "../lib/utils";
import { PrintJobDialog } from "./print-job-dialog";
import { StatusTimelineDialog } from "./status-timeline-dialog";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

export interface WorkshopJobsKanbanProps {
  jobs: any[];
  isLoading?: boolean;
  className?: string;
}

interface JobStatusColumn {
  id: string;
  title: string;
  status: string;
  color: string;
  bgColor: string;
}

const STATUS_COLUMNS: JobStatusColumn[] = [
  {
    id: "waiting_assessment",
    title: "Waiting Assessment",
    status: "waiting_assessment",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  {
    id: "in_progress",
    title: "In Progress",
    status: "in_progress",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  {
    id: "on_hold",
    title: "On Hold",
    status: "on_hold",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
  },
  {
    id: "ready_for_pickup",
    title: "Ready for Pickup",
    status: "ready_for_pickup",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  {
    id: "completed",
    title: "Completed",
    status: "completed",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
  },
];

function formatStatus(status: string): string {
  switch (status) {
    case "waiting_assessment":
      return "Waiting Assessment";
    case "in_progress":
      return "In Progress";
    case "on_hold":
      return "On Hold";
    case "ready_for_pickup":
      return "Ready for Pickup";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

function formatTimeInStatus(days: number | undefined): string {
  if (days === undefined || days === null) return "—";
  
  if (days < 1) {
    const hours = Math.round(days * 24);
    if (hours < 1) {
      const minutes = Math.round(days * 24 * 60);
      return `${minutes}m`;
    }
    return `${hours}h`;
  }
  
  if (days < 7) {
    return `${Math.round(days)}d`;
  }
  
  const weeks = Math.floor(days / 7);
  const remainingDays = Math.round(days % 7);
  if (remainingDays === 0) {
    return `${weeks}w`;
  }
  return `${weeks}w ${remainingDays}d`;
}

function getTimeInStatusColor(days: number | undefined): string {
  if (days === undefined || days === null) return "text-neutral-500";
  
  if (days < 1) {
    return "text-green-600 font-semibold";
  } else if (days < 3) {
    return "text-orange-600 font-semibold";
  } else {
    return "text-red-600 font-semibold";
  }
}

function KanbanColumn({
  column,
  jobs,
  onJobClick,
  customerMap,
  userMap,
}: {
  column: JobStatusColumn;
  jobs: any[];
  onJobClick: (job: any) => void;
  customerMap: Record<number, string>;
  userMap: Record<number, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[320px] flex-shrink-0">
      <div
        className={cn(
          "rounded-lg border-2 p-3 mb-2 transition-colors",
          column.bgColor,
          column.color,
          isOver && "ring-2 ring-green-500 ring-offset-2"
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <Badge variant="secondary" className="text-xs font-semibold">
            {jobs.length}
          </Badge>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto space-y-2 pb-4",
          "min-h-[500px] max-h-[calc(100vh-300px)]",
          isOver && "bg-green-50/50 rounded-lg ring-2 ring-green-400 ring-inset"
        )}
      >
        {jobs.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-neutral-200 p-8 text-center mt-2 min-h-[200px] flex items-center justify-center">
            <p className="text-xs text-neutral-400">Drop jobs here</p>
          </div>
        ) : (
          jobs.map((job) => (
            <KanbanJobCard
              key={job.id}
              job={job}
              onClick={() => onJobClick(job)}
              customerMap={customerMap}
              userMap={userMap}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanJobCard({
  job,
  onClick,
  customerMap,
  userMap,
}: {
  job: any;
  onClick: () => void;
  customerMap: Record<number, string>;
  userMap: Record<number, string>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: String(job.id),
    data: {
      type: "job",
      job,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if not dragging
    if (!isDragging) {
      onClick();
    }
  };

  function getCustomerName(customerId: number | null, job?: any): string {
    if (job && job.customer) {
      return job.customer;
    }
    if (customerId && customerMap[customerId]) {
      return customerMap[customerId];
    }
    if (job?.customerName) {
      return job.customerName;
    }
    return "Unknown Customer";
  }

  function getAssigneeName(assigneeId: number | null): string {
    if (!assigneeId) return "Unassigned";
    if (userMap[assigneeId]) {
      return userMap[assigneeId];
    }
    return "Unknown Assignee";
  }

  function getEquipmentName(job: any): string {
    if (!job) return "No equipment specified";
    if (
      job.equipmentDescription &&
      typeof job.equipmentDescription === "string" &&
      job.equipmentDescription.trim() !== ""
    ) {
      return job.equipmentDescription;
    }
    return "No equipment specified";
  }

  const customerName = getCustomerName(job.customerId, job);
  const initials = customerName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:shadow-md transition-shadow border-neutral-200 cursor-grab active:cursor-grabbing",
        isDragging && "shadow-lg opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 space-y-2" onClick={handleClick}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GripVertical className="h-4 w-4 text-neutral-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-green-800 hover:underline">
                {job.jobId}
              </span>
            </div>
            <p className="text-xs font-medium text-neutral-800 truncate">
              {getEquipmentName(job)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700 flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-800 truncate">
              {customerName}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">
              {getAssigneeName(job.assignedTo)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-neutral-400" />
            <span
              className={cn(
                "text-[10px] font-medium",
                getTimeInStatusColor((job as any).timeInStatusDays)
              )}
            >
              {formatTimeInStatus((job as any).timeInStatusDays)}
            </span>
          </div>
          <span className="text-[10px] text-neutral-500">
            {formatDate(job.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkshopJobsKanban({
  jobs = [],
  isLoading = false,
  className = "",
}: WorkshopJobsKanbanProps) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [statusChangeJob, setStatusChangeJob] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedCustomerJob, setSelectedCustomerJob] = useState<any>(null);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [selectedTimelineJob, setSelectedTimelineJob] = useState<any>(null);
  const [selectedJobForPrint, setSelectedJobForPrint] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const { data: customerData = [] } = useQuery({
    queryKey: ["/api/customers"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: userData = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 1000 * 60 * 5,
  });

  const customerMap: Record<number, string> = {};
  if (Array.isArray(customerData)) {
    customerData.forEach((customer: any) => {
      if (customer && customer.id && customer.name) {
        customerMap[customer.id] = customer.name;
      }
    });
  }

  const userMap: Record<number, string> = {};
  if (Array.isArray(userData)) {
    userData.forEach((user: any) => {
      if (user && user.id) {
        userMap[user.id] = user.fullName || user.username;
      }
    });
  }

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    
    const searchTerms = searchQuery.toLowerCase().trim();
    return jobs.filter((job) => {
      if (job.jobId?.toLowerCase().includes(searchTerms)) return true;
      if (job.equipmentDescription?.toLowerCase().includes(searchTerms)) return true;
      if (formatStatus(job.status).toLowerCase().includes(searchTerms)) return true;
      
      const customerName = customerMap[job.customerId] || job.customer || job.customerName || "";
      if (customerName.toLowerCase().includes(searchTerms)) return true;
      
      return false;
    });
  }, [jobs, searchQuery, customerMap]);

  const jobsByStatus = useMemo(() => {
    const grouped: Record<string, any[]> = {
      waiting_assessment: [],
      in_progress: [],
      on_hold: [],
      ready_for_pickup: [],
      completed: [],
    };

    filteredJobs.forEach((job) => {
      if (job.status && grouped[job.status]) {
        grouped[job.status].push(job);
      }
    });

    return grouped;
  }, [filteredJobs]);

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: string }) => {
      return apiRequest("PUT", `/api/jobs/${jobId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Success",
        description: "Job status updated successfully",
      });
      setConfirmDialogOpen(false);
      setStatusChangeJob(null);
      setNewStatus("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job status",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const jobId = Number(active.id);
    const newStatus = over.id as string;

    // Find the job - search in filteredJobs first, then all jobs
    const job = filteredJobs.find((j) => j.id === jobId) || jobs.find((j) => j.id === jobId);
    if (!job) return;

    // Don't update if status hasn't changed
    if (job.status === newStatus) return;

    // Check if this is a status column
    const statusColumn = STATUS_COLUMNS.find((col) => col.id === newStatus);
    if (!statusColumn) return;

    // Handle ready_for_pickup confirmation
    if (newStatus === "ready_for_pickup") {
      setStatusChangeJob(job);
      setNewStatus(newStatus);
      setConfirmDialogOpen(true);
    } else {
      statusUpdateMutation.mutate({ jobId, status: newStatus });
    }
  };

  const confirmStatusChange = () => {
    if (statusChangeJob && newStatus) {
      statusUpdateMutation.mutate({
        jobId: statusChangeJob.id,
        status: newStatus,
      });
    }
  };

  const handleJobClick = (job: any) => {
    navigate(`/workshop/jobs/${job.id}`);
  };

  const draggedJob = activeId
    ? filteredJobs.find((job) => String(job.id) === activeId)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
          <p className="text-sm text-neutral-600">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="relative w-full max-w-sm">
          <Input
            type="text"
            placeholder="Search jobs, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-md border-neutral-200 pl-10 pr-3 text-sm shadow-sm focus-visible:border-green-600 focus-visible:ring-green-600"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        </div>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          {STATUS_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              jobs={jobsByStatus[column.status] || []}
              onJobClick={handleJobClick}
              customerMap={customerMap}
              userMap={userMap}
            />
          ))}
        </div>
        <DragOverlay>
          {draggedJob ? (
            <div className="rotate-3 opacity-90 shadow-xl w-[280px]">
              <Card className="border-neutral-200">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <GripVertical className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-green-800">
                          {draggedJob.jobId}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-neutral-800 truncate">
                        {draggedJob.equipmentDescription || "No equipment specified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              {newStatus === "ready_for_pickup" && (
                <>
                  Are you sure you want to mark job{" "}
                  <strong>{statusChangeJob?.jobId}</strong> as ready for pickup?
                  This will notify the customer using their saved contact
                  preferences.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                setStatusChangeJob(null);
                setNewStatus("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={statusUpdateMutation.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {statusUpdateMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTimelineJob && (
        <StatusTimelineDialog
          open={timelineDialogOpen}
          onOpenChange={setTimelineDialogOpen}
          jobId={selectedTimelineJob.id}
          jobIdString={selectedTimelineJob.jobId}
          currentStatus={selectedTimelineJob.status}
          createdAt={selectedTimelineJob.createdAt}
        />
      )}
    </div>
  );
}
