import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, addMinutes, addDays, startOfWeek, endOfWeek, isSameDay, parseISO, addHours, setHours, setMinutes, startOfToday, nextMonday } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Calendar as CalendarIcon, Clock, Plus, X, Edit2, Trash2, Briefcase, CalendarDays, Users, AlertCircle, CheckCircle2, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid, LayoutList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TimeEntry {
  id: number;
  userId: number;
  startTime: string;
  durationMinutes: number;
  title: string;
  description?: string;
  jobId?: number;
  createdAt: string;
  updatedAt: string;
}

interface Job {
  id: number;
  jobId: string;
  description: string;
  status: string;
  assignedTo?: number;
  customerId?: number;
  customerName?: string;
  equipmentDescription?: string;
  estimatedHours?: number;
}

interface User {
  id: number;
  fullName: string;
  username: string;
  role: string;
}

// Draggable Job Card Component
function DraggableJobCard({ job, onSchedule }: { job: Job; onSchedule: (job: Job) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${job.id}`,
    data: { type: "job", job },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 rounded-lg border bg-white shadow-sm hover:shadow-md transition-all group",
        isDragging && "opacity-50"
      )}
    >
      {/* Draggable area - exclude the button */}
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">{job.jobId}</div>
            <div className="text-xs text-slate-600 mt-1 line-clamp-2">{job.description}</div>
            <Badge variant="outline" className="mt-2 text-xs">
              {job.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <Briefcase className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
        </div>
      </div>
      {/* Button area - not draggable */}
      <div className="mt-2 pt-2 border-t border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSchedule(job);
          }}
          onMouseDown={(e) => {
            // Prevent drag when clicking button
            e.stopPropagation();
          }}
        >
          <CalendarDays className="h-3 w-3 mr-1" />
          Schedule Event
        </Button>
      </div>
    </div>
  );
}

// Event Block Component - renders events horizontally
function EventBlockHorizontal({
  entry,
  dayStart,
  jobs,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  dayStart: Date;
  jobs: Job[];
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: number) => void;
}) {
  const entryStart = parseISO(entry.startTime);
  const entryEnd = addMinutes(entryStart, entry.durationMinutes);
  
  // Calculate position and width (6am to 10pm = 17 hours)
  const startMinutes = entryStart.getHours() * 60 + entryStart.getMinutes();
  const endMinutes = entryEnd.getHours() * 60 + entryEnd.getMinutes();
  const dayStartMinutes = 6 * 60; // 6am
  const dayEndMinutes = 23 * 60; // 11pm (23:00)
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  
  const leftPercent = ((startMinutes - dayStartMinutes) / totalMinutes) * 100;
  const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
  
  const job = entry.jobId ? jobs.find((j) => j.id === entry.jobId) : null;

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 mx-0.5 rounded border p-1.5 cursor-pointer z-10 shadow-sm hover:shadow-md transition-all group flex flex-col justify-center",
        entry.jobId ? "bg-blue-100 border-blue-300" : "bg-green-100 border-green-300"
      )}
      style={{
        left: `${Math.max(0, leftPercent)}%`,
        width: `${Math.max(2, widthPercent)}%`,
        minWidth: "60px",
      }}
      onClick={() => onEdit(entry)}
    >
      <div className="text-xs font-semibold text-slate-900 truncate">{entry.title}</div>
      {entry.description && (
        <div className="text-xs text-slate-600 truncate mt-0.5 line-clamp-1">{entry.description}</div>
      )}
      {job && (
        <Badge variant="secondary" className="mt-1 text-xs w-fit">
          {job.jobId}
        </Badge>
      )}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Hour Slot Component for horizontal time view
function HourRow({
  hour,
  userId,
  day,
  entries,
  onEdit,
  onDelete,
  onAdd,
  hourSlotWidth,
}: {
  hour: number;
  userId: number;
  day: Date;
  entries: TimeEntry[];
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: number) => void;
  onAdd: (time: Date) => void;
  hourSlotWidth: number;
}) {
  const slotTime = new Date(day);
  slotTime.setHours(hour, 0, 0, 0);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `hour-${userId}-${day.getTime()}-${hour}`,
    data: { userId, time: slotTime.toISOString() },
  });

  // Get entries that overlap with this hour
  const hourEntries = entries.filter((entry) => {
    const entryStart = parseISO(entry.startTime);
    const entryEnd = addMinutes(entryStart, entry.durationMinutes);
    const hourStart = new Date(day);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(day);
    hourEnd.setHours(hour + 1, 0, 0, 0);
    
    return entryStart < hourEnd && entryEnd > hourStart;
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r border-slate-200 last:border-r-0 relative group flex-shrink-0",
        isOver && "bg-primary/10 border-primary border-2"
      )}
      style={{ 
        width: `${hourSlotWidth}px`,
      }}
    >
      {hourEntries.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onAdd(slotTime)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Comprehensive Schedule Event Dialog
function ScheduleEventDialog({
  open,
  onOpenChange,
  job,
  users,
  timeEntries,
  onSave,
  initialDate,
  initialTime,
  initialUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  users: User[];
  timeEntries: TimeEntry[];
  onSave: (data: any[]) => void;
  initialDate?: Date;
  initialTime?: Date;
  initialUserId?: number;
}) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedTime, setSelectedTime] = useState<string>("09:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [quickSchedule, setQuickSchedule] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      if (initialDate && !isNaN(initialDate.getTime())) {
        setSelectedDate(initialDate);
        // Format time from initialDate if provided
        const timeStr = format(initialDate, "HH:mm");
        setSelectedTime(timeStr);
      } else if (initialTime && !isNaN(initialTime.getTime())) {
        setSelectedDate(startOfDay(initialTime));
        const timeStr = format(initialTime, "HH:mm");
        setSelectedTime(timeStr);
      }
      
      if (initialUserId && initialUserId > 0) {
        setSelectedUsers([initialUserId]);
      } else if (job && job.assignedTo) {
        // Pre-select assigned user if available
        setSelectedUsers([job.assignedTo]);
      } else {
        setSelectedUsers([]);
      }
      
      if (job) {
        // Set default duration based on estimated hours
        if (job.estimatedHours) {
          setDuration(Math.max(60, job.estimatedHours * 60));
        }
        setTitle("");
      } else {
        setTitle("");
        setDuration(60);
      }
      
      // Reset notes
      setNotes("");
      setQuickSchedule(null);
    }
  }, [job, open, initialDate, initialTime, initialUserId]);

  // Quick schedule options
  const quickScheduleOptions = [
    { label: "Today Morning (9 AM)", value: "today-morning", time: "09:00", date: startOfToday() },
    { label: "Today Afternoon (2 PM)", value: "today-afternoon", time: "14:00", date: startOfToday() },
    { label: "Tomorrow Morning (9 AM)", value: "tomorrow-morning", time: "09:00", date: addDays(startOfToday(), 1) },
    { label: "Next Monday (9 AM)", value: "next-monday", time: "09:00", date: nextMonday(startOfToday()) },
  ];

  const handleQuickSchedule = (option: typeof quickScheduleOptions[0]) => {
    setSelectedDate(option.date);
    setSelectedTime(option.time);
    setQuickSchedule(option.value);
  };

  // Check availability for selected users
  const checkAvailability = useCallback((userId: number, startDateTime: Date, durationMinutes: number) => {
    const endDateTime = addMinutes(startDateTime, durationMinutes);
    
    const conflicts = timeEntries.filter((entry) => {
      if (entry.userId !== userId) return false;
      
      const entryStart = parseISO(entry.startTime);
      const entryEnd = addMinutes(entryStart, entry.durationMinutes);
      
      // Check for overlap
      return (
        (startDateTime >= entryStart && startDateTime < entryEnd) ||
        (endDateTime > entryStart && endDateTime <= entryEnd) ||
        (startDateTime <= entryStart && endDateTime >= entryEnd)
      );
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.length,
    };
  }, [timeEntries]);

  const handleSave = () => {
    if (selectedUsers.length === 0) {
      return;
    }

    // If no job, require a title
    if (!job && !title.trim()) {
      return;
    }

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const startDateTime = setMinutes(setHours(selectedDate, hours), minutes);

    const entries = selectedUsers.map((userId) => {
      const availability = checkAvailability(userId, startDateTime, duration);
      
      return {
        userId,
        startTime: startDateTime.toISOString(),
        durationMinutes: duration,
        title: job ? `Work on ${job.jobId}` : title.trim(),
        description: notes || job?.description || undefined,
        jobId: job?.id,
      };
    });

    onSave(entries);
    
    // Reset form
    setSelectedUsers([]);
    setSelectedDate(startOfToday());
    setSelectedTime("09:00");
    setDuration(60);
    setNotes("");
    setTitle("");
    setQuickSchedule(null);
    onOpenChange(false);
  };

  // Safely parse time and create startDateTime
  const startDateTime = useMemo(() => {
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        return setMinutes(setHours(selectedDate, 9), 0); // Default to 9 AM
      }
      return setMinutes(setHours(selectedDate, hours), minutes);
    } catch (error) {
      console.error("Error parsing time:", error);
      return setMinutes(setHours(selectedDate, 9), 0); // Default to 9 AM
    }
  }, [selectedTime, selectedDate]);

  const availabilityMap = useMemo(() => {
    try {
      const map = new Map<number, { available: boolean; conflicts: number }>();
      selectedUsers.forEach((userId) => {
        map.set(userId, checkAvailability(userId, startDateTime, duration));
      });
      return map;
    } catch (error) {
      console.error("Error calculating availability:", error);
      return new Map<number, { available: boolean; conflicts: number }>();
    }
  }, [selectedUsers, startDateTime, duration, checkAvailability]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {job ? `Schedule Event: ${job.jobId}` : "Schedule Event"}
          </DialogTitle>
          <DialogDescription>
            {job 
              ? "Schedule time for this job across one or more staff members"
              : "Schedule time for one or more staff members"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Job Information Card - only show if job exists */}
        {job && (
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{job.jobId}</div>
                    <div className="text-sm text-slate-600 mt-1">{job.description}</div>
                  </div>
                  <Badge variant="outline">{job.status.replace(/_/g, " ")}</Badge>
                </div>
                {job.customerName && (
                  <div className="text-xs text-slate-500">
                    Customer: {job.customerName}
                  </div>
                )}
                {job.equipmentDescription && (
                  <div className="text-xs text-slate-500">
                    Equipment: {job.equipmentDescription}
                  </div>
                )}
                {job.estimatedHours && (
                  <div className="text-xs text-slate-500">
                    Estimated: {job.estimatedHours} hour{job.estimatedHours !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* Title field - only show if no job */}
          {!job && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Event Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter event title"
                className="mt-1"
              />
            </div>
          )}

          {/* Quick Schedule Options */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Quick Schedule
            </label>
            <div className="grid grid-cols-2 gap-2">
              {quickScheduleOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={quickSchedule === option.value ? "default" : "outline"}
                  size="sm"
                  className="justify-start"
                  onClick={() => handleQuickSchedule(option)}
                >
                  <Zap className="h-3 w-3 mr-2" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Staff Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
              <Users className="h-4 w-4" />
              Select Staff Members *
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
              {users.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                const availability = availabilityMap.get(user.id);
                const hasConflict = availability && !availability.available;

                return (
                  <div
                    key={user.id}
                    className={cn(
                      "flex items-center space-x-3 p-2 rounded-lg border transition-colors",
                      isSelected && "bg-primary/10 border-primary",
                      hasConflict && "bg-red-50 border-red-200"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter((id) => id !== user.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-900">{user.fullName}</div>
                      <div className="text-xs text-slate-500">{user.role}</div>
                    </div>
                    {isSelected && availability && (
                      <div className="flex items-center gap-1 text-xs">
                        {availability.available ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span className="text-green-600">Available</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-red-600" />
                            <span className="text-red-600">{availability.conflicts} conflict(s)</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setQuickSchedule(null);
                    }
                  }}
                  disabled={(date) => date < startOfToday()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Start Time
            </label>
            <Input
              type="time"
              value={selectedTime}
              onChange={(e) => {
                setSelectedTime(e.target.value);
                setQuickSchedule(null);
              }}
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Duration
            </label>
            <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="180">3 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="480">8 hours</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-slate-500 mt-1">
              End time: {format(addMinutes(startDateTime, duration), "h:mm a")}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Additional Notes (Optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or instructions..."
              rows={3}
            />
          </div>

          {/* Summary */}
          {selectedUsers.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="text-sm">
                  <div className="font-medium text-slate-900 mb-2">Schedule Summary</div>
                  <div className="space-y-1 text-slate-600">
                    <div>Date: {format(selectedDate, "EEEE, MMMM d, yyyy")}</div>
                    <div>Time: {format(startDateTime, "h:mm a")} - {format(addMinutes(startDateTime, duration), "h:mm a")}</div>
                    <div>Duration: {duration} minutes ({duration / 60} hour{duration / 60 !== 1 ? "s" : ""})</div>
                    <div>Staff: {selectedUsers.length} member{selectedUsers.length !== 1 ? "s" : ""}</div>
                    {Array.from(availabilityMap.values()).some((a) => !a.available) && (
                      <div className="text-red-600 font-medium mt-2">
                        ⚠️ Some staff members have scheduling conflicts
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={selectedUsers.length === 0 || (!job && !title.trim())}
            >
              Schedule for {selectedUsers.length} Staff Member{selectedUsers.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Event Form Dialog
function EventFormDialog({
  open,
  onOpenChange,
  entry,
  userId,
  startTime: initialStartTime,
  jobs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry;
  userId: number;
  startTime?: Date;
  jobs: Job[];
  onSave: (data: any) => void;
}) {
  // Hooks must be called first (before any early returns)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 60); // Default 1 hour
    return date;
  });

  // Update form when entry or startTime prop changes
  useEffect(() => {
    try {
      if (entry && entry.id && entry.id > 0) {
        // Only treat as edit if entry has a valid id > 0
        setTitle(entry.title || "");
        setDescription(entry.description || "");
        setSelectedJobId(entry.jobId?.toString() || "");
        if (entry.startTime) {
          const parsedStart = parseISO(entry.startTime);
          if (!isNaN(parsedStart.getTime())) {
            setStartTime(parsedStart);
            // Calculate end time from duration
            const parsedEnd = addMinutes(parsedStart, entry.durationMinutes || 60);
            setEndTime(parsedEnd);
          } else {
            const defaultStart = initialStartTime || new Date();
            setStartTime(defaultStart);
            setEndTime(addMinutes(defaultStart, 60));
          }
        } else {
          const defaultStart = initialStartTime || new Date();
          setStartTime(defaultStart);
          setEndTime(addMinutes(defaultStart, 60));
        }
      } else if (initialStartTime && !isNaN(initialStartTime.getTime())) {
        // New entry with initialStartTime prop
        setStartTime(initialStartTime);
        setEndTime(addMinutes(initialStartTime, 60)); // Default 1 hour
        setTitle("");
        setDescription("");
        setSelectedJobId("");
      } else {
        // Default new entry
        const now = new Date();
        setStartTime(now);
        setEndTime(addMinutes(now, 60));
        setTitle("");
        setDescription("");
        setSelectedJobId("");
      }
    } catch (error) {
      console.error("Error updating form:", error);
      // Set safe defaults
      const now = new Date();
      setStartTime(now);
      setEndTime(addMinutes(now, 60));
      setTitle("");
      setDescription("");
      setSelectedJobId("");
    }
  }, [entry, initialStartTime, open]);

  // Ensure we have valid times
  const safeStartTime = useMemo(() => {
    if (startTime && !isNaN(startTime.getTime())) {
      return startTime;
    }
    return new Date();
  }, [startTime]);

  const safeEndTime = useMemo(() => {
    if (endTime && !isNaN(endTime.getTime())) {
      return endTime;
    }
    return addMinutes(safeStartTime, 60);
  }, [endTime, safeStartTime]);

  const handleSave = () => {
    try {
      if (!title.trim()) {
        return;
      }

      // Validate times
      const start = safeStartTime;
      const end = safeEndTime;
      
      if (!start || isNaN(start.getTime())) {
        console.error("Invalid start time:", start);
        return;
      }

      if (!end || isNaN(end.getTime())) {
        console.error("Invalid end time:", end);
        return;
      }

      // Ensure end time is after start time
      if (end <= start) {
        console.error("End time must be after start time");
        return;
      }

      if (!userId || userId === 0) {
        console.error("Invalid userId:", userId);
        return;
      }

      // Calculate duration in minutes
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      
      if (durationMinutes <= 0) {
        console.error("Duration must be positive");
        return;
      }

      const timeString = start.toISOString();
      
      // Prepare data for API - only include id for updates
      const data: any = {
        userId,
        startTime: timeString,
        durationMinutes,
        title: title.trim(),
      };

      // Only include description if it has content
      if (description.trim()) {
        data.description = description.trim();
      }

      // Only include jobId if it's selected
      if (selectedJobId) {
        const jobIdNum = parseInt(selectedJobId);
        if (!isNaN(jobIdNum)) {
          data.jobId = jobIdNum;
        }
      }

      // Only include id for updates (must be > 0)
      if (entry?.id && entry.id > 0) {
        data.id = entry.id;
      }

      onSave(data);

      // Reset form
      const now = new Date();
      setTitle("");
      setDescription("");
      setSelectedJobId("");
      setStartTime(now);
      setEndTime(addMinutes(now, 60));
      onOpenChange(false);
    } catch (error) {
      console.error("Error in handleSave:", error);
    }
  };


  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const value = e.target.value;
      if (value) {
        const newDate = new Date(value);
        if (!isNaN(newDate.getTime())) {
          setStartTime(newDate);
          // If end time is before or equal to new start time, adjust it
          if (endTime <= newDate) {
            setEndTime(addMinutes(newDate, 60));
          }
        } else {
          console.error("Invalid date value:", value);
        }
      }
    } catch (error) {
      console.error("Error parsing start time:", error);
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const value = e.target.value;
      if (value) {
        const newDate = new Date(value);
        if (!isNaN(newDate.getTime())) {
          // Ensure end time is after start time
          if (newDate > startTime) {
            setEndTime(newDate);
          } else {
            console.error("End time must be after start time");
            // Auto-adjust to 1 hour after start
            setEndTime(addMinutes(startTime, 60));
          }
        } else {
          console.error("Invalid date value:", value);
        }
      }
    } catch (error) {
      console.error("Error parsing end time:", error);
    }
  };

  // Validation checks (after hooks)
  if (!open) {
    return null;
  }

  if (!userId || userId === 0) {
    console.error("EventFormDialog: Invalid userId", userId);
    return null;
  }

  if (!jobs || !Array.isArray(jobs)) {
    console.error("EventFormDialog: Invalid jobs array", jobs);
    return null;
  }

  if (!onSave || typeof onSave !== 'function') {
    console.error("EventFormDialog: Invalid onSave function", onSave);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Event" : "Add Event"}</DialogTitle>
          <DialogDescription>
            {entry ? "Update the time entry details" : "Create a new time entry for this staff member"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Start Date & Time *</label>
            <Input
              type="datetime-local"
              value={(() => {
                try {
                  if (!safeStartTime || isNaN(safeStartTime.getTime())) {
                    return "";
                  }
                  return format(safeStartTime, "yyyy-MM-dd'T'HH:mm");
                } catch (error) {
                  console.error("Error formatting start date:", error);
                  return "";
                }
              })()}
              onChange={handleStartTimeChange}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">End Date & Time *</label>
            <Input
              type="datetime-local"
              value={(() => {
                try {
                  if (!safeEndTime || isNaN(safeEndTime.getTime())) {
                    return "";
                  }
                  return format(safeEndTime, "yyyy-MM-dd'T'HH:mm");
                } catch (error) {
                  console.error("Error formatting end date:", error);
                  return "";
                }
              })()}
              onChange={handleEndTimeChange}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Duration: {Math.round((safeEndTime.getTime() - safeStartTime.getTime()) / (1000 * 60))} minutes
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description"
              className="mt-1"
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Link to Job (Optional)</label>
            <Select value={selectedJobId || "__none__"} onValueChange={(value) => setSelectedJobId(value === "__none__" ? "" : value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id.toString()}>
                    {job.jobId} - {job.description.substring(0, 50)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title.trim()}>
              {entry ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | undefined>();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState<Date | undefined>();
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedulingJob, setSchedulingJob] = useState<Job | null>(null);
  const [manualEventDialogOpen, setManualEventDialogOpen] = useState(false);
  const [manualEventInitialTime, setManualEventInitialTime] = useState<Date | undefined>();
  const [manualEventInitialUserId, setManualEventInitialUserId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch data
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return { start: dayStart, end: dayEnd, days: [selectedDate] };
    } else {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return { start: weekStart, end: weekEnd, days };
    }
  }, [selectedDate, viewMode]);

  // Generate hourly time slots (6 AM to 10 PM) - reduced range to show more hours at once
  const hours = useMemo(() => {
    const hoursList = [];
    for (let h = 6; h <= 22; h++) {
      hoursList.push(h);
    }
    return hoursList;
  }, []);

  // Calculate hour slot width - make it narrower to fit more hours on screen
  // Adjust this value to show more/fewer hours at a glance (smaller = more hours visible)
  const hourSlotWidth = 60; // Reduced from 85px to show more hours without scrolling

  // Generate 15-minute intervals for each hour (matching the hours range)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 6; h <= 22; h++) {
      for (let m = 0; m < 60; m += 15) {
        const time = new Date();
        time.setHours(h, m, 0, 0);
        slots.push(time);
      }
    }
    return slots;
  }, []);

  // Fetch time entries for the date range
  const { data: timeEntries = [], refetch: refetchEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/time-entries?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`
      );
      return Array.isArray(response) ? response as TimeEntry[] : [];
    },
  });

  // Group time entries by user and calculate positions for rendering
  const entriesByUser = useMemo(() => {
    const map = new Map<number, TimeEntry[]>();
    const entriesArray = Array.isArray(timeEntries) ? timeEntries : [];
    entriesArray.forEach((entry) => {
      if (!map.has(entry.userId)) {
        map.set(entry.userId, []);
      }
      map.get(entry.userId)!.push(entry);
    });
    // Sort entries by start time
    map.forEach((entries) => {
      entries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
    return map;
  }, [timeEntries]);

  // Helper to get entries for a specific user and day
  const getEntriesForUserAndDay = useCallback((userId: number, day: Date) => {
    const entries = entriesByUser.get(userId) || [];
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    
    return entries.filter((entry) => {
      const entryTime = parseISO(entry.startTime);
      return entryTime >= dayStart && entryTime <= dayEnd;
    });
  }, [entriesByUser]);

  // Create time entry mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Remove id from data for creation
      const { id, ...createData } = data;
      console.log("Creating time entry with data:", createData);
      try {
        return await apiRequest("/api/time-entries", {
          method: "POST",
          data: createData,
        });
      } catch (error: any) {
        console.error("API Error details:", error);
        // Re-throw with more context
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Event created",
        description: "Time entry has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating time entry:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create time entry.";
      const errorDetails = error?.response?.data?.errors;
      toast({
        title: "Error",
        description: errorDetails ? `${errorMessage} ${JSON.stringify(errorDetails)}` : errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update time entry mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      // Remove id from data for update (it's in the URL)
      const { id: _, ...updateData } = data;
      console.log("Updating time entry with data:", updateData);
      return apiRequest(`/api/time-entries/${id}`, {
        method: "PUT",
        data: updateData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Event updated",
        description: "Time entry has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error updating time entry:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to update time entry.";
      const errorDetails = error?.response?.data?.errors;
      toast({
        title: "Error",
        description: errorDetails ? `${errorMessage} ${JSON.stringify(errorDetails)}` : errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete time entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/time-entries/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Event deleted",
        description: "Time entry has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete time entry.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (entry: TimeEntry) => {
    try {
      if (entry && entry.id) {
        // Editing an existing entry
        if (!entry.userId || entry.userId === 0) {
          console.error("Invalid userId in entry:", entry);
          toast({
            title: "Error",
            description: "Invalid entry data. Please try again.",
            variant: "destructive",
          });
          return;
        }
        setEditingEntry(entry);
        setSelectedUserId(entry.userId);
        setSelectedSlotTime(undefined); // Clear slot time when editing
        setDialogOpen(true);
      } else {
        // This shouldn't happen, but handle it gracefully
        console.error("Invalid entry passed to handleEdit:", entry);
        toast({
          title: "Error",
          description: "Invalid entry. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in handleEdit:", error);
      toast({
        title: "Error",
        description: "Failed to open event dialog. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSave = (data: any) => {
    if (data.id) {
      updateMutation.mutate({ id: data.id, data });
    } else {
      createMutation.mutate(data);
    }
    setDialogOpen(false);
    setEditingEntry(undefined);
    setSelectedUserId(null);
    setSelectedSlotTime(undefined);
  };

  const handleScheduleJob = (job: Job) => {
    setSchedulingJob(job);
    setScheduleDialogOpen(true);
  };

  const handleScheduleSave = (entries: any[]) => {
    // Create multiple time entries for multiple staff members
    entries.forEach((entry) => {
      // Ensure all required fields are present
      const entryData = {
        userId: entry.userId,
        startTime: entry.startTime,
        durationMinutes: entry.durationMinutes,
        title: entry.title,
        ...(entry.description && { description: entry.description }),
        ...(entry.jobId && { jobId: entry.jobId }),
      };
      createMutation.mutate(entryData);
    });
    setScheduleDialogOpen(false);
    setSchedulingJob(null);
    setManualEventDialogOpen(false);
    setManualEventInitialTime(undefined);
    setManualEventInitialUserId(undefined);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this time entry?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    try {
      const { active, over } = event;
      setDraggedJob(null);

      if (!active || !over) {
        return;
      }

      const jobData = active.data?.current;
      if (!jobData || jobData.type !== "job" || !jobData.job) {
        return;
      }

      const slotData = over.data?.current;
      if (!slotData || typeof slotData.userId !== "number" || !slotData.time) {
        return;
      }

      const job = jobData.job as Job;
      if (!job || !job.id || !job.jobId) {
        console.error("Invalid job data:", job);
        return;
      }

      const userId = slotData.userId as number;
      let slotTime: Date;
      
      try {
        slotTime = new Date(slotData.time as string);
        // Validate the date
        if (isNaN(slotTime.getTime())) {
          console.error("Invalid date from slot data:", slotData.time);
          return;
        }
      } catch (dateError) {
        console.error("Error parsing date:", dateError);
        return;
      }

      // Validate userId before opening dialog
      if (!userId || userId === 0) {
        console.error("Invalid userId:", userId);
        toast({
          title: "Error",
          description: "Invalid staff member. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Open schedule dialog with job pre-filled
      console.log("Opening dialog from drag for user:", userId, "at time:", slotTime, "job:", job.jobId);
      setSchedulingJob(job);
      // Store initial values for the schedule dialog
      setManualEventInitialTime(slotTime);
      setManualEventInitialUserId(userId);
      // Use a small delay to ensure state is set
      requestAnimationFrame(() => {
        setScheduleDialogOpen(true);
      });
    } catch (error) {
      console.error("Error in handleDragEnd:", error);
      toast({
        title: "Error",
        description: "Failed to process drag and drop. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (event: any) => {
    try {
      if (event?.active?.data?.current?.type === "job" && event.active.data.current.job) {
        setDraggedJob(event.active.data.current.job);
      }
    } catch (error) {
      console.error("Error in handleDragStart:", error);
      setDraggedJob(null);
    }
  };

  // Filter active jobs (not completed)
  const activeJobs = useMemo(() => {
    return jobs.filter((job) => job.status !== "completed");
  }, [jobs]);

  // Navigation handlers
  const navigateDate = (direction: "prev" | "next" | "today" | "fast-prev" | "fast-next") => {
    if (direction === "today") {
      setSelectedDate(new Date());
    } else if (direction === "prev") {
      setSelectedDate(addDays(selectedDate, viewMode === "day" ? -1 : -7));
    } else if (direction === "next") {
      setSelectedDate(addDays(selectedDate, viewMode === "day" ? 1 : 7));
    } else if (direction === "fast-prev") {
      setSelectedDate(addDays(selectedDate, viewMode === "day" ? -7 : -28));
    } else if (direction === "fast-next") {
      setSelectedDate(addDays(selectedDate, viewMode === "day" ? 7 : 28));
    }
  };

  // Error boundary - catch any rendering errors
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <Button onClick={() => { setError(null); setDialogOpen(false); }}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
      {/* Header with navigation and view controls */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b px-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Staff Calendar</h1>
            <p className="text-lg font-semibold text-slate-700 mt-1">
              {viewMode === "day" 
                ? format(selectedDate, "EEEE, MMMM d, yyyy")
                : `${format(dateRange.days[0], "MMM d")} - ${format(dateRange.days[dateRange.days.length - 1], "MMM d, yyyy")}`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
            <TabsList>
              <TabsTrigger value="day">
                <LayoutList className="h-4 w-4 mr-2" />
                Day
              </TabsTrigger>
              <TabsTrigger value="week">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Week
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date Navigation */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate("fast-prev")}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate("prev")}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate("today")}
              className="h-8 px-3"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate("next")}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate("fast-next")}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div className="flex-1 flex gap-4 overflow-hidden px-4">
          {/* Calendar Grid - wider to show more hours */}
          <div className="flex-[3] border border-slate-200 rounded-lg bg-white min-w-0 flex flex-col overflow-hidden">
            {/* Single scrollable container for header and body */}
            <div className="flex-1 overflow-auto">
              {/* Header with day columns and time */}
              <div className="sticky top-0 bg-white z-20 border-b border-slate-200 shadow-sm">
                <div className="flex">
                  <div className="w-48 border-r border-slate-200 p-2 font-semibold text-sm text-slate-700 bg-slate-50 flex-shrink-0 sticky left-0 z-30">
                    Staff Member
                  </div>
                  {dateRange.days.map((day) => (
                    <div
                      key={day.getTime()}
                      className={cn(
                        "border-r border-slate-200 last:border-r-0 flex-shrink-0",
                        isSameDay(day, new Date()) && "bg-primary/5"
                      )}
                      style={{ 
                        width: `${hours.length * hourSlotWidth}px`,
                      }}
                    >
                      {/* Day header */}
                      <div className="p-2 text-center border-b border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-500 font-medium">{format(day, "EEE")}</div>
                        <div className="text-sm font-semibold text-slate-900">{format(day, "d MMM")}</div>
                      </div>
                      {/* Time header - horizontal */}
                      <div className="flex">
                        {hours.map((hour) => (
                          <div
                            key={hour}
                            className="border-r border-slate-200 last:border-r-0 p-1.5 text-center flex-shrink-0"
                            style={{ 
                              width: `${hourSlotWidth}px`,
                            }}
                          >
                            <span className="text-xs text-slate-500 font-medium">
                              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar body with time horizontally and staff vertically */}
              {users.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No staff members found
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="border-b border-slate-200 last:border-b-0">
                    <div className="flex">
                      {/* Staff name column - sticky */}
                      <div className="w-48 border-r border-slate-200 p-3 bg-slate-50 sticky left-0 z-10 flex-shrink-0">
                        <div className="font-medium text-slate-900">{user.fullName}</div>
                        <div className="text-xs text-slate-500">{user.role}</div>
                      </div>

                      {/* Day columns with horizontal time */}
                      {dateRange.days.map((day) => {
                        const dayEntries = getEntriesForUserAndDay(user.id, day);
                        const dayStart = startOfDay(day);
                        
                        return (
                          <div
                            key={`${user.id}-${day.getTime()}`}
                            className="relative border-r border-slate-200 last:border-r-0 flex-shrink-0"
                            style={{ 
                              width: `${hours.length * hourSlotWidth}px`,
                            }}
                          >
                            {/* Time slots - horizontal */}
                            <div className="relative flex" style={{ height: "80px" }}>
                              {hours.map((hour) => {
                                const slotTime = new Date(day);
                                slotTime.setHours(hour, 0, 0, 0);
                                
                                return (
                                  <HourRow
                                    key={hour}
                                    hour={hour}
                                    userId={user.id}
                                    day={day}
                                    entries={dayEntries}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onAdd={(time) => {
                                      try {
                                        if (!time || isNaN(time.getTime())) {
                                          console.error("Invalid time provided:", time);
                                          toast({
                                            title: "Error",
                                            description: "Invalid time slot. Please try again.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        if (!user || !user.id || user.id === 0) {
                                          console.error("Invalid user:", user);
                                          toast({
                                            title: "Error",
                                            description: "Invalid staff member. Please try again.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        // Ensure we have valid data before opening dialog
                                        const validTime = new Date(time);
                                        if (isNaN(validTime.getTime())) {
                                          console.error("Invalid time after conversion:", time);
                                          toast({
                                            title: "Error",
                                            description: "Invalid time slot. Please try again.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        // Open schedule dialog for manual event creation
                                        console.log("Opening dialog for user:", user.id, "at time:", validTime);
                                        setSchedulingJob(null); // No job for manual creation
                                        setManualEventInitialTime(validTime);
                                        setManualEventInitialUserId(user.id);
                                        // Use a small delay to ensure state is set
                                        requestAnimationFrame(() => {
                                          setManualEventDialogOpen(true);
                                        });
                                      } catch (error) {
                                        console.error("Error in onAdd:", error);
                                        toast({
                                          title: "Error",
                                          description: "Failed to add event. Please try again.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    hourSlotWidth={hourSlotWidth}
                                  />
                                );
                              })}

                              {/* Event blocks */}
                              {dayEntries.map((entry) => (
                                <EventBlockHorizontal
                                  key={entry.id}
                                  entry={entry}
                                  dayStart={dayStart}
                                  jobs={jobs}
                                  onEdit={handleEdit}
                                  onDelete={handleDelete}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Jobs Panel - narrower to give more space to calendar */}
          <div className="w-64 border border-slate-200 rounded-lg bg-white flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Active Jobs
              </h2>
              <p className="text-xs text-slate-500 mt-1">Drag to assign to time slots</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeJobs.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8">
                  No active jobs available
                </div>
              ) : (
                activeJobs.map((job) => (
                  <DraggableJobCard key={job.id} job={job} onSchedule={handleScheduleJob} />
                ))
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {draggedJob && (
            <div className="p-3 rounded-lg border bg-white shadow-lg opacity-90">
              <div className="font-semibold text-sm">{draggedJob.jobId}</div>
              <div className="text-xs text-slate-600">{draggedJob.description.substring(0, 50)}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Event Form Dialog */}
      {dialogOpen && selectedUserId && selectedUserId > 0 && Array.isArray(jobs) && (
        <EventFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            try {
              if (!open) {
                // Closing dialog - reset state
                setDialogOpen(false);
                setEditingEntry(undefined);
                setSelectedUserId(null);
                setSelectedSlotTime(undefined);
              } else {
                setDialogOpen(open);
              }
            } catch (error) {
              console.error("Error in onOpenChange:", error);
              setDialogOpen(false);
              setError("Failed to manage dialog. Please refresh the page.");
            }
          }}
          entry={editingEntry && editingEntry.id && editingEntry.id > 0 ? editingEntry : undefined}
          userId={selectedUserId}
          startTime={selectedSlotTime}
          jobs={jobs || []}
          onSave={handleSave}
        />
      )}

      {/* Schedule Event Dialog - for job scheduling */}
      <ScheduleEventDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open);
          if (!open) {
            setSchedulingJob(null);
            setManualEventInitialTime(undefined);
            setManualEventInitialUserId(undefined);
          }
        }}
        job={schedulingJob}
        users={users}
        timeEntries={Array.isArray(timeEntries) ? timeEntries : []}
        onSave={handleScheduleSave}
        initialTime={schedulingJob ? manualEventInitialTime : undefined}
        initialUserId={schedulingJob ? manualEventInitialUserId : undefined}
      />

      {/* Schedule Event Dialog - for manual event creation */}
      <ScheduleEventDialog
        open={manualEventDialogOpen}
        onOpenChange={(open) => {
          setManualEventDialogOpen(open);
          if (!open) {
            setManualEventInitialTime(undefined);
            setManualEventInitialUserId(undefined);
          }
        }}
        job={null}
        users={users}
        timeEntries={Array.isArray(timeEntries) ? timeEntries : []}
        onSave={handleScheduleSave}
        initialTime={manualEventInitialTime}
        initialUserId={manualEventInitialUserId}
      />
    </div>
  );
}

