import { useMemo } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { parseISO } from "date-fns";
import { getStatusColor, cn } from "../lib/utils";

interface StatusTimelineEntry {
  status: string;
  statusLabel: string;
  duration: number; // in days
  isCurrent: boolean;
}

interface StatusTimelineProps {
  job: {
    id: number;
    status: string;
    createdAt: string;
  } | null;
  jobUpdates?: Array<{
    id: number;
    note: string;
    createdAt: string;
  }>;
  isLoading?: boolean;
}

export function StatusTimeline({ job, jobUpdates = [], isLoading = false }: StatusTimelineProps) {
  const timelineEntries = useMemo<StatusTimelineEntry[]>(() => {
    if (!job || !job.createdAt) return [];

    const entries: StatusTimelineEntry[] = [];

    // Filter status change updates
    const statusChanges = (jobUpdates || []).filter(
      (update: any) => update.note && update.note.includes("Status changed from")
    );

    // Sort by created_at (oldest first)
    statusChanges.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    // Determine the initial status
    let currentStatusTime = job.createdAt;
    let initialStatusLabel: string | null = null;
    let firstFromStatusLabel: string | null = null;

    if (statusChanges.length > 0) {
      const firstChange = statusChanges[0];
      const match = firstChange.note.match(/Status changed from "([^"]+)" to/);
      if (match && match[1]) {
        initialStatusLabel = match[1];
        firstFromStatusLabel = match[1];
      }
    }

    // If we found an initial status, add it as the first entry
    if (initialStatusLabel) {
      const firstChangeTime = statusChanges[0].createdAt || statusChanges[0].created_at;
      if (firstChangeTime) {
        const initialStatus = getStatusFromLabel(initialStatusLabel);
        const duration = calculateDuration(job.createdAt, firstChangeTime);
        entries.push({
          status: initialStatus,
          statusLabel: initialStatusLabel,
          duration,
          isCurrent: false,
        });
        currentStatusTime = firstChangeTime;
      }
    }

    // Process each status change
    statusChanges.forEach((update: any, index: number) => {
      const updateTime = update.createdAt || update.created_at;
      if (!updateTime) return;

      // Parse the status change note
      const match = update.note.match(/Status changed from "([^"]+)" to "([^"]+)"/);
      if (!match) return;

      const fromStatusLabel = match[1];
      const toStatusLabel = match[2];

      // Skip adding the fromStatus if it's the same as the initial status we already added
      // (this prevents duplicates for the first status)
      if (index === 0 && fromStatusLabel === firstFromStatusLabel) {
        // We already added this status as the initial status, so skip it
        currentStatusTime = updateTime;
        return;
      }

      // Add entry for the status that ended (fromStatus)
      const fromStatus = getStatusFromLabel(fromStatusLabel);
      const duration = calculateDuration(currentStatusTime, updateTime);
      entries.push({
        status: fromStatus,
        statusLabel: fromStatusLabel,
        duration,
        isCurrent: false,
      });

      currentStatusTime = updateTime;
    });

    // Add the current status
    const currentStatusLabel = formatStatus(job.status);
    const duration = calculateDuration(currentStatusTime, null);
    entries.push({
      status: job.status,
      statusLabel: currentStatusLabel,
      duration,
      isCurrent: true,
    });

    return entries;
  }, [job, jobUpdates]);

  function getStatusFromLabel(label: string): string {
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

  if (isLoading || !job) {
    return null;
  }

  if (timelineEntries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-500" />
          Status Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {timelineEntries.map((entry, index) => {
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="text-neutral-700 font-medium">
                {entry.statusLabel}
              </span>
              <span className="text-neutral-400">→</span>
              <span
                className={cn(
                  "font-semibold whitespace-nowrap ml-auto",
                  entry.duration < 1
                    ? "text-green-600"
                    : entry.duration < 3
                    ? "text-orange-600"
                    : "text-red-600"
                )}
              >
                {formatDuration(entry.duration)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
