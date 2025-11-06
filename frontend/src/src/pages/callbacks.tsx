import React, { useState } from 'react';
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
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from 'date-fns';
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
  ArchiveX
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Form schema for creating/editing a callback request
const callbackFormSchema = z.object({
  customerName: z.string().min(2, {
    message: "Customer name is required"
  }),
  phoneNumber: z.string().min(5, "Phone number is required"),
  subject: z.string().min(3, "Subject is required"),
  details: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'], {
    required_error: "Priority is required"
  }),
  assignedTo: z.coerce.number({
    required_error: "Assigned staff member is required"
  }),
  status: z.enum(['pending', 'completed']).default('pending')
});

type CallbackFormValues = z.infer<typeof callbackFormSchema>;

// Notes form schema for completing a callback
const notesFormSchema = z.object({
  notes: z.string().min(5, "Please enter notes about the callback")
});

type NotesFormValues = z.infer<typeof notesFormSchema>;

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
    case 'completed':
      return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
    case 'deleted':
      return <Badge className="bg-red-500 hover:bg-red-600">Deleted</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

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
  
  // Date filter state - default to last 31 days
  const [dateFilter, setDateFilter] = useState({
    from: startOfDay(subDays(new Date(), 31)),
    to: endOfDay(new Date())
  });

  // Query for callbacks based on selected tab and date filter
  const { data: callbacks = [], isLoading } = useQuery({
    queryKey: ['/api/callbacks', selectedTab, user?.id, dateFilter.from.toISOString(), dateFilter.to.toISOString()],
    queryFn: async () => {
      let url = '/api/callbacks';
      const params = new URLSearchParams();
      
      // Add date filter parameters
      params.append('fromDate', dateFilter.from.toISOString());
      params.append('toDate', dateFilter.to.toISOString());
      
      if (selectedTab === 'assigned' && user?.id) {
        params.append('assignedTo', String(user.id));
      } else if (selectedTab === 'pending') {
        params.append('status', 'pending');
      } else if (selectedTab === 'completed') {
        params.append('status', 'completed');
      }
      
      url += '?' + params.toString();
      return apiRequest('GET', url);
    }
  });

  // Query for users (for the assignee dropdown)
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('GET', '/api/users')
  });

  // Query for customers (for the customer dropdown)
  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => apiRequest('GET', '/api/customers')
  });

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
      notesForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete callback request',
        variant: 'destructive',
      });
    }
  });
  
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

  // Setup form for completing a callback with notes
  const notesForm = useForm<NotesFormValues>({
    resolver: zodResolver(notesFormSchema),
    defaultValues: {
      notes: ''
    }
  });

  // Handle form submission for creating a callback
  function onSubmit(data: CallbackFormValues) {
    createMutation.mutate(data);
  }

  // Handle form submission for completing a callback
  function onNotesSubmit(data: NotesFormValues) {
    if (selectedCallback) {
      console.log("Completing callback:", selectedCallback.id, data.notes);
      completeMutation.mutate({
        id: selectedCallback.id,
        notes: data.notes
      });
    }
  }

  // Note: All these handlers have been replaced with inline functions in the button components
  
  // These functions have been replaced with inline functions in the dialog buttons

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Callbacks</h1>
          <p className="text-gray-600">Manage customer callback requests</p>
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
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Callback'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Notes dialog for completing a callback */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Complete Callback Request</DialogTitle>
            <DialogDescription>
              Add notes about the callback outcome before marking it as complete.
            </DialogDescription>
          </DialogHeader>
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
                  onClick={() => setIsNotesDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? 'Completing...' : 'Mark as Completed'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Callback Details Dialog */}
      <Dialog open={isViewDetailsDialogOpen} onOpenChange={setIsViewDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Callback Details</DialogTitle>
            <DialogDescription>
              View detailed information about this callback request.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCallback && (
            <div className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="font-medium text-gray-500">Customer:</span>
                <span>{selectedCallback.customerName}</span>
                
                <span className="font-medium text-gray-500">Phone:</span>
                <span>{selectedCallback.phoneNumber}</span>
                
                <span className="font-medium text-gray-500">Subject:</span>
                <span>{selectedCallback.subject}</span>
                
                <span className="font-medium text-gray-500">Status:</span>
                <span>{getStatusBadge(selectedCallback.status)}</span>
                
                <span className="font-medium text-gray-500">Priority:</span>
                <span>{getPriorityBadge(selectedCallback.priority)}</span>
                
                <span className="font-medium text-gray-500">Assigned To:</span>
                <span>{users?.find((u: any) => u.id === selectedCallback.assignedTo)?.fullName || 'Unassigned'}</span>
                
                <span className="font-medium text-gray-500">Requested:</span>
                <span>{selectedCallback.requestedAt ? format(new Date(selectedCallback.requestedAt), 'PPp') : 'Unknown'}</span>
                
                {selectedCallback.completedAt && (
                  <>
                    <span className="font-medium text-gray-500">Completed:</span>
                    <span>{format(new Date(selectedCallback.completedAt), 'PPp')}</span>
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
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => {
                      setIsViewDetailsDialogOpen(false);
                      setIsNotesDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center text-destructive"
                    onClick={() => {
                      setIsViewDetailsDialogOpen(false);
                      setCallbackToDelete(selectedCallback);
                      setIsDeleteConfirmDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-lg font-medium text-neutral-700">
              Callback Requests
            </CardTitle>
          </div>
          
          {/* Date Filter */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">Filter by date:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFilter.from.toISOString().split('T')[0]}
                onChange={(e) => setDateFilter(prev => ({ 
                  ...prev, 
                  from: startOfDay(new Date(e.target.value)) 
                }))}
                className="w-auto"
              />
              <span className="text-sm text-neutral-500">to</span>
              <Input
                type="date"
                value={dateFilter.to.toISOString().split('T')[0]}
                onChange={(e) => setDateFilter(prev => ({ 
                  ...prev, 
                  to: endOfDay(new Date(e.target.value)) 
                }))}
                className="w-auto"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateFilter({
                  from: startOfDay(subDays(new Date(), 7)),
                  to: endOfDay(new Date())
                })}
                className="text-xs"
              >
                7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateFilter({
                  from: startOfDay(subDays(new Date(), 31)),
                  to: endOfDay(new Date())
                })}
                className="text-xs"
              >
                31 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateFilter({
                  from: startOfDay(subDays(new Date(), 90)),
                  to: endOfDay(new Date())
                })}
                className="text-xs"
              >
                90 days
              </Button>
            </div>
          </div>
          
          <Tabs 
            value={selectedTab} 
            onValueChange={(value) => setSelectedTab(value)}
            className="w-full"
          >
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
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
              <span className="ml-3">Loading callbacks...</span>
            </div>
          ) : callbacks?.length === 0 ? (
            <div className="text-center p-8">
              <PhoneCall className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No callback requests</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedTab === 'all' 
                  ? 'There are no callback requests in the system.' 
                  : selectedTab === 'assigned' 
                    ? 'You have no callback requests assigned to you.' 
                    : selectedTab === 'pending'
                      ? 'There are no pending callback requests.'
                      : selectedTab === 'completed'
                        ? 'There are no completed callback requests.'
                        : 'There are no deleted callback requests.'}
              </p>
              {selectedTab !== 'deleted' && (
                <div className="mt-6">
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Callback Request
                  </Button>
                </div>
              )}
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
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callbacks?.map((callback: any) => {
                    const assignee = users?.find((u: any) => u.id === callback.assignedTo);
                    
                    return (
                      <TableRow key={callback.id}>
                        <TableCell>
                          <div 
                            className="font-medium cursor-pointer hover:text-primary hover:underline" 
                            onClick={() => {
                              setSelectedCallback(callback);
                              setIsViewDetailsDialogOpen(true);
                            }}
                          >
                            {callback.customerName}
                          </div>
                          <div className="text-sm text-gray-500">{callback.phoneNumber}</div>
                        </TableCell>
                        <TableCell>
                          <div 
                            className="font-medium truncate max-w-[200px] cursor-pointer hover:text-primary hover:underline"
                            onClick={() => {
                              setSelectedCallback(callback);
                              setIsViewDetailsDialogOpen(true);
                            }}
                          >
                            {callback.subject}
                          </div>
                          {callback.details && (
                            <div className="text-sm text-gray-500 truncate max-w-[200px]">
                              {callback.details}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 mr-2 text-gray-500" />
                            <span>{assignee?.fullName || 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                            <span title={callback.requestedAt}>
                              {callback.requestedAt ? format(new Date(callback.requestedAt), 'dd/MM/yyyy HH:mm') : 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(callback.priority)}</TableCell>
                        <TableCell>{getStatusBadge(callback.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {callback.status === 'pending' ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex items-center" 
                                  onClick={() => {
                                    setSelectedCallback(callback);
                                    setIsNotesDialogOpen(true);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex items-center text-destructive" 
                                  onClick={() => {
                                    setCallbackToDelete(callback);
                                    setIsDeleteConfirmDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex items-center" 
                                onClick={() => {
                                  if (callback.notes) {
                                    toast({
                                      title: "Callback Notes",
                                      description: callback.notes,
                                    });
                                  } else {
                                    toast({
                                      title: "No Notes",
                                      description: "No notes were added for this callback.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View Notes
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-medium">Customer:</div>
                <div>{callbackToDelete.customerName}</div>
                
                <div className="font-medium">Phone:</div>
                <div>{callbackToDelete.phoneNumber}</div>
                
                <div className="font-medium">Subject:</div>
                <div>{callbackToDelete.subject}</div>
                
                <div className="font-medium">Priority:</div>
                <div>{getPriorityBadge(callbackToDelete.priority)}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate(callbackToDelete?.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}