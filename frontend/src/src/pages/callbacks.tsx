import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  TabsContent, 
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatDistanceToNow, format, subDays, addDays, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { 
  PhoneCall, 
  UserCheck, 
  PhoneForwarded, 
  Clock, 
  CheckCircle, 
  Plus, 
  Calendar, 
  AlertCircle, 
  FileText,
  Trash2,
  RotateCcw,
  ArchiveX,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Eye,
  Link as LinkIcon
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CustomerForm } from '@/components/customer-form';
import { Mail, Phone, MapPin, FileText as FileTextIcon, User } from 'lucide-react';

// Form schema for creating/editing a callback request
const callbackFormSchema = z.object({
  customerId: z.coerce.number().optional(),
  customerName: z.string().min(2, {
    message: "Customer name is required"
  }),
  phoneNumber: z.string().min(5, "Phone number is required"),
  subject: z.string().min(3, "Subject is required"),
  details: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'], {
    required_error: "Priority is required"
  }),
  assignedTo: z.coerce.number().optional().nullable(),
  status: z.enum(['pending', 'completed']).default('pending')
});

type CallbackFormValues = z.infer<typeof callbackFormSchema>;

// Comprehensive callback completion schema with follow-on actions
const callbackCompletionSchema = z.object({
  outcome: z.enum(['contacted', 'no_answer', 'voicemail', 'wrong_number', 'resolved', 'needs_followup', 'needs_job', 'needs_quote']),
  notes: z.string().min(5, "Please enter notes about the callback"),
  followUpDate: z.string().optional(),
  followUpTime: z.string().optional(),
  createTask: z.boolean().default(false),
  scheduleAppointment: z.boolean().default(false),
  jobDescription: z.string().optional(),
  taskDescription: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional()
}).superRefine((data, ctx) => {
  // Require job description when outcome is needs_job
  if (data.outcome === 'needs_job') {
    if (!data.jobDescription || data.jobDescription.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jobDescription'],
        message: "Job description is required and must be at least 10 characters when creating a job"
      });
    }
  }
  // Require follow-up date when outcome is needs_followup
  if (data.outcome === 'needs_followup' && !data.followUpDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['followUpDate'],
      message: "Follow-up date is required when scheduling a follow-up call"
    });
  }
});

type CallbackCompletionValues = z.infer<typeof callbackCompletionSchema>;

// Get priority badge
const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-500 hover:bg-red-600">High</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
    case 'low':
      return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

// Get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Pending</Badge>;
    case 'scheduled':
      return <Badge className="bg-purple-500 hover:bg-purple-600">Scheduled</Badge>;
    case 'completed':
      return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
    case 'deleted':
      return <Badge className="bg-red-500 hover:bg-red-600">Deleted</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

type SortField = 'customerName' | 'subject' | 'requestedAt' | 'priority' | 'status';
type SortDirection = 'asc' | 'desc';

export default function Callbacks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('pending');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCallback, setSelectedCallback] = useState<any>(null);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [callbackToDelete, setCallbackToDelete] = useState<any>(null);
  const [isViewDetailsDialogOpen, setIsViewDetailsDialogOpen] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('requestedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  
  // Customer selection state for form
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Debounce customer search so we hit the API after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerSearch(customerSearchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [customerSearchQuery]);
  
  // Customer creation and view dialogs
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [isViewCustomerDialogOpen, setIsViewCustomerDialogOpen] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState<number | null>(null);
  
  // Job creation dialog state
  const [isCreateJobDialogOpen, setIsCreateJobDialogOpen] = useState(false);
  
  // Helper function to extract original callback ID from details
  const getOriginalCallbackId = (callback: any): number | null => {
    if (!callback?.details) return null;
    // Look for pattern like "callback #123" in the details
    const match = callback.details.match(/callback #(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };
  
  // Get original callback ID from selected callback
  const originalCallbackId = selectedCallback ? getOriginalCallbackId(selectedCallback) : null;
  
  // Fetch original callback from API if not found locally
  const { data: fetchedOriginalCallback, isLoading: isLoadingOriginal } = useQuery({
    queryKey: ['/api/callbacks', originalCallbackId],
    queryFn: () => apiRequest('GET', `/api/callbacks/${originalCallbackId}`),
    enabled: !!originalCallbackId && isViewDetailsDialogOpen
  });
  
  // Date filter state - only used for "completed" and "all" tabs
  const [dateFilter, setDateFilter] = useState({
    from: startOfDay(subDays(new Date(), 31)),
    to: endOfDay(new Date())
  });

  // Get effective date range based on selected tab
  // Only apply date filters for "completed" and "all" tabs
  const effectiveDateRange = useMemo(() => {
    if (selectedTab === 'completed' || selectedTab === 'all') {
      return dateFilter;
    }
    // For pending, scheduled, and assigned tabs - no date filter (show all)
    return {
      from: startOfDay(new Date(0)), // Very old date to include all
      to: endOfDay(addDays(new Date(), 365)) // Far future to include all
    };
  }, [selectedTab, dateFilter]);

  // Query for ALL callbacks (for stats calculation) - refetches automatically
  const { data: allCallbacksData } = useQuery({
    queryKey: ['/api/callbacks', 'all'],
    queryFn: async () => {
      // Fetch all callbacks without filters for stats
      return apiRequest('GET', '/api/callbacks');
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Query for callbacks based on selected tab and date filter
  // NOTE: Cache key does NOT include user?.id because all users in the same business should see the same data
  const { data: callbacksData, isLoading } = useQuery({
    queryKey: ['/api/callbacks', selectedTab, effectiveDateRange.from.toISOString(), effectiveDateRange.to.toISOString()],
    queryFn: async () => {
      let url = '/api/callbacks';
      const params = new URLSearchParams();
      
      // Only add date filter parameters for "completed" and "all" tabs
      if (selectedTab === 'completed' || selectedTab === 'all') {
        params.append('fromDate', effectiveDateRange.from.toISOString());
        params.append('toDate', effectiveDateRange.to.toISOString());
      }
      
      if (selectedTab === 'assigned' && user?.id) {
        // For "My Callbacks" tab, show both assigned to user AND unassigned callbacks
        // We'll filter unassigned in the frontend since the API doesn't support this directly
        // For now, we'll get all pending callbacks and filter in frontend
        // Don't add assignedTo filter here - we'll handle it in the component
      } else if (selectedTab === 'pending') {
        params.append('status', 'pending');
      } else if (selectedTab === 'scheduled') {
        // For scheduled, get all pending callbacks - we'll filter by date in component
        params.append('status', 'pending');
      } else if (selectedTab === 'completed') {
        params.append('status', 'completed');
      }
      // For "all" tab, don't filter by status - show all callbacks
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      return apiRequest('GET', url);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Query for users (for the assignee dropdown)
  const { data: usersData } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('GET', '/api/users')
  });

  // Query for customers (used in completion flow when creating job from callback; larger limit to match by name/phone)
  const { data: customersData } = useQuery<{ data?: any[] }>({
    queryKey: ['/api/customers', 'list', '500'],
    queryFn: () => apiRequest('GET', '/api/customers?page=1&limit=500')
  });

  // Server-side customer search for create-callback dropdown (searches the database)
  const buildCustomersQueryParams = (search: string) => {
    const params = new URLSearchParams({ page: '1', limit: '25' });
    if (search) params.set('search', search);
    return params.toString();
  };
  const { data: customersSearchResult, isLoading: isCustomersSearchLoading } = useQuery<{ data?: any[] }>({
    queryKey: ['/api/customers', 'search', debouncedCustomerSearch],
    queryFn: () => apiRequest('GET', `/api/customers?${buildCustomersQueryParams(debouncedCustomerSearch)}`),
    enabled: isCreateDialogOpen,
  });
  const searchCustomers = Array.isArray(customersSearchResult?.data) ? customersSearchResult.data : [];

  const callbacks = Array.isArray(callbacksData) ? callbacksData : [];
  const allCallbacks = Array.isArray(allCallbacksData) ? allCallbacksData : [];
  const users = Array.isArray(usersData) ? usersData : [];
  const customers = Array.isArray(customersData?.data) ? customersData.data : (Array.isArray(customersData) ? customersData : []);

  // Create callback mutation
  const createMutation = useMutation({
    mutationFn: async (data: CallbackFormValues) => {
      return apiRequest('POST', '/api/callbacks', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Success',
        description: 'Callback request created successfully',
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create callback request',
        variant: 'destructive',
      });
    }
  });

  // Complete callback mutation
  const completeMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number, notes: string }) => {
      return apiRequest('POST', `/api/callbacks/${id}/complete`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Success',
        description: 'Callback request marked as completed',
      });
      setIsNotesDialogOpen(false);
      completionForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete callback request',
        variant: 'destructive',
      });
    }
  });
  
  // Update callback mutation (for claiming/unassigning)
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PUT', `/api/callbacks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      toast({
        title: 'Success',
        description: 'Callback updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update callback',
        variant: 'destructive',
      });
    }
  });

  // Claim callback mutation (assign to current user)
  const claimCallback = (callbackId: number) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to claim a callback',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate({
      id: callbackId,
      data: { assignedTo: user.id }
    });
  };

  // Delete callback mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/callbacks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      toast({
        title: 'Success',
        description: 'Callback request has been permanently deleted',
      });
      setIsDeleteConfirmDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete callback request',
        variant: 'destructive',
      });
    }
  });

  // Setup form for creating/editing callback requests
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

  // Setup form for comprehensive callback completion
  const completionForm = useForm<CallbackCompletionValues>({
    resolver: zodResolver(callbackCompletionSchema),
    defaultValues: {
      outcome: 'contacted',
      notes: '',
      createTask: false,
      scheduleAppointment: false
    }
  });

  // Query for jobs (for linking callbacks to jobs)
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: () => apiRequest('GET', '/api/jobs')
  });

  const jobs = Array.isArray(jobsData) ? jobsData : [];

  // Filtered and sorted callbacks
  const filteredAndSortedCallbacks = useMemo(() => {
    let filtered = [...callbacks];

    // Filter by scheduled status if on scheduled tab
    if (selectedTab === 'scheduled') {
      const now = new Date();
      filtered = filtered.filter((cb: any) => {
        const requestedAt = cb.requestedAt ? new Date(cb.requestedAt) : null;
        // Show callbacks scheduled for future dates
        return requestedAt && requestedAt > now;
      });
    } else if (selectedTab === 'pending') {
      // For pending tab, exclude scheduled (future) callbacks
      const now = new Date();
      filtered = filtered.filter((cb: any) => {
        const requestedAt = cb.requestedAt ? new Date(cb.requestedAt) : null;
        return !requestedAt || requestedAt <= now;
      });
    } else if (selectedTab === 'assigned') {
      // For "My Callbacks" tab, show callbacks assigned to current user OR unassigned
      if (user?.id) {
        filtered = filtered.filter((cb: any) => 
          cb.assignedTo === user.id || !cb.assignedTo
        );
      } else {
        // If no user, show only unassigned
        filtered = filtered.filter((cb: any) => !cb.assignedTo);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((cb: any) => 
        cb.customerName?.toLowerCase().includes(query) ||
        cb.subject?.toLowerCase().includes(query) ||
        cb.phoneNumber?.includes(query) ||
        cb.details?.toLowerCase().includes(query)
      );
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((cb: any) => cb.priority === priorityFilter);
    }

    // Apply assignee filter
    if (assigneeFilter !== 'all') {
      filtered = filtered.filter((cb: any) => cb.assignedTo === parseInt(assigneeFilter));
    }

    // Apply sorting
    filtered.sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'customerName':
          aVal = a.customerName?.toLowerCase() || '';
          bVal = b.customerName?.toLowerCase() || '';
          break;
        case 'subject':
          aVal = a.subject?.toLowerCase() || '';
          bVal = b.subject?.toLowerCase() || '';
          break;
        case 'requestedAt':
          aVal = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
          bVal = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [callbacks, selectedTab, searchQuery, priorityFilter, assigneeFilter, sortField, sortDirection]);

  // Handle form submission for creating a callback
  function onSubmit(data: CallbackFormValues) {
    createMutation.mutate(data);
  }

  // Generate job ID
  const generateJobId = async (): Promise<string> => {
    try {
      const response = await apiRequest('GET', '/api/generate-job-id') as { jobId?: string };
      return response.jobId || '';
    } catch (error) {
      console.error('Failed to generate job ID:', error);
      return '';
    }
  };

  // Handle comprehensive callback completion
  const handleCallbackCompletion = async (data: CallbackCompletionValues) => {
    if (!selectedCallback) return;

    try {
      // Complete the callback with notes
      await completeMutation.mutateAsync({
        id: selectedCallback.id,
        notes: `${data.outcome === 'contacted' ? '✓ Contacted' : 
                 data.outcome === 'no_answer' ? '✗ No Answer' :
                 data.outcome === 'voicemail' ? '📞 Voicemail' :
                 data.outcome === 'wrong_number' ? '✗ Wrong Number' :
                 data.outcome === 'resolved' ? '✓ Resolved' :
                 data.outcome === 'needs_followup' ? '🔄 Needs Follow-up' :
                 data.outcome === 'needs_job' ? '🔧 Needs Job' :
                 '💬 Needs Quote'}: ${data.notes}`
      });

      // Handle follow-on actions
      // If needs_job, automatically create a job
      if (data.outcome === 'needs_job' && data.jobDescription) {
        try {
          // Get or create customer
          let customerId = selectedCallback.customerId;
          
          // If no customer ID, try to find or create customer
          if (!customerId) {
            const existingCustomer = customers.find((c: any) => 
              c.name?.toLowerCase() === selectedCallback.customerName?.toLowerCase() ||
              c.phone === selectedCallback.phoneNumber
            );
            
            if (existingCustomer) {
              customerId = existingCustomer.id;
            } else {
              // Create new customer
              const newCustomer = await apiRequest('POST', '/api/customers', {
                name: selectedCallback.customerName,
                phone: selectedCallback.phoneNumber,
                email: null
              }) as { id: number };
              customerId = newCustomer.id;
            }
          }

          // Generate job ID
          const jobId = await generateJobId();
          
          // Create the job
          const jobData = {
            jobId,
            customerId,
            equipmentDescription: data.jobDescription.split('\n')[0] || 'Equipment from callback',
            description: data.jobDescription,
            status: 'waiting_assessment',
            assignedTo: selectedCallback.assignedTo || user?.id || undefined,
            priority: selectedCallback.priority === 'high' ? 'high' : 'medium'
          };

          const newJob = await apiRequest('POST', '/api/jobs', jobData);
          
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
          // Refetch both jobs and analytics to immediately update dashboard charts
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['/api/jobs'] }),
            queryClient.refetchQueries({ queryKey: ['/api/analytics/summary'] })
          ]);
          
          toast({
            title: 'Job Created',
            description: `Job ${jobId} has been created from this callback.`,
          });
        } catch (error: any) {
          console.error('Failed to create job:', error);
          toast({
            title: 'Error Creating Job',
            description: error.message || 'Failed to create job. Please create it manually.',
            variant: 'destructive',
          });
        }
      }

      if (data.createTask && data.taskDescription) {
        // Create a task
        try {
          await apiRequest('POST', '/api/tasks', {
            title: `Follow-up from callback: ${selectedCallback.subject}`,
            description: data.taskDescription,
            priority: selectedCallback.priority,
            assignedTo: selectedCallback.assignedTo || user?.id || undefined,
            status: 'pending'
          });
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          toast({
            title: 'Task Created',
            description: 'A follow-up task has been created.',
          });
        } catch (error: any) {
          console.error('Failed to create task:', error);
          toast({
            title: 'Error Creating Task',
            description: error.message || 'Failed to create task.',
            variant: 'destructive',
          });
        }
      }

      // If needs follow-up, create a new scheduled callback
      if (data.outcome === 'needs_followup' && data.followUpDate) {
        try {
          const followUpDateTime = new Date(`${data.followUpDate}T${data.followUpTime || '09:00'}`);
          
          // Create a new callback scheduled for the future
          const followUpCallback = {
            customerName: selectedCallback.customerName,
            phoneNumber: selectedCallback.phoneNumber,
            customerId: selectedCallback.customerId,
            subject: `Follow-up: ${selectedCallback.subject}`,
            details: `Scheduled follow-up from callback #${selectedCallback.id}. ${data.notes}`,
            priority: selectedCallback.priority,
            assignedTo: selectedCallback.assignedTo || undefined,
            status: 'pending'
          };

          // Create the callback first
          const newCallback = await apiRequest('POST', '/api/callbacks', followUpCallback) as { id: number };
          
          // Then update it with the scheduled date
          await apiRequest('PUT', `/api/callbacks/${newCallback.id}`, {
            requestedAt: followUpDateTime.toISOString()
          });

          queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
          
          toast({
            title: 'Follow-up Scheduled',
            description: `Follow-up callback scheduled for ${format(followUpDateTime, 'PPp')}. It will appear in the Scheduled tab.`,
          });
        } catch (error: any) {
          console.error('Failed to create follow-up callback:', error);
          toast({
            title: 'Error Scheduling Follow-up',
            description: error.message || 'Failed to schedule follow-up callback.',
            variant: 'destructive',
          });
        }
      }

      setIsNotesDialogOpen(false);
      completionForm.reset();
    } catch (error) {
      console.error('Error completing callback:', error);
    }
  };

  // Toggle sort direction
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // searchCustomers comes from server-side search (useQuery above); no client-side filter needed

  // Close customer dropdown when clicking outside
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Note: All these handlers have been replaced with inline functions in the button components
  
  // These functions have been replaced with inline functions in the dialog buttons

  // Calculate stats from ALL callbacks (not just filtered ones) - updates live
  const stats = useMemo(() => {
    const now = new Date();
    // Use allCallbacks for stats calculation so metrics are always accurate
    const callbacksForStats = allCallbacks.length > 0 ? allCallbacks : callbacks;
    
    const pendingCount = callbacksForStats.filter((cb: any) => {
      const requestedAt = cb.requestedAt ? new Date(cb.requestedAt) : null;
      return cb.status === 'pending' && (!requestedAt || requestedAt <= now);
    }).length;
    const scheduledCount = callbacksForStats.filter((cb: any) => {
      const requestedAt = cb.requestedAt ? new Date(cb.requestedAt) : null;
      return cb.status === 'pending' && requestedAt && requestedAt > now;
    }).length;
    const completedCount = callbacksForStats.filter((cb: any) => cb.status === 'completed').length;
    const assignedCount = callbacksForStats.filter((cb: any) => 
      cb.status === 'pending' && (cb.assignedTo === user?.id || !cb.assignedTo)
    ).length;
    
    return { pendingCount, scheduledCount, completedCount, assignedCount };
  }, [allCallbacks, callbacks, user?.id]);

  return (
    <div className="container mx-auto py-2 sm:py-3 px-2 sm:px-3 max-w-[1920px]">
      {/* Header - matches Customers / Tasks */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 text-foreground">
            <PhoneCall className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">Customer Callbacks</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">Manage and track all customer callback requests</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              form.reset();
              setCustomerSearchQuery('');
              setSelectedCustomerId(null);
              setShowCustomerDropdown(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 text-xs sm:text-sm">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">New Callback</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards - matches site Card style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">To Do</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground truncate">{stats.pendingCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted flex-shrink-0 ml-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Scheduled</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground truncate">{stats.scheduledCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted flex-shrink-0 ml-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Assigned to Me</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground truncate">{stats.assignedCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted flex-shrink-0 ml-2">
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            form.reset();
            setCustomerSearchQuery('');
            setSelectedCustomerId(null);
            setShowCustomerDropdown(false);
          }
        }}>
          <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Create new callback</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Search for a customer or enter a new name. Callback requests are stored and can be completed from this page.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormItem>
                  <FormLabel className="text-sm">Customer</FormLabel>
                  <div className="relative" ref={customerDropdownRef}>
                    <Input
                      placeholder="Search for customer or enter new name..."
                      value={customerSearchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomerSearchQuery(value);
                        setShowCustomerDropdown(true);
                        // Update form field with the typed value
                        form.setValue('customerName', value);
                        if (!value) {
                          form.setValue('customerId', undefined);
                          form.setValue('customerName', '');
                          setSelectedCustomerId(null);
                        } else {
                          // If user is typing and no customer is selected, clear customerId
                          if (!selectedCustomerId) {
                            form.setValue('customerId', undefined);
                          }
                        }
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => {
                        // Keep dropdown open briefly to allow clicking on items
                        setTimeout(() => setShowCustomerDropdown(false), 200);
                      }}
                      className="h-9 text-sm"
                    />
                    {customerSearchQuery && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => {
                          setCustomerSearchQuery('');
                          setSelectedCustomerId(null);
                          form.setValue('customerId', undefined);
                          form.setValue('customerName', '');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {showCustomerDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                        {isCustomersSearchLoading ? (
                          <div className="px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-transparent" />
                            Searching customers...
                          </div>
                        ) : searchCustomers.length > 0 ? (
                          <>
                            {searchCustomers.map((customer: any) => (
                              <div
                                key={customer.id}
                                className="px-3 sm:px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                              >
                                <div
                                  className="flex-1 cursor-pointer min-w-0"
                                  onClick={() => {
                                    setSelectedCustomerId(customer.id);
                                    setCustomerSearchQuery(customer.name);
                                    form.setValue('customerId', customer.id);
                                    form.setValue('customerName', customer.name);
                                    form.setValue('phoneNumber', customer.phone || '');
                                    setShowCustomerDropdown(false);
                                  }}
                                >
                                  <div className="font-medium text-sm truncate">{customer.name}</div>
                                  {customer.phone && (
                                    <div className="text-xs text-muted-foreground truncate">{customer.phone}</div>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingCustomerId(customer.id);
                                    setIsViewCustomerDialogOpen(true);
                                    setShowCustomerDropdown(false);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </>
                        ) : customerSearchQuery.trim() ? (
                          <div className="px-3 py-3">
                            <p className="text-sm text-muted-foreground mb-2">
                              No customers found matching &quot;{customerSearchQuery}&quot;
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full text-xs sm:text-sm h-9"
                              onClick={() => {
                                setIsCreateCustomerDialogOpen(true);
                                setShowCustomerDropdown(false);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                              <span className="hidden sm:inline">Create New Customer: "{customerSearchQuery}"</span>
                              <span className="sm:hidden">Create "{customerSearchQuery}"</span>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="hidden" {...field} value={customerSearchQuery || field.value || ''} />
                        </FormControl>
                        <FormMessage />
                        {customerSearchQuery && !selectedCustomerId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            New customer will be created with this name
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </FormItem>
                
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Phone number</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} className="h-9 text-sm" />
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
                      <FormLabel className="text-sm">Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Callback subject" {...field} className="h-9 text-sm" />
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
                      <FormLabel className="text-sm">Details</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional details (optional)" {...field} value={field.value || ''} className="min-h-[80px] text-sm" />
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
                      <FormLabel className="text-sm">Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
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
                      <FormLabel className="text-sm">Assign to</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "unassigned" ? null : value ? Number(value) : null)}
                        value={field.value?.toString() || "unassigned"}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Unassigned or select staff" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users?.map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto h-9 text-sm">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto h-9 text-sm">
                    {createMutation.isPending ? 'Creating...' : 'Create callback'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      <Dialog open={isNotesDialogOpen} onOpenChange={(open) => {
        setIsNotesDialogOpen(open);
        if (!open) {
          completionForm.reset();
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Callback Request</DialogTitle>
            <DialogDescription>
              Record the outcome of the callback and any follow-on actions needed.
            </DialogDescription>
          </DialogHeader>
          <Form {...completionForm}>
            <form onSubmit={completionForm.handleSubmit(handleCallbackCompletion)} className="space-y-4 sm:space-y-6">
              {/* Call Outcomes is like this*/}
              <FormField
                control={completionForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Call Outcome *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-xs sm:text-sm h-9 sm:h-10">
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="contacted">✓ Successfully Contacted</SelectItem>
                        <SelectItem value="resolved">✓ Issue Resolved</SelectItem>
                        <SelectItem value="no_answer">✗ No Answer</SelectItem>
                        <SelectItem value="voicemail">📞 Left Voicemail</SelectItem>
                        <SelectItem value="wrong_number">✗ Wrong Number</SelectItem>
                        <SelectItem value="needs_followup">🔄 Needs Follow-up Call</SelectItem>
                        <SelectItem value="needs_job">🔧 Needs Job Created</SelectItem>
                        <SelectItem value="needs_quote">💬 Needs Quote/Estimate</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={completionForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Notes *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter details about the call, what was discussed, and any important information..." 
                        {...field} 
                        rows={4}
                        className="text-xs sm:text-sm min-h-[100px] sm:min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Follow-up Date/Time - shown when outcome is needs_followup */}
              {completionForm.watch('outcome') === 'needs_followup' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <FormField
                    control={completionForm.control}
                    name="followUpDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Follow-up Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="text-xs sm:text-sm h-9 sm:h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={completionForm.control}
                    name="followUpTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Follow-up Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="text-xs sm:text-sm h-9 sm:h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Create Job Option */}
              {completionForm.watch('outcome') === 'needs_job' && (
                <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100 text-xs sm:text-sm">Job Creation Required</p>
                      <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mt-1">
                        A job will be automatically created when you complete this callback. Please provide the job description below.
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={completionForm.control}
                    name="jobDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Job Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the work needed for the job (equipment, issue, etc.)..." 
                            {...field} 
                            rows={3}
                            className="text-xs sm:text-sm min-h-[80px] sm:min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Create Task Option */}
              <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <FormField
                  control={completionForm.control}
                  name="createTask"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-2 sm:space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1 h-4 w-4 sm:h-5 sm:w-5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none flex-1 min-w-0">
                        <FormLabel className="text-xs sm:text-sm">Create Follow-up Task</FormLabel>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Create a task for any follow-up work needed
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                {completionForm.watch('createTask') && (
                  <FormField
                    control={completionForm.control}
                    name="taskDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Task Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe what needs to be done..." 
                            {...field} 
                            rows={3}
                            className="text-xs sm:text-sm min-h-[80px] sm:min-h-[90px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsNotesDialogOpen(false);
                    completionForm.reset();
                  }}
                  className="w-full sm:w-auto text-xs sm:text-sm h-9"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={completeMutation.isPending}
                  className="w-full sm:w-auto text-xs sm:text-sm h-9"
                >
                  {completeMutation.isPending ? 'Completing...' : 'Complete Callback'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Callback Details Dialog */}
      <Dialog open={isViewDetailsDialogOpen} onOpenChange={setIsViewDetailsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Callback Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              View detailed information about this callback request.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCallback && (() => {
            const localOriginalCallback = originalCallbackId 
              ? callbacks.find((cb: any) => cb.id === originalCallbackId)
              : null;
            
            const originalCallback = localOriginalCallback || fetchedOriginalCallback || null;
            
            return (
              <div className="space-y-4">
                {/* Show link to original callback if this is a follow-up */}
                {originalCallbackId && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <LinkIcon className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-purple-900 mb-1">
                          This is a follow-up callback
                        </p>
                        {isLoadingOriginal ? (
                          <p className="text-xs text-purple-700 mb-3">Loading original callback...</p>
                        ) : originalCallback ? (
                          <>
                            <p className="text-xs text-purple-700 mb-3">
                              Related to original callback #{originalCallback.id}: {originalCallback.subject}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsViewDetailsDialogOpen(false);
                                // Set the original callback and open its details
                                setTimeout(() => {
                                  setSelectedCallback(originalCallback);
                                  setIsViewDetailsDialogOpen(true);
                                }, 100);
                              }}
                              className="text-purple-700 border-purple-300 hover:bg-purple-100"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Original Callback
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-purple-700 mb-3">
                              Related to original callback #{originalCallbackId} (not found)
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const fetched = await apiRequest('GET', `/api/callbacks/${originalCallbackId}`) as any;
                                  setIsViewDetailsDialogOpen(false);
                                  setTimeout(() => {
                                    setSelectedCallback(fetched);
                                    setIsViewDetailsDialogOpen(true);
                                  }, 100);
                                } catch (error) {
                                  toast({
                                    title: 'Error',
                                    description: 'Could not load original callback',
                                    variant: 'destructive'
                                  });
                                }
                              }}
                              className="text-purple-700 border-purple-300 hover:bg-purple-100"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Try to View Original Callback
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-2 sm:gap-2">
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Customer:</span>
                  <span className="text-xs sm:text-sm">{selectedCallback.customerName}</span>
                  
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Phone:</span>
                  <span className="text-xs sm:text-sm">
                    <a href={`tel:${selectedCallback.phoneNumber}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {selectedCallback.phoneNumber}
                    </a>
                  </span>
                  
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Subject:</span>
                  <span className="text-xs sm:text-sm">{selectedCallback.subject}</span>
                  
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Status:</span>
                  <span className="text-xs sm:text-sm">{getStatusBadge(selectedCallback.status)}</span>
                  
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Priority:</span>
                  <span className="text-xs sm:text-sm">{getPriorityBadge(selectedCallback.priority)}</span>
                  
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Assigned To:</span>
                  <span className="text-xs sm:text-sm">
                    {selectedCallback.assignedTo 
                      ? users?.find((u: any) => u.id === selectedCallback.assignedTo)?.fullName 
                      : <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[10px] sm:text-xs">Unassigned</Badge>}
                  </span>
                  
                  <span className="font-medium text-gray-500 text-xs sm:text-sm">Requested:</span>
                  <span className="text-xs sm:text-sm">{selectedCallback.requestedAt ? format(new Date(selectedCallback.requestedAt), 'PPp') : 'Unknown'}</span>
                  
                  {selectedCallback.completedAt && (
                    <>
                      <span className="font-medium text-gray-500 text-xs sm:text-sm">Completed:</span>
                      <span className="text-xs sm:text-sm">{format(new Date(selectedCallback.completedAt), 'PPp')}</span>
                    </>
                  )}
                </div>
                
                {selectedCallback.details && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-500">Details:</h4>
                    <p className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-md">{selectedCallback.details}</p>
                  </div>
                )}
                
                {selectedCallback.notes && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-500">Completion Notes:</h4>
                    <p className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-md">{selectedCallback.notes}</p>
                  </div>
                )}
                
                {selectedCallback.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4">
                    {!selectedCallback.assignedTo && (
                      <Button
                        variant="outline"
                        className="flex items-center justify-center border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/20 text-xs sm:text-sm h-9 w-full sm:w-auto"
                        onClick={() => {
                          claimCallback(selectedCallback.id);
                          setIsViewDetailsDialogOpen(false);
                        }}
                        disabled={updateMutation.isPending}
                      >
                        <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-1" />
                        <span className="hidden sm:inline">Claim This Callback</span>
                        <span className="sm:hidden">Claim</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex items-center justify-center text-xs sm:text-sm h-9 w-full sm:w-auto"
                      onClick={() => {
                        setIsViewDetailsDialogOpen(false);
                        setIsNotesDialogOpen(true);
                      }}
                    >
                      <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-1" />
                      <span className="hidden sm:inline">Mark Complete</span>
                      <span className="sm:hidden">Complete</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex items-center justify-center text-destructive text-xs sm:text-sm h-9 w-full sm:w-auto"
                      onClick={() => {
                        setIsViewDetailsDialogOpen(false);
                        setCallbackToDelete(selectedCallback);
                        setIsDeleteConfirmDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDetailsDialogOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm h-9">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2 sm:pb-3">
          <div className="space-y-1 mb-4">
            <CardTitle className="text-xl sm:text-2xl font-semibold text-foreground">
              Callback Requests
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground">
              {filteredAndSortedCallbacks.length} of {callbacks.length} callbacks
              {searchQuery && ` matching "${searchQuery}"`}
            </CardDescription>
          </div>

          {/* Search and Filters - matches Customers / Tasks */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search callbacks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 sm:h-10 text-sm"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0 sm:mr-1" />
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto p-1 rounded-lg bg-muted overflow-x-auto">
              <TabsTrigger value="pending" className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                <span className="flex items-center gap-1.5 truncate">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  To Do
                  {stats.pendingCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stats.pendingCount}</Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                <span className="flex items-center gap-1.5 truncate">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  Follow Up
                  {stats.scheduledCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stats.scheduledCount}</Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                <span className="flex items-center gap-1.5 truncate">
                  <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                  My Callbacks
                  {stats.assignedCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stats.assignedCount}</Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                <span className="flex items-center gap-1.5 truncate">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Completed
                  {stats.completedCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stats.completedCount}</Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {/* Date Filter - only for completed / all tabs */}
          {(selectedTab === 'completed' || selectedTab === 'all') && (
            <div className="mb-4 p-3 rounded-lg border bg-muted/50">
              <div className="flex flex-col gap-2">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Filter by date range</span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDateFilter({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}>7 days</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDateFilter({ from: startOfDay(subDays(new Date(), 31)), to: endOfDay(new Date()) })}>31 days</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDateFilter({ from: startOfDay(subDays(new Date(), 90)), to: endOfDay(new Date()) })}>90 days</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDateFilter({ from: startOfDay(new Date(0)), to: endOfDay(addDays(new Date(), 365)) })}>All time</Button>
                </div>
                <p className="text-xs text-muted-foreground">{format(dateFilter.from, 'MMM d, yyyy')} – {format(dateFilter.to, 'MMM d, yyyy')}</p>
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-12">
              <span className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground border-t-transparent" />
              <span className="mt-3 text-sm text-muted-foreground">Loading callbacks...</span>
            </div>
          ) : filteredAndSortedCallbacks?.length === 0 ? (
            <div className="text-center py-12">
              <PhoneCall className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-medium text-foreground">
                {searchQuery || priorityFilter !== 'all' || assigneeFilter !== 'all'
                  ? 'No callbacks match your filters'
                  : 'No callback requests'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || priorityFilter !== 'all' || assigneeFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : selectedTab === 'all' 
                    ? 'There are no callback requests in the system.' 
                    : selectedTab === 'assigned' 
                      ? 'You have no callback requests assigned to you, and there are no unassigned callbacks available.' 
                      : selectedTab === 'scheduled'
                        ? 'There are no scheduled callbacks.'
                        : selectedTab === 'pending'
                          ? 'There are no pending callback requests.'
                          : selectedTab === 'completed'
                            ? 'There are no completed callback requests.'
                            : 'There are no deleted callback requests.'}
              </p>
              {(searchQuery || priorityFilter !== 'all' || assigneeFilter !== 'all') && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(''); setPriorityFilter('all'); setAssigneeFilter('all'); }}>
                  Clear filters
                </Button>
              )}
              {selectedTab !== 'deleted' && !searchQuery && priorityFilter === 'all' && assigneeFilter === 'all' && (
                <Button size="sm" className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New callback
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedCallbacks?.map((callback: any) => {
                const assignee = users?.find((u: any) => u.id === callback.assignedTo);
                const isScheduled = callback.requestedAt && new Date(callback.requestedAt) > new Date();
                return (
                  <Card
                    key={callback.id}
                    className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedCallback(callback);
                      setIsViewDetailsDialogOpen(true);
                    }}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                          <PhoneCall className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {callback.customerName}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {getPriorityBadge(callback.priority)}
                              {isScheduled && (
                                <Badge variant="secondary" className="text-xs">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Scheduled
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-medium text-foreground">{callback.subject}</p>
                          {callback.details && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{callback.details}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                              <a href={`tel:${callback.phoneNumber}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                {callback.phoneNumber}
                              </a>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                              {assignee?.fullName || 'Unassigned'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              {callback.requestedAt ? format(new Date(callback.requestedAt), 'MMM d, yyyy · HH:mm') : '—'}
                              {isScheduled && (
                                <span className="text-muted-foreground">({formatDistanceToNow(new Date(callback.requestedAt), { addSuffix: true })})</span>
                              )}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-border">
                            {getStatusBadge(callback.status)}
                            {callback.status === 'pending' && (
                              <div className="flex gap-2">
                                {!callback.assignedTo && (
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); claimCallback(callback.id); }} disabled={updateMutation.isPending}>
                                    <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Claim
                                  </Button>
                                )}
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedCallback(callback); setIsNotesDialogOpen(true); }}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Complete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this callback request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {callbackToDelete && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                <div className="font-medium text-gray-500">Customer:</div>
                <div className="text-gray-900 dark:text-gray-100">{callbackToDelete.customerName}</div>
                
                <div className="font-medium text-gray-500">Phone:</div>
                <div className="text-gray-900 dark:text-gray-100">{callbackToDelete.phoneNumber}</div>
                
                <div className="font-medium text-gray-500">Subject:</div>
                <div className="text-gray-900 dark:text-gray-100">{callbackToDelete.subject}</div>
                
                <div className="font-medium text-gray-500">Priority:</div>
                <div>{getPriorityBadge(callbackToDelete.priority)}</div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteConfirmDialogOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm h-9">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate(callbackToDelete?.id)}
              disabled={deleteMutation.isPending}
              className="w-full sm:w-auto text-xs sm:text-sm h-9"
            >
              {deleteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-t-2 border-b-2 border-white mr-1.5 sm:mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Delete Permanently</span>
                  <span className="sm:hidden">Delete</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={isCreateCustomerDialogOpen} onOpenChange={setIsCreateCustomerDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Create New Customer</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Create a new customer profile. The name field is pre-filled from your search.
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            initialName={customerSearchQuery}
            onComplete={async () => {
              setIsCreateCustomerDialogOpen(false);
              await queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
              // Refetch search results so the new customer appears; then auto-select if name matches
              const result = await queryClient.fetchQuery<{ data?: any[] }>({
                queryKey: ['/api/customers', 'search', customerSearchQuery.trim()],
                queryFn: () => apiRequest('GET', `/api/customers?${buildCustomersQueryParams(customerSearchQuery.trim())}`),
              });
              const list = result?.data ?? [];
              const newCustomer = list.find((c: any) =>
                c.name?.toLowerCase() === customerSearchQuery.trim().toLowerCase()
              );
              if (newCustomer) {
                setSelectedCustomerId(newCustomer.id);
                form.setValue('customerId', newCustomer.id);
                form.setValue('customerName', newCustomer.name);
                if (newCustomer.phone) form.setValue('phoneNumber', newCustomer.phone);
                setShowCustomerDropdown(false);
              }
            }}
            onCancel={() => setIsCreateCustomerDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Customer Details Dialog */}
      <Dialog open={isViewCustomerDialogOpen} onOpenChange={setIsViewCustomerDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              Customer Details
            </DialogTitle>
          </DialogHeader>
          {viewingCustomerId && (
            <CustomerDetailsView 
              customerId={viewingCustomerId}
              onClose={() => {
                setIsViewCustomerDialogOpen(false);
                setViewingCustomerId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Customer Details View Component
function CustomerDetailsView({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const { data: customer, isLoading } = useQuery<{
    id: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }>({
    queryKey: ['/api/customers', customerId],
    queryFn: () => apiRequest('GET', `/api/customers/${customerId}`),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Customer not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {customer.phone && (
              <div className="flex items-start gap-2 sm:gap-3">
                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Phone</p>
                  <a href={`tel:${customer.phone}`} className="text-sm sm:text-base text-blue-600 dark:text-blue-400 hover:underline break-all">
                    {customer.phone}
                  </a>
                </div>
              </div>
            )}
            {customer.email && (
              <div className="flex items-start gap-2 sm:gap-3">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Email</p>
                  <a href={`mailto:${customer.email}`} className="text-sm sm:text-base text-blue-600 dark:text-blue-400 hover:underline break-all">
                    {customer.email}
                  </a>
                </div>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-2 sm:gap-3 md:col-span-2">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Address</p>
                  <p className="text-sm sm:text-base whitespace-pre-wrap break-words">{customer.address}</p>
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="flex items-start gap-2 sm:gap-3 md:col-span-2">
                <FileTextIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-sm sm:text-base whitespace-pre-wrap break-words">{customer.notes}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto text-xs sm:text-sm h-9">
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}