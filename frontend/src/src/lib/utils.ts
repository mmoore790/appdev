import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format, parseISO, differenceInCalendarDays, startOfDay } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    // Handle database timestamps that might not have timezone info
    let date;
    if (dateString.includes('T') || dateString.includes('Z')) {
      // ISO format with timezone
      date = parseISO(dateString);
    } else {
      // Database timestamp without timezone - treat as UTC and convert to local
      date = parseISO(dateString + 'Z');
    }
    return format(date, "MMM d, yyyy");
  } catch (error) {
    return "Invalid date";
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    // Handle database timestamps that might not have timezone info
    let date;
    if (dateString.includes('T') || dateString.includes('Z')) {
      // ISO format with timezone
      date = parseISO(dateString);
    } else {
      // Database timestamp without timezone - treat as UTC and convert to local
      date = parseISO(dateString + 'Z');
    }
    return format(date, "MMM d, yyyy h:mm a");
  } catch (error) {
    return "Invalid date";
  }
}

export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch (error) {
    return "Invalid date";
  }
}

export type DueDateTone = "muted" | "warning" | "danger" | "success";

export interface DueDateMeta {
  label: string;
  tone: DueDateTone;
  daysUntil: number | null;
}

export function getDueDateMeta(dueDate: string | Date | null | undefined): DueDateMeta {
  if (!dueDate) {
    return { label: "No due date", tone: "muted", daysUntil: null };
  }

  const today = startOfDay(new Date());
  const due =
    typeof dueDate === "string"
      ? startOfDay(new Date(dueDate))
      : dueDate instanceof Date
        ? startOfDay(dueDate)
        : null;

  if (!due || Number.isNaN(due.getTime())) {
    return { label: "Invalid due date", tone: "danger", daysUntil: null };
  }

  const diff = differenceInCalendarDays(due, today);

  if (diff === 0) {
    return { label: "Due today", tone: "warning", daysUntil: 0 };
  }

  if (diff < 0) {
    const daysOverdue = Math.abs(diff);
    return {
      label: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
      tone: "danger",
      daysUntil: diff
    };
  }

  if (diff === 1) {
    return { label: "Due tomorrow", tone: "warning", daysUntil: diff };
  }

  if (diff <= 7) {
    return { label: `Due ${format(due, "EEEE")}`, tone: "warning", daysUntil: diff };
  }

  return { label: `Due in ${diff} days`, tone: "muted", daysUntil: diff };
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount / 100); // Assuming amount is stored in cents
}

export function getStatusColor(status: string): {
  bgColor: string;
  textColor: string;
} {
  switch (status) {
    case 'completed':
      return { bgColor: 'bg-green-600', textColor: 'text-white' };
    case 'in_progress':
      return { bgColor: 'bg-amber-500', textColor: 'text-white' };
    case 'waiting_assessment':
      return { bgColor: 'bg-red-600', textColor: 'text-white' };
    default:
      return { bgColor: 'bg-gray-500', textColor: 'text-white' };
  }
}

export function getTaskPriorityColor(priority: string): {
  bgColor: string;
  textColor: string;
} {
  switch (priority) {
    case 'high':
      return { bgColor: 'bg-red-600', textColor: 'text-white' };
    case 'medium':
      return { bgColor: 'bg-amber-500', textColor: 'text-white' };
    case 'low':
      return { bgColor: 'bg-blue-600', textColor: 'text-white' };
    default:
      return { bgColor: 'bg-gray-500', textColor: 'text-white' };
  }
}

export async function generateJobId(): Promise<string> {
  try {
    // Use the new sequential job ID generation API endpoint
    const response = await fetch('/api/generate-job-id');
    if (!response.ok) {
      throw new Error(`API response not ok: ${response.status}`);
    }
    
    const data = await response.json();
    return data.jobId;
  } catch (error) {
    console.error('Error generating job ID:', error);
    // Don't use fallback - throw error to force retry
    // The API endpoint should always work, so if it fails, we want to know about it
    throw new Error('Failed to generate job ID. Please try again.');
  }
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
