import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { formatDateTime, formatTimeAgo, getStatusColor, cn } from "../lib/utils";
import { apiRequest } from "../lib/queryClient";
import { parseISO } from "date-fns";

interface StatusTimelineEntry {
  status: string;
  statusLabel: string;
  startTime: string;
  endTime: string | null;
  duration: number; // in days
  isCurrent: boolean;
}

interface StatusTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  jobIdString: string;
  currentStatus: string;
  createdAt: string;
}

export function StatusTimelineDialog({
  open,
  onOpenChange,
  jobId,
  jobIdString,
  currentStatus,
  createdAt,
}: StatusTimelineDialogProps) {
  const { data: updates = [], isLoading } = useQuery({
    queryKey: ["/api/jobs", jobId, "updates"],
    queryFn: () => apiRequest("GET", `/api/jobs/${jobId}/updates`),
    enabled: open && !!jobId,
  });

  // Parse status changes from updates
  const timelineEntries: StatusTimelineEntry[] = [];
  
  if (updates && Array.isArray(updates) && updates.length > 0) {
    // Filter status change updates
    const statusChanges = updates.filter(
      (update: any) => update.note && update.note.includes("Status changed from")
    );

    // Sort by created_at (oldest first)
    statusChanges.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    // Determine the initial status
    // If there are status changes, the first "from" status is the initial one
    // Otherwise, use the current status
    let currentStatusTime = createdAt;
    let initialStatusLabel: string | null = null;
    
    if (statusChanges.length > 0) {
      const firstChange = statusChanges[0];
      const match = firstChange.note.match(/Status changed from "([^"]+)" to/);
      if (match && match[1]) {
        initialStatusLabel = match[1];
      }
    }

    // If we found an initial status, add it as the first entry
    if (initialStatusLabel) {
      const firstChangeTime = statusChanges[0].createdAt || statusChanges[0].created_at;
      if (firstChangeTime) {
        const initialStatus = getStatusFromLabel(initialStatusLabel);
        const duration = calculateDuration(createdAt, firstChangeTime);
        timelineEntries.push({
          status: initialStatus,
          statusLabel: initialStatusLabel,
          startTime: createdAt,
          endTime: firstChangeTime,
          duration,
          isCurrent: false,
        });
        currentStatusTime = firstChangeTime;
      }
    }

    // Process each status change
    statusChanges.forEach((update: any) => {
      const updateTime = update.createdAt || update.created_at;
      if (!updateTime) return;

      // Parse the status change note
      // Format: "Status changed from "X" to "Y""
      const match = update.note.match(/Status changed from "([^"]+)" to "([^"]+)"/);
      if (!match) return;

      const fromStatusLabel = match[1];
      const toStatusLabel = match[2];

      // Add entry for the status that ended (fromStatus)
      const fromStatus = getStatusFromLabel(fromStatusLabel);
      const duration = calculateDuration(currentStatusTime, updateTime);
      timelineEntries.push({
        status: fromStatus,
        statusLabel: fromStatusLabel,
        startTime: currentStatusTime,
        endTime: updateTime,
        duration,
        isCurrent: false,
      });

      currentStatusTime = updateTime;
    });

    // Add the current status
    const currentStatusLabel = formatStatus(currentStatus);
    const duration = calculateDuration(currentStatusTime, null);
    timelineEntries.push({
      status: currentStatus,
      statusLabel: currentStatusLabel,
      startTime: currentStatusTime,
      endTime: null,
      duration,
      isCurrent: true,
    });
  } else {
    // If no status changes found, show just the current status
    if (createdAt) {
      const currentStatusLabel = formatStatus(currentStatus);
      const duration = calculateDuration(createdAt, null);
      timelineEntries.push({
        status: currentStatus,
        statusLabel: currentStatusLabel,
        startTime: createdAt,
        endTime: null,
        duration,
        isCurrent: true,
      });
    }
  }

  function getStatusFromLabel(label: string): string {
    // Convert formatted label back to status code
    const labelLower = label.toLowerCase();
    if (labelLower.includes("waiting assessment")) return "waiting_assessment";
    if (labelLower.includes("in progress")) return "in_progress";
    if (labelLower.includes("on hold")) return "on_hold";
    if (labelLower.includes("ready for pickup")) return "ready_for_pickup";
    if (labelLower.includes("completed")) return "completed";
    return label.toLowerCase().replace(/\s+/g, "_");
  }

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

  function calculateDuration(startTime: string, endTime: string | null): number {
    try {
      // Handle date parsing similar to formatDateTime
      let start: Date;
      if (startTime.includes('T') || startTime.includes('Z')) {
        start = parseISO(startTime);
      } else {
        start = parseISO(startTime + 'Z');
      }

      let end: Date;
      if (endTime) {
        if (endTime.includes('T') || endTime.includes('Z')) {
          end = parseISO(endTime);
        } else {
          end = parseISO(endTime + 'Z');
        }
      } else {
        end = new Date();
      }

      const diffMs = end.getTime() - start.getTime();
      return diffMs / (1000 * 60 * 60 * 24); // Convert to days
    } catch (error) {
      console.error("Error calculating duration:", error);
      return 0;
    }
  }

  function formatDuration(days: number): string {
    if (days < 1) {
      const hours = Math.round(days * 24);
      if (hours < 1) {
        const minutes = Math.round(days * 24 * 60);
        return `${minutes}m`;
      }
      return `${hours}h`;
    }
    
    if (days < 7) {
      const rounded = Math.round(days * 10) / 10;
      return `${rounded}d`;
    }
    
    const weeks = Math.floor(days / 7);
    const remainingDays = Math.round((days % 7) * 10) / 10;
    if (remainingDays === 0) {
      return `${weeks}w`;
    }
    return `${weeks}w ${remainingDays}d`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Status Timeline - {jobIdString}</DialogTitle>
          <DialogDescription>
            View the progression of this job through different statuses
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
          </div>
        ) : timelineEntries.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p>No status history available</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {timelineEntries.map((entry, index) => {
              const statusColor = getStatusColor(entry.status);
              const isLast = index === timelineEntries.length - 1;
              
              return (
                <div key={index} className="relative flex gap-4">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-neutral-200" />
                  )}
                  
                  {/* Status icon */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2",
                        entry.isCurrent
                          ? `${statusColor.bgColor} border-white shadow-md`
                          : "bg-white border-neutral-300"
                      )}
                    >
                      {entry.isCurrent ? (
                        <Clock className="h-4 w-4 text-white" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-neutral-400" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                              statusColor.bgColor,
                              statusColor.textColor
                            )}
                          >
                            {entry.statusLabel}
                          </span>
                          {entry.isCurrent && (
                            <span className="text-xs text-neutral-500">(Current)</span>
                          )}
                        </div>
                        <div className="text-sm text-neutral-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Duration:</span>
                            <span className={cn(
                              "font-semibold",
                              entry.duration < 1
                                ? "text-green-600"
                                : entry.duration < 3
                                ? "text-orange-600"
                                : "text-red-600"
                            )}>
                              {formatDuration(entry.duration)}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            <div>Started: {formatDateTime(entry.startTime)}</div>
                            {entry.endTime && (
                              <div>Ended: {formatDateTime(entry.endTime)}</div>
                            )}
                            {!entry.endTime && (
                              <div>Ongoing: {formatTimeAgo(entry.startTime)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}








