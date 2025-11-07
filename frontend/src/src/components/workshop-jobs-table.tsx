import { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Search, Plus, Printer, ChevronDown, CreditCard, DollarSign, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "./ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge"; // Adjusted path based on your project structure
import { formatDate, getStatusColor } from "../lib/utils";
import { JobForm } from "./job-form";
import { JobWizard } from "./job-wizard";
import { PrintJobDialog } from "./print-job-dialog";
import { JobPaymentForm } from "./job-payment-form";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

export interface WorkshopJobsTableProps {
  jobs: any[];
  isLoading?: boolean;
  showSearch?: boolean;
  showPagination?: boolean;
  className?: string;
  triggerJobCreation?: boolean;
}

export function WorkshopJobsTable({ 
  jobs = [], 
  isLoading = false, 
  showSearch = false, 
  showPagination = true,
  className = "",
  triggerJobCreation = false
}: WorkshopJobsTableProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [wizardDialogOpen, setWizardDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [statusChangeJob, setStatusChangeJob] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const itemsPerPage = 10;
  const { toast } = useToast();

  // React to external trigger for job creation
  useEffect(() => {
    if (triggerJobCreation) {
      setWizardDialogOpen(true);
    }
  }, [triggerJobCreation]);

  // Refresh payment status for all jobs mutation
  const refreshAllPaymentsMutation = useMutation({
    mutationFn: async () => {
      const refreshPromises = jobs
        .filter(job => job.paymentStatus !== 'paid')
        .map(job => apiRequest('POST', `/api/jobs/${job.id}/payments/refresh`));
      
      const results = await Promise.allSettled(refreshPromises);
      return results.filter(result => result.status === 'fulfilled').length;
    },
    onSuccess: (updatedCount: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      
      toast({
        title: "Payment Status Updated",
        description: `Checked payment status for ${updatedCount} jobs`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh payment status",
        variant: "destructive",
      });
    }
  });

  // Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number, status: string }) => {
      return apiRequest('PUT', `/api/jobs/${jobId}`, { status });
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
    }
  });

  // Handle status change
  const handleStatusChange = (job: any, status: string) => {
    if (status === "ready_for_pickup") {
      // Show confirmation dialog for ready for pickup
      setStatusChangeJob(job);
      setNewStatus(status);
      setConfirmDialogOpen(true);
    } else {
      // Direct update for other statuses
      statusUpdateMutation.mutate({ jobId: job.id, status });
    }
  };

  // Confirm status change
  const confirmStatusChange = () => {
    if (statusChangeJob && newStatus) {
      statusUpdateMutation.mutate({ 
        jobId: statusChangeJob.id, 
        status: newStatus 
      });
    }
  };
  
  // Fetch customers to get customer names
  const { data: customerData = [] } = useQuery({
    queryKey: ["/api/customers"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch users for technician/assignee names
  const { data: userData = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Create a map of customer ID to customer name for quick lookups
  const customerMap: Record<number, string> = {};
  if (Array.isArray(customerData)) {
    customerData.forEach((customer: any) => {
      if (customer && customer.id && customer.name) {
        customerMap[customer.id] = customer.name;
      }
    });
  }
  
  // Create a map of user ID to user name for quick assignee lookups
  const userMap: Record<number, string> = {};
  if (Array.isArray(userData)) {
    userData.forEach((user: any) => {
      if (user && user.id) {
        userMap[user.id] = user.fullName || user.username;
      }
    });
  }
  
  // Filter jobs based on search query
  const filteredJobs = jobs.filter(job => {
    const searchTerms = searchQuery.toLowerCase().trim();
    if (!searchTerms) return true;
    
    // Search by job ID
    if (job.jobId?.toLowerCase().includes(searchTerms)) return true;
    
    // Search by equipment description
    if (job.equipmentDescription?.toLowerCase().includes(searchTerms)) return true;
    
    // Search by status
    if (formatStatus(job.status).toLowerCase().includes(searchTerms)) return true;
    
    // Search by customer name (using helper function)
    const customerName = getCustomerName(job.customerId).toLowerCase();
    if (customerName.includes(searchTerms)) return true;
    
    return false;
  });
  
  // Pagination logic
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + itemsPerPage);
  
  const goToPage = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };
  
  // Get customer name using the customerId and our customerMap
  function getCustomerName(customerId: number | null, job?: any): string {
    // Check if this is a custom customer entry directly on the job
    if (job && job.customer) {
      return job.customer;
    }
    
    // If we have a valid customer ID, look it up in our customer map
    if (customerId && customerMap[customerId]) {
      return customerMap[customerId];
    }
    
    // Try the job's customerName property as fallback
    if (job?.customerName) {
      return job.customerName;
    }
    
    return "Unknown Customer";
  }
  
  // Helper function to get customer email
  function getCustomerEmail(customerId: number): string {
    // Since our current API doesn't return customer emails,
    // we can either leave this blank or implement later
    return "";
  }
  
  // Helper function to get equipment name
  function getEquipmentName(job: any): string {
    // Handle null or undefined job object
    if (!job) return "No equipment specified";
    
    // Check for equipment description and make sure it's not empty
    if (job.equipmentDescription && typeof job.equipmentDescription === 'string' && job.equipmentDescription.trim() !== "") {
      return job.equipmentDescription;
    }
    
    // Check for equipment ID
    if (job.equipmentId) {
      const equipmentData: { [key: number]: string } = {
        1: "Honda Lawnmower HRX217",
        2: "Stihl Chainsaw MS250",
        3: "John Deere Tractor X350",
        4: "Husqvarna Trimmer 128LD",
        5: "ECHO Leaf Blower PB-2520"
      };
      
      return equipmentData[job.equipmentId] || "Unknown Equipment";
    }
    
    return "No equipment specified";
  }
  
  // Helper function to get assignee name
  function getAssigneeName(assigneeId: number): string {
    if (!assigneeId) return "Unassigned";
    
    // Use our user map to look up the real technician name
    if (userMap[assigneeId]) {
      return userMap[assigneeId];
    }
    
    return "Unknown Assignee";
  }
  
  // Helper function to format job status
  function formatStatus(status: string): string {
    switch (status) {
      case "waiting_assessment":
        return "Waiting Assessment";
      case "in_progress":
        return "In Progress";
      case "parts_ordered":
        return "Parts Ordered";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  // Helper function for payment status badge
  const getPaymentStatusBadge = (job: any) => {
    if (!job.paymentStatus || job.paymentStatus === 'unpaid') {
      return <Badge variant="destructive" className="text-xs">Unpaid</Badge>;
    }
    if (job.paymentStatus === 'paid') {
      return <Badge variant="default" className="bg-green-600 text-xs">Paid</Badge>;
    }
    if (job.paymentStatus === 'pending_payment_request') {
      return <Badge variant="secondary" className="text-xs">Request Sent</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{job.paymentStatus}</Badge>;
  };

  // Handle payment dialog
  const handlePaymentClick = (job: any) => {
    setSelectedJob(job);
    setPaymentDialogOpen(true);
  };
  
  return (
    <div className={className}>
      <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle className="text-lg sm:text-xl font-semibold text-neutral-800">
              Workshop Jobs
            </CardTitle>
            <p className="text-sm text-neutral-500 mt-1">
              Track equipment currently in the workshop
            </p>
          </div>
          
          {showSearch && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:flex-none sm:w-60">
                <Input
                  type="text"
                  placeholder="Search jobs, customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 border border-green-100 rounded-md text-sm 
                    focus:ring-green-600 focus:border-green-600 shadow-sm"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={15} className="text-green-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshAllPaymentsMutation.mutate()}
                  disabled={refreshAllPaymentsMutation.isPending}
                  className="flex items-center gap-1.5 flex-1 sm:flex-none"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshAllPaymentsMutation.isPending ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{refreshAllPaymentsMutation.isPending ? 'Checking...' : 'Check Payments'}</span>
                  <span className="sm:hidden">{refreshAllPaymentsMutation.isPending ? 'Checking' : 'Check'}</span>
                </Button>
                <Button 
                  onClick={() => setWizardDialogOpen(true)}
                  className="flex items-center gap-1.5 font-medium rounded-md 
                  text-white bg-green-700 hover:bg-green-800 shadow-sm flex-1 sm:flex-none justify-center"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">New Job</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <div className="min-h-[300px]">
        <CardContent className="px-0 pb-6">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-neutral-200">
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Job ID
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Brand & Model
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Payment
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Customer
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Assigned To
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Created
                  </TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin h-7 w-7 border-4 border-t-green-600 border-green-200 rounded-full"></div>
                      </div>
                      <p className="mt-3 text-neutral-600">Loading jobs...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <div className="flex flex-col items-center">
                        <div className="rounded-full bg-neutral-100 p-3 mb-3">
                          <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="font-medium text-neutral-700 mb-1">No jobs found</p>
                        <p className="text-sm text-neutral-500">Try changing your search criteria or create a new job.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedJobs.map((job) => (
                    <TableRow 
                      key={job.id} 
                      className="hover:bg-neutral-50 transition-colors border-b border-neutral-100"
                    >
                      <TableCell className="px-6 py-4 text-sm font-medium text-green-800">
                        {job.jobId}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        {getEquipmentName(job)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        <div className="flex items-center gap-2">
                          {getPaymentStatusBadge(job)}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePaymentClick(job)}
                            className="h-7 w-7 p-0"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-green-700">
                              {getCustomerName(job.customerId, job).split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-neutral-800">{getCustomerName(job.customerId, job)}</div>
                            <div className="text-xs text-neutral-500">{getCustomerEmail(job.customerId)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        {job.assignedTo ? getAssigneeName(job.assignedTo) : (
                          <span className="text-amber-600 font-medium">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Select 
                          value={job.status} 
                          onValueChange={(status) => handleStatusChange(job, status)}
                          disabled={statusUpdateMutation.isPending}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue>
                              <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(job.status).bgColor} ${getStatusColor(job.status).textColor}`}>
                                {formatStatus(job.status)}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="waiting_assessment">Waiting Assessment</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="parts_ordered">Parts Ordered</SelectItem>
                            <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-600">
                        {formatDate(job.createdAt)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <PrintJobDialog
                            job={job}
                            customerName={getCustomerName(job.customerId, job)}
                            equipmentName={getEquipmentName(job)}
                            assigneeName={getAssigneeName(job.assignedTo)}
                            trigger={
                              <Button variant="outline" size="sm" className="gap-1 border-neutral-200 text-neutral-700">
                                <Printer size={14} />
                                <span className="hidden sm:inline">Print</span>
                              </Button>
                            }
                          />
                          <Dialog open={editDialogOpen && selectedJobId === job.id} onOpenChange={(open) => {
                            if (!open) {
                              setEditDialogOpen(false);
                              setSelectedJobId(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-700 hover:text-green-800 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setEditDialogOpen(true);
                                }}
                              >
                                View & Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>View & Edit Job</DialogTitle>
                              </DialogHeader>
                              <JobForm 
                                jobId={job.id} 
                                editMode 
                                onComplete={() => {
                                  // Job was updated successfully but don't close dialog automatically
                                  // User can review changes and close manually
                                }}
                                onCancel={() => {
                                  setEditDialogOpen(false);
                                  setSelectedJobId(null);
                                }}
                              />
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Mobile Card View */}
          <div className="lg:hidden px-4">
            {isLoading ? (
              <div className="py-10 text-center">
                <div className="flex justify-center">
                  <div className="animate-spin h-7 w-7 border-4 border-t-green-600 border-green-200 rounded-full"></div>
                </div>
                <p className="mt-3 text-neutral-600">Loading jobs...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="py-10 text-center">
                <div className="flex flex-col items-center">
                  <div className="rounded-full bg-neutral-100 p-3 mb-3">
                    <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="font-medium text-neutral-700 mb-1">No jobs found</p>
                  <p className="text-sm text-neutral-500">Try changing your search criteria or create a new job.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedJobs.map((job) => (
                  <Card key={job.id} className="border border-neutral-200 shadow-sm">
                    <CardContent className="p-4">
                      {/* Job Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-green-800 text-lg">{job.jobId}</span>
                            {getPaymentStatusBadge(job)}
                          </div>
                          <p className="font-medium text-neutral-800 text-sm">{getEquipmentName(job)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePaymentClick(job)}
                            className="h-8 w-8 p-0"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <PrintJobDialog
                            job={job}
                            customerName={getCustomerName(job.customerId, job)}
                            equipmentName={getEquipmentName(job)}
                            assigneeName={getAssigneeName(job.assignedTo)}
                            trigger={
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-neutral-200">
                                <Printer size={14} />
                              </Button>
                            }
                          />
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="flex items-center mb-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-green-700">
                            {getCustomerName(job.customerId, job).split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-neutral-800">{getCustomerName(job.customerId, job)}</p>
                          <p className="text-xs text-neutral-500">
                            Assigned: {job.assignedTo ? getAssigneeName(job.assignedTo) : 
                              <span className="text-amber-600 font-medium">Unassigned</span>
                            }
                          </p>
                        </div>
                      </div>

                      {/* Status and Date */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1 mr-3">
                          <Select 
                            value={job.status} 
                            onValueChange={(status) => handleStatusChange(job, status)}
                            disabled={statusUpdateMutation.isPending}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${getStatusColor(job.status).bgColor} ${getStatusColor(job.status).textColor}`}>
                                  {formatStatus(job.status)}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="waiting_assessment">Waiting Assessment</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="parts_ordered">Parts Ordered</SelectItem>
                              <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-xs text-neutral-500">
                          {formatDate(job.createdAt)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end">
                        <Dialog open={editDialogOpen && selectedJobId === job.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditDialogOpen(false);
                            setSelectedJobId(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="bg-green-700 hover:bg-green-800 text-white"
                              onClick={() => {
                                setSelectedJobId(job.id);
                                setEditDialogOpen(true);
                              }}
                            >
                              View & Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>View & Edit Job</DialogTitle>
                            </DialogHeader>
                            <JobForm 
                              jobId={job.id} 
                              editMode 
                              onComplete={() => {
                                // Job was updated successfully but don't close dialog automatically
                                // User can review changes and close manually
                              }}
                              onCancel={() => {
                                setEditDialogOpen(false);
                                setSelectedJobId(null);
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          {showPagination && filteredJobs.length > 0 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 px-4 gap-4">
              {/* Results summary */}
              <div className="text-sm text-neutral-600 order-2 sm:order-1">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredJobs.length)} of {filteredJobs.length} jobs
              </div>
              
              {/* Pagination controls */}
              <div className="order-1 sm:order-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => goToPage(currentPage - 1)}
                        className={currentPage === 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {/* Show fewer page numbers on mobile */}
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={page} className="hidden sm:block">
                          <button
                            onClick={() => goToPage(page)}
                            className={`h-9 w-9 flex items-center justify-center rounded-md text-sm font-medium 
                            ${page === currentPage 
                              ? "bg-green-50 text-green-700 border border-green-200" 
                              : "text-neutral-600 hover:bg-neutral-50"}`}
                          >
                            {page}
                          </button>
                        </PaginationItem>
                      );
                    })}
                    
                    {/* Mobile: Show current page indicator */}
                    <PaginationItem className="sm:hidden">
                      <span className="h-9 px-3 flex items-center justify-center text-sm font-medium text-neutral-700">
                        {currentPage} of {totalPages}
                      </span>
                    </PaginationItem>
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => goToPage(currentPage + 1)}
                        className={currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </CardContent>
      </div>

      {/* Status Change Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              {newStatus === "ready_for_pickup" && (
                <>
                  Are you sure you want to mark job <strong>{statusChangeJob?.jobId}</strong> as ready for pickup? 
                  This will send an email notification to the customer at <strong>{statusChangeJob ? getCustomerEmail(statusChangeJob.customerId) : ''}</strong>.
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
              className="bg-green-600 hover:bg-green-700"
            >
              {statusUpdateMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Management Dialog */}
      {selectedJob && (
        <JobPaymentForm
          job={selectedJob}
          open={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedJob(null);
          }}
        />
      )}

      {/* Job Creation Wizard */}
      <JobWizard
        open={wizardDialogOpen}
        onOpenChange={setWizardDialogOpen}
        mode="create"
      />
    </div>
  );
}