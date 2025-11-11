import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Tabs,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from '@/components/ui/tooltip';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  differenceInHours,
  differenceInMinutes,
  formatDistanceToNow,
  format,
  subDays,
  startOfDay,
  endOfDay
} from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  PhoneCall,
  UserCheck,
  Clock,
  CheckCircle,
  Plus,
  Calendar,
  FileText,
  Trash2,
  DownloadCloud,
  ShieldAlert,
  TrendingUp,
  Search,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const callbackFormSchema = z.object({
  customerName: z.string().min(2, {
    message: 'Customer name is required'
  }),
  phoneNumber: z.string().min(5, 'Phone number is required'),
  subject: z.string().min(3, 'Subject is required'),
  details: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'], {
    required_error: 'Priority is required'
  }),
  assignedTo: z.coerce.number({
    required_error: 'Assigned staff member is required'
  }),
  status: z.enum(['pending', 'completed']).default('pending')
});

type CallbackFormValues = z.infer<typeof callbackFormSchema>;

const notesFormSchema = z.object({
  notes: z.string().min(5, 'Please enter notes about the callback')
});

type NotesFormValues = z.infer<typeof notesFormSchema>;

type CallbackStatus = 'pending' | 'completed' | 'deleted';
type CallbackPriority = 'low' | 'medium' | 'high';
type SlaStatus = 'onTrack' | 'atRisk' | 'breached' | 'met' | 'unknown';

interface CallbackApiResponse {
  id: number;
  customerName: string;
  phoneNumber: string;
  subject: string;
  details?: string | null;
  priority?: CallbackPriority | null;
  status?: CallbackStatus | null;
  assignedTo?: number | string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
}

interface NormalizedCallback extends Omit<CallbackApiResponse, 'priority' | 'status' | 'assignedTo'> {
  priority: CallbackPriority;
  status: CallbackStatus;
  assignedTo: number | null;
  requestedAtDate: Date | null;
  completedAtDate: Date | null;
  resolutionMinutes: number | null;
  slaStatus: SlaStatus;
  isOverdue: boolean;
}

type SortOption = 'requestedAt-desc' | 'requestedAt-asc' | 'priority' | 'sla' | 'customer';

interface UserSummary {
  id: number;
  fullName: string;
}

const SLA_WARNING_HOURS = 24;
const SLA_BREACH_THRESHOLD_HOURS = 48;
const SLA_BREACH_THRESHOLD_MINUTES = SLA_BREACH_THRESHOLD_HOURS * 60;

const priorityRank: Record<CallbackPriority, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const slaRank: Record<SlaStatus, number> = {
  breached: 0,
  atRisk: 1,
  onTrack: 2,
  met: 3,
  unknown: 4
};

const SLA_STATUS_CONFIG: Record<SlaStatus, { label: string; description: string; className: string }> = {
  onTrack: {
    label: 'On Track',
    description: 'Callback is within the 24-hour responsiveness window.',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  },
  atRisk: {
    label: 'At Risk',
    description: 'Callback is older than 24 hours and needs attention soon.',
    className: 'bg-amber-50 text-amber-700 border border-amber-200'
  },
  breached: {
    label: 'Breached',
    description: 'Callback has exceeded the 48-hour SLA threshold and is escalated.',
    className: 'bg-red-50 text-red-700 border border-red-200'
  },
  met: {
    label: 'SLA Met',
    description: 'Callback was resolved within the 48-hour SLA target.',
    className: 'bg-sky-50 text-sky-700 border border-sky-200'
  },
  unknown: {
    label: 'SLA Pending',
    description: 'SLA status is unavailable for this callback.',
    className: 'bg-slate-50 text-slate-600 border border-slate-200'
  }
};

const DEFAULT_QUICK_FILTERS = {
  highPriority: false,
  slaRisk: false,
  slaBreached: false
} as const;

type QuickFilters = typeof DEFAULT_QUICK_FILTERS;
type QuickFilterKey = keyof QuickFilters;

const formatMinutesToLabel = (minutes: number | null) => {
  if (minutes === null) {
    return 'N/A';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
};

const sanitizeCsvValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Badge className="border border-red-200 bg-red-50 text-red-700">High</Badge>;
    case 'medium':
      return <Badge className="border border-amber-200 bg-amber-50 text-amber-700">Medium</Badge>;
    case 'low':
      return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">Low</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Pending</Badge>;
    case 'completed':
      return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
    case 'deleted':
      return <Badge className="bg-red-500 hover:bg-red-600">Deleted</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

const SlaBadge = ({ status }: { status: SlaStatus }) => {
  const config = SLA_STATUS_CONFIG[status] ?? SLA_STATUS_CONFIG.unknown;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn('px-2 py-0.5 text-xs font-medium capitalize', config.className)}
        >
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default function Callbacks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('pending');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCallback, setSelectedCallback] = useState<NormalizedCallback | null>(null);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [callbackToDelete, setCallbackToDelete] = useState<NormalizedCallback | null>(null);
  const [isViewDetailsDialogOpen, setIsViewDetailsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({ ...DEFAULT_QUICK_FILTERS });
  const [sortOption, setSortOption] = useState<SortOption>('requestedAt-desc');

  const [dateFilter, setDateFilter] = useState({
    from: startOfDay(subDays(new Date(), 31)),
    to: endOfDay(new Date())
  });

  const { data: callbacksData, isLoading } = useQuery({
    queryKey: [
      '/api/callbacks',
      selectedTab,
      user?.id,
      dateFilter.from.toISOString(),
      dateFilter.to.toISOString()
    ],
    queryFn: async () => {
      let url = '/api/callbacks';
      const params = new URLSearchParams();

      params.append('fromDate', dateFilter.from.toISOString());
      params.append('toDate', dateFilter.to.toISOString());

      if (selectedTab === 'assigned' && user?.id) {
        params.append('assignedTo', String(user.id));
      } else if (selectedTab === 'pending') {
        params.append('status', 'pending');
      } else if (selectedTab === 'completed') {
        params.append('status', 'completed');
      }

      url += `?${params.toString()}`;
      return apiRequest('GET', url);
    }
  });

  const { data: usersData } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('GET', '/api/users')
  });

  const callbacks = Array.isArray(callbacksData) ? (callbacksData as CallbackApiResponse[]) : [];
  const users = Array.isArray(usersData) ? (usersData as UserSummary[]) : [];

  const usersById = useMemo<Record<number, UserSummary>>(
    () =>
      users.reduce((acc, current) => {
        acc[current.id] = current;
        return acc;
      }, {} as Record<number, UserSummary>),
    [users]
  );

  const getAssigneeName = useCallback(
    (id: number | null | undefined) => {
      if (id === null || id === undefined || Number.isNaN(id)) {
        return 'Unassigned';
      }
      return usersById[id]?.fullName ?? 'Unassigned';
    },
    [usersById]
  );

  const normalizedCallbacks = useMemo<NormalizedCallback[]>(() => {
    const now = new Date();

    return callbacks.map((callback) => {
      const requestedAtDate = callback.requestedAt ? new Date(callback.requestedAt) : null;
      const completedAtDate = callback.completedAt ? new Date(callback.completedAt) : null;
      const rawAssignedTo = callback.assignedTo;
      const assignedTo =
        rawAssignedTo === null || rawAssignedTo === undefined
          ? null
          : typeof rawAssignedTo === 'string'
            ? Number.parseInt(rawAssignedTo, 10) || null
            : rawAssignedTo;

      const resolutionMinutes =
        requestedAtDate && completedAtDate
          ? Math.max(differenceInMinutes(completedAtDate, requestedAtDate), 0)
          : null;

      let slaStatus: SlaStatus = 'unknown';

      if (requestedAtDate) {
        if (callback.status === 'completed') {
          if (completedAtDate && resolutionMinutes !== null) {
            slaStatus =
              resolutionMinutes <= SLA_BREACH_THRESHOLD_MINUTES ? 'met' : 'breached';
          } else {
            slaStatus = 'unknown';
          }
        } else {
          const hoursSinceRequest = differenceInHours(now, requestedAtDate);
          if (hoursSinceRequest >= SLA_BREACH_THRESHOLD_HOURS) {
            slaStatus = 'breached';
          } else if (hoursSinceRequest >= SLA_WARNING_HOURS) {
            slaStatus = 'atRisk';
          } else {
            slaStatus = 'onTrack';
          }
        }
      }

      const isOverdue =
        callback.status === 'pending' &&
        requestedAtDate !== null &&
        differenceInHours(now, requestedAtDate) >= SLA_WARNING_HOURS;

      return {
        ...callback,
        priority: (callback.priority ?? 'medium') as CallbackPriority,
        status: (callback.status ?? 'pending') as CallbackStatus,
        assignedTo,
        requestedAtDate,
        completedAtDate,
        resolutionMinutes,
        slaStatus,
        isOverdue
      };
    });
  }, [callbacks]);

  useEffect(() => {
    if (!selectedCallback) {
      return;
    }

    const updated = normalizedCallbacks.find((callback) => callback.id === selectedCallback.id);
    if (updated && updated !== selectedCallback) {
      setSelectedCallback(updated);
    }
  }, [normalizedCallbacks, selectedCallback]);

  useEffect(() => {
    if (!callbackToDelete) {
      return;
    }

    const updated = normalizedCallbacks.find((callback) => callback.id === callbackToDelete.id);
    if (updated && updated !== callbackToDelete) {
      setCallbackToDelete(updated);
    }
  }, [normalizedCallbacks, callbackToDelete]);

  const metrics = useMemo(() => {
    const total = normalizedCallbacks.length;
    const pending = normalizedCallbacks.filter((callback) => callback.status === 'pending');
    const completed = normalizedCallbacks.filter((callback) => callback.status === 'completed');
    const highPriorityOpen = pending.filter((callback) => callback.priority === 'high');
    const slaAttention = normalizedCallbacks.filter(
      (callback) => callback.slaStatus === 'atRisk' || callback.slaStatus === 'breached'
    );
    const resolutionSamples = completed
      .map((callback) => callback.resolutionMinutes)
      .filter((minutes): minutes is number => minutes !== null);

    const averageResolutionMinutes =
      resolutionSamples.length > 0
        ? Math.round(
            resolutionSamples.reduce((sum, minutes) => sum + minutes, 0) /
              resolutionSamples.length
          )
        : null;

    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    return {
      total,
      openCount: pending.length,
      completedCount: completed.length,
      completionRate,
      atRiskCount: slaAttention.length,
      highPriorityOpen: highPriorityOpen.length,
      averageResolutionMinutes
    };
  }, [normalizedCallbacks]);

  const filteredCallbacks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return normalizedCallbacks.filter((callback) => {
      if (term.length > 0) {
        const haystack = [
          callback.customerName,
          callback.phoneNumber,
          callback.subject,
          callback.details ?? '',
          getAssigneeName(callback.assignedTo)
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(term)) {
          return false;
        }
      }

      if (quickFilters.highPriority && callback.priority !== 'high') {
        return false;
      }

      if (
        quickFilters.slaRisk &&
        !(callback.slaStatus === 'atRisk' || callback.slaStatus === 'breached')
      ) {
        return false;
      }

      if (quickFilters.slaBreached && callback.slaStatus !== 'breached') {
        return false;
      }

      return true;
    });
  }, [normalizedCallbacks, searchTerm, quickFilters, getAssigneeName]);

  const sortedCallbacks = useMemo(() => {
    const callbacksToSort = [...filteredCallbacks];

    callbacksToSort.sort((a, b) => {
      switch (sortOption) {
        case 'requestedAt-asc': {
          const aTime = a.requestedAtDate?.getTime() ?? 0;
          const bTime = b.requestedAtDate?.getTime() ?? 0;
          return aTime - bTime;
        }
        case 'priority': {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        case 'sla': {
          return slaRank[a.slaStatus] - slaRank[b.slaStatus];
        }
        case 'customer': {
          return a.customerName.localeCompare(b.customerName);
        }
        case 'requestedAt-desc':
        default: {
          const aTime = a.requestedAtDate?.getTime() ?? 0;
          const bTime = b.requestedAtDate?.getTime() ?? 0;
          return bTime - aTime;
        }
      }
    });

    return callbacksToSort;
  }, [filteredCallbacks, sortOption]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    Object.values(quickFilters).some(Boolean) ||
    sortOption !== 'requestedAt-desc';

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setQuickFilters({ ...DEFAULT_QUICK_FILTERS });
    setSortOption('requestedAt-desc');
  }, []);

  const handleExport = useCallback(() => {
    if (!sortedCallbacks.length) {
      toast({
        title: 'Nothing to export',
        description: 'Adjust filters or date range to include at least one callback.',
        variant: 'destructive'
      });
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      toast({
        title: 'Export unavailable',
        description: 'CSV export is only supported in the browser.',
        variant: 'destructive'
      });
      return;
    }

    const headers = [
      'ID',
      'Customer Name',
      'Phone Number',
      'Subject',
      'Priority',
      'Status',
      'Assigned To',
      'Requested At',
      'Completed At',
      'SLA Status',
      'Resolution (minutes)',
      'Notes'
    ];

    const rows = sortedCallbacks.map((callback) => [
      callback.id,
      callback.customerName,
      callback.phoneNumber,
      callback.subject ?? '',
      callback.priority,
      callback.status,
      getAssigneeName(callback.assignedTo),
      callback.requestedAtDate ? callback.requestedAtDate.toISOString() : '',
      callback.completedAtDate ? callback.completedAtDate.toISOString() : '',
      callback.slaStatus,
      callback.resolutionMinutes ?? '',
      callback.notes ?? ''
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(sanitizeCsvValue).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `callbacks-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export in progress',
      description: 'Your CSV download should begin shortly.'
    });
  }, [sortedCallbacks, getAssigneeName, toast]);

  const toggleQuickFilter = useCallback((key: QuickFilterKey) => {
    setQuickFilters((previous) => ({
      ...previous,
      [key]: !previous[key]
    }));
  }, []);

  const handleViewDetails = useCallback((callback: NormalizedCallback) => {
    setSelectedCallback(callback);
    setIsViewDetailsDialogOpen(true);
  }, []);

  const handleNotesDialogChange = useCallback(
    (open: boolean) => {
      setIsNotesDialogOpen(open);
      if (!open) {
        notesForm.reset();
      }
    },
    [notesForm]
  );

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    setIsDeleteConfirmDialogOpen(open);
    if (!open) {
      setCallbackToDelete(null);
    }
  }, []);

  const handleViewDialogChange = useCallback((open: boolean) => {
    setIsViewDetailsDialogOpen(open);
    if (!open) {
      setSelectedCallback(null);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: CallbackFormValues) => {
      return apiRequest('POST', '/api/callbacks', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Success',
        description: 'Callback request created successfully'
      });
      setIsCreateDialogOpen(false);
      form.reset();
      handleResetFilters();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create callback request',
        variant: 'destructive'
      });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      return apiRequest('POST', `/api/callbacks/${id}/complete`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Success',
        description: 'Callback request marked as completed'
      });
      setIsNotesDialogOpen(false);
      notesForm.reset();
      setSelectedCallback(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete callback request',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/callbacks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      toast({
        title: 'Success',
        description: 'Callback request has been permanently deleted'
      });
      setIsDeleteConfirmDialogOpen(false);
      setCallbackToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete callback request',
        variant: 'destructive'
      });
    }
  });

  const form = useForm<CallbackFormValues>({
    resolver: zodResolver(callbackFormSchema),
    defaultValues: {
      customerName: '',
      phoneNumber: '',
      subject: '',
      details: '',
      priority: 'medium',
      status: 'pending'
    }
  });

  const notesForm = useForm<NotesFormValues>({
    resolver: zodResolver(notesFormSchema),
    defaultValues: {
      notes: ''
    }
  });

  const onSubmit = (data: CallbackFormValues) => {
    createMutation.mutate(data);
  };

  const onNotesSubmit = (data: NotesFormValues) => {
    if (selectedCallback) {
      completeMutation.mutate({
        id: selectedCallback.id,
        notes: data.notes
      });
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Callbacks</h1>
            <p className="text-gray-600">
              Stay ahead of customer expectations with proactive follow-ups.
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center">
                <Plus size={18} className="mr-2" />
                New Callback
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Create New Callback Request</DialogTitle>
                <DialogDescription>
                  Fill in the details below to create a new customer callback request.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter customer name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="Callback subject" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Details</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter additional details about the callback request"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users?.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id.toString()}>
                                {staff.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creating...' : 'Create Callback'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open callbacks</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.openCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting action within current filters</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA attention</CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.atRiskCount}</div>
              <p className="text-xs text-muted-foreground">Callbacks at risk or in breach of SLA</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High priority open</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.highPriorityOpen}</div>
              <p className="text-xs text-muted-foreground">Requires senior response coordination</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completion health</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.completionRate}%</div>
              <Progress value={metrics.completionRate} className="mt-2 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                Avg resolution {formatMinutesToLabel(metrics.averageResolutionMinutes)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isNotesDialogOpen} onOpenChange={handleNotesDialogChange}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Complete Callback Request</DialogTitle>
              <DialogDescription>
                Add outcome notes before marking this callback as resolved.
              </DialogDescription>
            </DialogHeader>
            {selectedCallback && (
              <div className="rounded-md border border-muted/40 bg-muted/20 p-3 text-sm mb-4">
                <div className="font-semibold text-foreground">{selectedCallback.customerName}</div>
                <div className="mt-1 text-muted-foreground">{selectedCallback.subject}</div>
              </div>
            )}
            <Form {...notesForm}>
              <form onSubmit={notesForm.handleSubmit(onNotesSubmit)} className="space-y-4">
                <FormField
                  control={notesForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter details about the callback outcome"
                          {...field}
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleNotesDialogChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={completeMutation.isPending}>
                    {completeMutation.isPending ? 'Completing...' : 'Mark as Completed'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDetailsDialogOpen} onOpenChange={handleViewDialogChange}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Callback Details</DialogTitle>
              <DialogDescription>
                Review the full lifecycle of this callback, including SLA posture and notes.
              </DialogDescription>
            </DialogHeader>
            {selectedCallback && (
              <div className="space-y-5">
                <div className="grid gap-3 rounded-lg border border-muted/40 bg-muted/10 p-4 md:grid-cols-2">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Customer</span>
                    <div className="font-semibold text-foreground">{selectedCallback.customerName}</div>
                    <div className="text-sm text-muted-foreground">{selectedCallback.phoneNumber}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Subject</span>
                    <div className="font-medium text-foreground">{selectedCallback.subject}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                    <div className="mt-1">{getStatusBadge(selectedCallback.status)}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Priority</span>
                    <div className="mt-1">{getPriorityBadge(selectedCallback.priority)}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Assigned to</span>
                    <div className="mt-1">{getAssigneeName(selectedCallback.assignedTo)}</div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Requested</span>
                    <div className="mt-1">
                      {selectedCallback.requestedAtDate
                        ? format(selectedCallback.requestedAtDate, 'PPp')
                        : 'Unknown'}
                    </div>
                  </div>
                  {selectedCallback.completedAtDate && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Completed</span>
                      <div className="mt-1">
                        {format(selectedCallback.completedAtDate, 'PPp')}
                      </div>
                    </div>
                  )}
                  <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                    <SlaBadge status={selectedCallback.slaStatus} />
                    <span className="text-sm text-muted-foreground">
                      {SLA_STATUS_CONFIG[selectedCallback.slaStatus]?.description}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Aging</span>
                    <div className="mt-1 text-sm text-foreground">
                      {selectedCallback.requestedAtDate
                        ? formatDistanceToNow(selectedCallback.requestedAtDate, { addSuffix: true })
                        : 'Unknown'}
                    </div>
                  </div>
                  {selectedCallback.resolutionMinutes !== null && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Resolution time</span>
                      <div className="mt-1 text-sm text-foreground">
                        {formatMinutesToLabel(selectedCallback.resolutionMinutes)}
                      </div>
                    </div>
                  )}
                </div>

                {selectedCallback.details && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Details</h4>
                    <p className="text-sm whitespace-pre-wrap rounded-md border border-muted/40 bg-white p-3 text-muted-foreground">
                      {selectedCallback.details}
                    </p>
                  </div>
                )}

                {selectedCallback.notes && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Completion notes</h4>
                    <p className="text-sm whitespace-pre-wrap rounded-md border border-emerald-100 bg-emerald-50/70 p-3 text-emerald-900">
                      {selectedCallback.notes}
                    </p>
                  </div>
                )}

                {selectedCallback.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex items-center gap-1.5"
                      onClick={() => {
                        handleViewDialogChange(false);
                        setSelectedCallback(selectedCallback);
                        setIsNotesDialogOpen(true);
                      }}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark Complete
                    </Button>
                    <Button
                      variant="outline"
                      className="flex items-center gap-1.5 text-destructive"
                      onClick={() => {
                        handleViewDialogChange(false);
                        setCallbackToDelete(selectedCallback);
                        setIsDeleteConfirmDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleViewDialogChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-2">
                <CardTitle className="text-lg font-semibold text-neutral-800">Callback Requests</CardTitle>
                <CardDescription>
                  Filter, prioritize, and action callback requests to maintain best-in-class response times.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  disabled={!hasActiveFilters}
                  className="flex items-center gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isLoading || sortedCallbacks.length === 0}
                  className="flex items-center gap-1.5"
                >
                  <DownloadCloud className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full lg:min-w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by customer, subject, phone, or assignee..."
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    {
                      key: 'highPriority' as const,
                      label: 'High priority',
                      icon: ShieldAlert,
                      tooltip: 'Show only callbacks flagged as high priority.',
                      activeClassName: 'border-red-500 bg-red-500 text-white hover:bg-red-500/90'
                    },
                    {
                      key: 'slaRisk' as const,
                      label: 'SLA at risk',
                      icon: Clock,
                      tooltip: 'Highlight callbacks older than 24 hours (at risk or breached).',
                      activeClassName: 'border-amber-500 bg-amber-500 text-white hover:bg-amber-500/90'
                    },
                    {
                      key: 'slaBreached' as const,
                      label: 'SLA breached',
                      icon: AlertTriangle,
                      tooltip: 'Show callbacks exceeding the 48-hour SLA threshold.',
                      activeClassName: 'border-red-600 bg-red-600 text-white hover:bg-red-600/90'
                    }
                  ]).map(({ key, label, icon: Icon, tooltip, activeClassName }) => (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleQuickFilter(key)}
                          className={cn(
                            'flex items-center gap-1.5',
                            quickFilters[key] && activeClassName
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Sort</span>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requestedAt-desc">Newest first</SelectItem>
                    <SelectItem value="requestedAt-asc">Oldest first</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="sla">SLA posture</SelectItem>
                    <SelectItem value="customer">Customer name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-muted/40 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <Calendar className="h-4 w-4 text-neutral-500" />
                <span>Filter by requested date</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFilter.from.toISOString().split('T')[0]}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      setDateFilter((previous) => ({
                        ...previous,
                        from: startOfDay(new Date(value))
                      }));
                    }}
                    className="w-auto"
                  />
                  <span className="text-sm text-neutral-500">to</span>
                  <Input
                    type="date"
                    value={dateFilter.to.toISOString().split('T')[0]}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      setDateFilter((previous) => ({
                        ...previous,
                        to: endOfDay(new Date(value))
                      }));
                    }}
                    className="w-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateFilter({
                        from: startOfDay(subDays(new Date(), 7)),
                        to: endOfDay(new Date())
                      })
                    }
                    className="text-xs"
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateFilter({
                        from: startOfDay(subDays(new Date(), 31)),
                        to: endOfDay(new Date())
                      })
                    }
                    className="text-xs"
                  >
                    Last 31 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateFilter({
                        from: startOfDay(subDays(new Date(), 90)),
                        to: endOfDay(new Date())
                      })
                    }
                    className="text-xs"
                  >
                    Last 90 days
                  </Button>
                </div>
              </div>
            </div>

            <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value)} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All Callbacks</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-muted/60 border-t-primary animate-spin" />
                <div className="text-sm font-medium text-muted-foreground">Loading callbacks...</div>
              </div>
            ) : sortedCallbacks.length === 0 ? (
              <div className="text-center p-10">
                <PhoneCall className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-base font-semibold text-foreground">No callback requests</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTab === 'all'
                    ? 'There are no callback requests within the selected filters.'
                    : selectedTab === 'assigned'
                      ? 'You have no callback requests assigned right now.'
                      : selectedTab === 'pending'
                        ? 'There are no pending callback requests within this timeframe.'
                        : selectedTab === 'completed'
                          ? 'No completed callback requests match the current filters.'
                          : 'There are no callback requests to review.'}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Callback Request
                  </Button>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      onClick={handleResetFilters}
                      className="flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Aging &amp; SLA</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCallbacks.map((callback) => (
                      <TableRow
                        key={callback.id}
                        className={cn(
                          'transition-colors hover:bg-muted/40',
                          callback.slaStatus === 'breached' && 'bg-red-50/80 dark:bg-red-950/30',
                          callback.slaStatus === 'atRisk' && 'bg-amber-50/80 dark:bg-amber-950/30',
                          callback.priority === 'high' && 'border-l-4 border-red-400'
                        )}
                      >
                        <TableCell>
                          <button
                            type="button"
                            className="flex flex-col text-left"
                            onClick={() => handleViewDetails(callback)}
                          >
                            <span className="font-medium text-foreground hover:text-primary hover:underline">
                              {callback.customerName}
                            </span>
                            <span className="text-sm text-muted-foreground">{callback.phoneNumber}</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="flex flex-col text-left"
                            onClick={() => handleViewDetails(callback)}
                          >
                            <span className="line-clamp-1 font-medium text-foreground hover:text-primary hover:underline">
                              {callback.subject}
                            </span>
                            {callback.details && (
                              <span className="line-clamp-1 text-sm text-muted-foreground">
                                {callback.details}
                              </span>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span>{getAssigneeName(callback.assignedTo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center text-sm text-foreground">
                              <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                              <span title={callback.requestedAtDate?.toISOString()}>
                                {callback.requestedAtDate
                                  ? format(callback.requestedAtDate, 'dd/MM/yyyy HH:mm')
                                  : 'Unknown'}
                              </span>
                            </div>
                            {callback.completedAtDate && (
                              <span className="text-xs text-muted-foreground">
                                Resolved {format(callback.completedAtDate, 'dd/MM/yyyy HH:mm')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>
                                {callback.requestedAtDate
                                  ? formatDistanceToNow(callback.requestedAtDate, { addSuffix: true })
                                  : 'Unknown'}
                              </span>
                            </div>
                            <SlaBadge status={callback.slaStatus} />
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(callback.priority)}</TableCell>
                        <TableCell>{getStatusBadge(callback.status)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {callback.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1.5"
                                onClick={() => {
                                  setSelectedCallback(callback);
                                  setIsNotesDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                                Complete
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1.5"
                              onClick={() => handleViewDetails(callback)}
                            >
                              <FileText className="h-4 w-4" />
                              View details
                            </Button>
                            {callback.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1.5 text-destructive"
                                onClick={() => {
                                  setCallbackToDelete(callback);
                                  setIsDeleteConfirmDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={handleDeleteDialogChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete this callback request? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {callbackToDelete && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium text-muted-foreground">Customer</div>
                  <div className="font-medium text-foreground">{callbackToDelete.customerName}</div>
                  <div className="text-muted-foreground">Phone</div>
                  <div>{callbackToDelete.phoneNumber}</div>
                  <div className="text-muted-foreground">Subject</div>
                  <div>{callbackToDelete.subject}</div>
                  <div className="text-muted-foreground">Priority</div>
                  <div>{getPriorityBadge(callbackToDelete.priority)}</div>
                  <div className="text-muted-foreground">Requested</div>
                  <div>
                    {callbackToDelete.requestedAtDate
                      ? format(callbackToDelete.requestedAtDate, 'PPp')
                      : 'Unknown'}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleDeleteDialogChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (callbackToDelete) {
                    deleteMutation.mutate(callbackToDelete.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete permanently
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
