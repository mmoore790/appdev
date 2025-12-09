import { useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Package,
  Phone,
  Printer,
  User,
  UserCheck,
  Wrench,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobSheet } from "@/components/job-sheet";
import { WorkshopActivity } from "@/components/workshop-activity";
import { StatusTimeline } from "@/components/status-timeline";
import { OrderForm } from "@/components/order-form";
import { CustomerActions } from "@/components/customer-actions";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Edit2, Check, X, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface JobEntity {
  id: number;
  jobId: string;
  status: string;
  description?: string;
  taskDetails?: string;
  equipmentDescription?: string;
  assignedTo?: number | null;
  customerId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  estimatedHours?: number | null;
  customerNotified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface OrderEntity {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  status: string;
  estimatedTotalCost?: number | null;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  createdAt: string;
  supplierName?: string | null;
  notes?: string | null;
}

export default function WorkshopJobDetail() {
  const [, params] = useRoute<{ jobId: string }>("/workshop/jobs/:jobId");
  const [, navigate] = useLocation();
  const numericJobId = params?.jobId ? Number(params.jobId) : NaN;
  const [activeTab, setActiveTab] = useState<"overview" | "job-sheet">("overview");

  const [partsDialogOpen, setPartsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editingJob, setEditingJob] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    description: "",
    equipmentDescription: "",
    estimatedHours: "",
    taskDetails: "",
    customerNotified: false,
  });
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [editingOrder, setEditingOrder] = useState<OrderEntity | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderStatusDialogOpen, setOrderStatusDialogOpen] = useState(false);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState<OrderEntity | null>(null);
  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<OrderEntity | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
    refetch: refetchJob,
  } = useQuery<JobEntity | null>({
    queryKey: [`/api/jobs/${numericJobId}`],
    enabled: Number.isFinite(numericJobId) && numericJobId > 0,
    retry: 1,
  });

  // Handle errors separately
  useEffect(() => {
    if (jobError) {
      console.error("Error loading job:", jobError);
    }
  }, [jobError]);

  const { data: services = [] } = useQuery<any[]>({
    queryKey: Number.isFinite(numericJobId) ? [`/api/services?jobId=${numericJobId}`] : ["services/disabled"],
    enabled: Number.isFinite(numericJobId),
  });

  const {
    data: orders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery<OrderEntity[]>({
    queryKey: Number.isFinite(numericJobId) ? [`/api/orders/job/${numericJobId}`] : ["orders/disabled"],
    enabled: Number.isFinite(numericJobId),
  });

  const {
    data: activities = [],
    isLoading: activitiesLoading,
  } = useQuery<any[]>({
    queryKey: ["/api/activities"],
  });

  const {
    data: jobUpdates = [],
    isLoading: jobUpdatesLoading,
  } = useQuery<any[]>({
    queryKey: Number.isFinite(numericJobId) ? [`/api/jobs/${numericJobId}/updates`] : ["job-updates/disabled"],
    enabled: Number.isFinite(numericJobId),
  });
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const resolveUserName = (userId?: number | null) => {
    if (!userId) return null;
    if (!Array.isArray(users)) return null;
    const match = users.find((user: any) => user.id === userId);
    return match?.fullName || match?.username || null;
  };

  const jobActivities = useMemo(() => {
    if (!Array.isArray(activities) || !job) return [];
    return activities.filter((activity) => activity.entityType === "job" && activity.entityId === job.id);
  }, [activities, job]);

  const statusToken = job ? getStatusColor(job.status) : null;
  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, assignedTo }: { jobId: number; assignedTo: number | null }) => {
      return apiRequest("PUT", `/api/jobs/${jobId}`, { assignedTo });
    },
    onSuccess: (_, variables) => {
      const assignedName = variables.assignedTo ? resolveUserName(variables.assignedTo) : null;
      toast({
        title: variables.assignedTo ? "Job assigned" : "Job unassigned",
        description: variables.assignedTo
          ? `Assigned to ${assignedName ?? "selected technician"}.`
          : "Job marked as unassigned.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${variables.jobId}`] });
      void refetchJob();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update assignment",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAssigneeChange = (value: string, job: JobEntity) => {
    if (!job?.id) return;
    if (value === "unassigned") {
      if (!job.assignedTo) return;
      assignJobMutation.mutate({ jobId: job.id, assignedTo: null });
      return;
    }

    const newAssignee = Number(value);
    if (Number.isNaN(newAssignee) || job.assignedTo === newAssignee) {
      return;
    }

    assignJobMutation.mutate({ jobId: job.id, assignedTo: newAssignee });
  };

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: string }) => {
      return apiRequest("PUT", `/api/jobs/${jobId}`, { status });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Status updated",
        description: `Job status changed to ${formatStatusLabel(variables.status)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${variables.jobId}`] });
      void refetchJob();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (value: string, job: JobEntity) => {
    if (!job?.id || job.status === value) return;
    updateStatusMutation.mutate({ jobId: job.id, status: value });
  };

  // Format status label for display
  const formatStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      waiting_assessment: "Waiting Assessment",
      in_progress: "In Progress",
      on_hold: "On Hold",
      ready_for_pickup: "Ready for Pickup",
      completed: "Completed",
    };
    return statusMap[status] || status.replace(/_/g, " ");
  };

  // Status options
  const statusOptions = [
    { value: "waiting_assessment", label: "Waiting Assessment" },
    { value: "in_progress", label: "In Progress" },
    { value: "on_hold", label: "On Hold" },
    { value: "ready_for_pickup", label: "Ready for Pickup" },
    { value: "completed", label: "Completed" },
  ];

  const handleCreateOrder = () => {
    setOrderDialogOpen(true);
  };

  const handleOrderCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: [`/api/orders/job/${numericJobId}`] });
    void refetchOrders();
    setOrderDialogOpen(false);
  };

  // Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { status: string; changeReason?: string; notes?: string } }) =>
      apiRequest("POST", `/api/orders/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/job/${numericJobId}`] });
      void refetchOrders();
      setOrderStatusDialogOpen(false);
      setSelectedOrderForStatus(null);
      statusForm.reset();
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  // Status update form
  const statusForm = useForm<{ status: string; changeReason?: string; notes?: string }>({
    resolver: zodResolver(z.object({
      status: z.enum(["not_ordered", "ordered", "arrived", "completed"]),
      changeReason: z.string().optional(),
      notes: z.string().optional(),
    })),
    defaultValues: {
      status: "ordered",
    },
  });

  // Handle status update
  const onStatusUpdate = (data: { status: string; changeReason?: string; notes?: string }) => {
    if (selectedOrderForStatus) {
      statusUpdateMutation.mutate({ id: selectedOrderForStatus.id, data });
    }
  };

  // Handle order click - open status dialog instead of navigating
  const handleOrderClick = (order: OrderEntity) => {
    setSelectedOrderForStatus(order);
    statusForm.reset({ status: order.status as any });
    setOrderStatusDialogOpen(true);
  };

  // Handle view details - open details dialog
  const handleViewDetails = (order: OrderEntity, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedOrderForDetails(order);
    setOrderDetailsDialogOpen(true);
  };

  // Update customer details mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; phone?: string; address?: string }) => {
      if (!job) throw new Error("No job loaded");
      
      // If job has a customerId, update the customer record
      if (job.customerId) {
        return apiRequest("PUT", `/api/customers/${job.customerId}`, data);
      } else {
        // Otherwise, update the job's customer fields directly
        return apiRequest("PUT", `/api/jobs/${job.id}`, {
          customerName: data.name,
          customerEmail: data.email,
          customerPhone: data.phone,
          customerAddress: data.address,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Customer details updated",
        description: "Customer information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${numericJobId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      void refetchJob();
      setEditingCustomer(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update customer details",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEditCustomer = () => {
    if (job) {
      setCustomerFormData({
        name: job.customerName || "",
        email: job.customerEmail || "",
        phone: job.customerPhone || "",
        address: job.customerAddress || "",
      });
      setEditingCustomer(true);
    }
  };

  const handleCancelEditCustomer = () => {
    setEditingCustomer(false);
    setCustomerFormData({ name: "", email: "", phone: "", address: "" });
  };

  const handleSaveCustomer = () => {
    updateCustomerMutation.mutate(customerFormData);
  };

  // Update job details mutation
  const updateJobMutation = useMutation({
    mutationFn: async (data: { description?: string; equipmentDescription?: string; estimatedHours?: number | null; taskDetails?: string; customerNotified?: boolean }) => {
      if (!job) throw new Error("No job loaded");
      return apiRequest("PUT", `/api/jobs/${job.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Job details updated",
        description: "Job information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${numericJobId}`] });
      void refetchJob();
      setEditingJob(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update job details",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEditJob = () => {
    if (job) {
      setJobFormData({
        description: job.description || "",
        equipmentDescription: job.equipmentDescription || "",
        estimatedHours: job.estimatedHours?.toString() || "",
        taskDetails: job.taskDetails || "",
        customerNotified: !!(job as any).customerNotified,
      });
      setEditingJob(true);
    }
  };

  const handleCancelEditJob = () => {
    setEditingJob(false);
    setJobFormData({ description: "", equipmentDescription: "", estimatedHours: "", taskDetails: "", customerNotified: false });
  };

  const handleSaveJob = () => {
    updateJobMutation.mutate({
      description: jobFormData.description,
      equipmentDescription: jobFormData.equipmentDescription,
      estimatedHours: jobFormData.estimatedHours ? parseInt(jobFormData.estimatedHours) : null,
      taskDetails: jobFormData.taskDetails,
      customerNotified: jobFormData.customerNotified,
    });
  };

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      if (!job?.id) throw new Error("No job ID provided");
      return apiRequest("DELETE", `/api/jobs/${job.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Job deleted",
        description: "The job has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      navigate("/workshop");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete job",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteJob = () => {
    deleteJobMutation.mutate();
    setShowDeleteConfirmDialog(false);
  };


  if (!Number.isFinite(numericJobId)) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-800">Job not found</h1>
        <p className="text-neutral-500">The job you were looking for is missing or has been removed.</p>
        <Button onClick={() => navigate("/workshop")} className="bg-green-700 hover:bg-green-800">
          Back to workshop
        </Button>
      </div>
    );
  }

  if (jobError) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <h1 className="text-2xl font-semibold text-neutral-800">Error loading job</h1>
        <p className="text-neutral-500">
          {jobError instanceof Error ? jobError.message : "Failed to load job details"}
        </p>
        <Button onClick={() => navigate("/workshop")} className="bg-green-700 hover:bg-green-800">
          Back to workshop
        </Button>
      </div>
    );
  }

  const renderHeaderActions = () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => navigate("/workshop")} className="gap-2">
        <ArrowLeft size={16} />
        Back to workshop
      </Button>
      <Button variant="outline" className="gap-2">
        <Printer size={16} />
        Print overview
      </Button>
    </div>
  );

  const renderMetaCard = () => {
    if (jobLoading || !job) {
      return (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      );
    }

    // Safety check - ensure job has required properties
    if (!job || typeof job !== 'object' || !job.id || !job.jobId) {
      return (
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Invalid job data received</p>
          </CardContent>
        </Card>
      );
    }

    const statusBadgeClass = statusToken
      ? cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusToken.bgColor, statusToken.textColor)
      : "inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700";
    const assignedUserName = resolveUserName(job.assignedTo);
    const staffOptions = Array.isArray(users)
      ? users.filter((user: any) => {
          const role = typeof user.role === "string" ? user.role.toLowerCase() : "";
          return role === "mechanic" || role === "admin" || role === "staff";
        })
      : [];
    const assignmentOptions = [...staffOptions];
    if (job.assignedTo && Array.isArray(users) && !assignmentOptions.some((user: any) => user.id === job.assignedTo)) {
      const fallback = users.find((user: any) => user.id === job.assignedTo);
      if (fallback) {
        assignmentOptions.push(fallback);
      }
    }
    const assignmentValue = job.assignedTo ? String(job.assignedTo) : "unassigned";

    return (
      <Card className="border-green-100 shadow-sm">
        <CardHeader className="pb-4">
          <div className="space-y-4">
            {/* Job ID */}
            <CardTitle className="text-2xl font-semibold text-neutral-900">{job?.jobId || "Unknown"}</CardTitle>
            
            {/* Three Fields Row */}
            <div className="flex flex-col gap-3 md:flex-row md:gap-4">
              <div className="w-full md:w-56">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Assign technician
                </span>
                <Select
                  value={assignmentValue}
                  onValueChange={(value) => job && handleAssigneeChange(value, job)}
                  disabled={assignJobMutation.isPending}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={assignmentOptions.length ? "Select team member" : "No staff available"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignmentOptions.map((userOption: any) => (
                      <SelectItem key={userOption.id} value={String(userOption.id)}>
                        {userOption.fullName || userOption.username || `User ${userOption.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-56">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Created
                </span>
                <div className="mt-1 flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-neutral-700">
                  {job?.createdAt ? formatDate(job.createdAt) : "No date"}
                </div>
              </div>
              <div className="w-full md:w-56">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Job stage
                </span>
                <Select
                  value={job?.status || "waiting_assessment"}
                  onValueChange={(value) => job && handleStatusChange(value, job)}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Description */}
            {job.description && <p className="text-sm text-neutral-600">{job.description}</p>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Details Section */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User size={16} className="text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-800">Customer Details</h3>
              </div>
              {!editingCustomer && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEditCustomer}
                  className="h-7 px-2 text-xs"
                >
                  <Edit2 size={14} className="mr-1" />
                  Edit
                </Button>
              )}
            </div>
            
            {editingCustomer ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                      Name
                    </label>
                    <Input
                      value={customerFormData.name}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                      placeholder="Customer name"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={customerFormData.email}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      placeholder="customer@example.com"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                      Phone
                    </label>
                    <Input
                      value={customerFormData.phone}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                      placeholder="01234 567890"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                      Address
                    </label>
                    <Textarea
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                      placeholder="Customer address"
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditCustomer}
                    disabled={updateCustomerMutation.isPending}
                  >
                    <X size={14} className="mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveCustomer}
                    disabled={updateCustomerMutation.isPending}
                    className="bg-green-700 hover:bg-green-800"
                  >
                    <Check size={14} className="mr-1" />
                    {updateCustomerMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <MetaItem
                  icon={<User size={16} />}
                  label="Name"
                  value={job?.customerName || "Not recorded"}
                />
                <MetaItem
                  icon={<Phone size={16} />}
                  label="Phone"
                  value={job?.customerPhone || "No phone recorded"}
                />
                <MetaItem
                  icon={<User size={16} />}
                  label="Email"
                  value={job?.customerEmail || "No email recorded"}
                />
                <MetaItem
                  icon={<MapPin size={16} />}
                  label="Address"
                  value={job?.customerAddress || "No address recorded"}
                  className="sm:col-span-2"
                />
              </div>
            )}
          </div>

          {/* Job Information Section */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-800">Job Information</h3>
              </div>
              {!editingJob && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEditJob}
                  className="h-7 px-2 text-xs"
                >
                  <Edit2 size={14} className="mr-1" />
                  Edit
                </Button>
              )}
            </div>
            
            {editingJob ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                    Job Summary*
                  </label>
                  <Textarea
                    value={jobFormData.description}
                    onChange={(e) => setJobFormData({ ...jobFormData, description: e.target.value })}
                    placeholder="Describe the problem or service required"
                    rows={3}
                    className="resize-none"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                    Brand & Model
                  </label>
                  <Textarea
                    value={jobFormData.equipmentDescription}
                    onChange={(e) => setJobFormData({ ...jobFormData, equipmentDescription: e.target.value })}
                    placeholder="Enter brand, model, and serial number"
                    rows={3}
                    className="resize-none"
                  />
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                      Estimated Hours
                    </label>
                    <Input
                      type="number"
                      value={jobFormData.estimatedHours}
                      onChange={(e) => setJobFormData({ ...jobFormData, estimatedHours: e.target.value })}
                      placeholder="Estimated repair time in hours"
                      className="h-9"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                      Customer Notified
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                      <Switch
                        checked={jobFormData.customerNotified}
                        onCheckedChange={(checked) => setJobFormData({ ...jobFormData, customerNotified: checked })}
                      />
                      <span className="text-sm text-neutral-600">
                        {jobFormData.customerNotified ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1 block">
                    Internal Notes
                  </label>
                  <Input
                    value={jobFormData.taskDetails}
                    onChange={(e) => setJobFormData({ ...jobFormData, taskDetails: e.target.value })}
                    placeholder="Specific tasks or follow-ups for the team"
                    className="h-9"
                  />
                </div>
                
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditJob}
                    disabled={updateJobMutation.isPending}
                  >
                    <X size={14} className="mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveJob}
                    disabled={updateJobMutation.isPending}
                    className="bg-green-700 hover:bg-green-800"
                  >
                    <Check size={14} className="mr-1" />
                    {updateJobMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <MetaItem
                  icon={<Wrench size={16} />}
                  label="Job Summary"
                  value={job?.description || "No description"}
                  className="sm:col-span-2"
                />
                <MetaItem
                  icon={<Wrench size={16} />}
                  label="Brand & Model"
                  value={job?.equipmentDescription || "No equipment details"}
                  className="sm:col-span-2"
                />
                <MetaItem
                  icon={<Clock size={16} />}
                  label="Estimated Hours"
                  value={job?.estimatedHours ? `${job.estimatedHours} hours` : "Not estimated"}
                />
                <MetaItem
                  icon={<User size={16} />}
                  label="Customer Notified"
                  value={(job as any)?.customerNotified ? "Yes" : "No"}
                />
                {job?.taskDetails && (
                  <MetaItem
                    icon={<Wrench size={16} />}
                    label="Internal Notes"
                    value={job.taskDetails}
                    className="sm:col-span-2"
                  />
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title={jobLoading || !job ? "Loading job..." : `Workshop job ${job.jobId}`}
        description="Full visibility of the repair, work history, and parts ordered."
        actions={renderHeaderActions()}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="mt-2">
          <TabsList>
            <TabsTrigger value="overview">Job Overview</TabsTrigger>
            <TabsTrigger value="job-sheet">Job Sheet</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr] mt-4">
              <div className="space-y-6">
                {renderMetaCard()}
              </div>

              <aside className="space-y-6">
                <OrdersPanel
                  isLoading={ordersLoading}
                  orders={orders}
                  onCreate={handleCreateOrder}
                  jobId={numericJobId}
                  onOrderClick={handleOrderClick}
                  onViewDetails={handleViewDetails}
                />
                {job && (
                  <CustomerActions
                    jobId={job.id}
                    customerEmail={
                      orders.length > 0 && orders[0].customerEmail
                        ? orders[0].customerEmail
                        : job.customerEmail
                    }
                    customerName={job.customerName}
                    equipmentDescription={job.equipmentDescription}
                  />
                )}
                <StatusTimeline
                  job={job ? {
                    id: job.id,
                    status: job.status,
                    createdAt: job.createdAt,
                  } : null}
                  jobUpdates={jobUpdates}
                  isLoading={jobUpdatesLoading}
                />
                <WorkshopActivity 
                  activities={jobActivities} 
                  isLoading={activitiesLoading} 
                  limit={5}
                  job={job ? {
                    id: job.id,
                    status: job.status,
                    createdAt: job.createdAt,
                    timeInStatusDays: (job as any).timeInStatusDays,
                  } : null}
                  jobUpdates={jobUpdates}
                />
                {job && !editingJob && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirmDialog(true)}
                    disabled={deleteJobMutation.isPending}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {deleteJobMutation.isPending ? "Deleting..." : "Delete Job"}
                  </Button>
                )}
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="job-sheet" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr] mt-4">
              <div className="space-y-6">
                {job && (
                  <JobSheet
                    jobId={job.id}
                    onWorkAdded={() => {
                      refetchJob();
                    }}
                  />
                )}
              </div>

              <aside className="space-y-6">
                <OrdersPanel
                  isLoading={ordersLoading}
                  orders={orders}
                  onCreate={handleCreateOrder}
                  jobId={numericJobId}
                  onOrderClick={handleOrderClick}
                  onViewDetails={handleViewDetails}
                />
                {job && (
                  <CustomerActions
                    jobId={job.id}
                    customerEmail={
                      orders.length > 0 && orders[0].customerEmail
                        ? orders[0].customerEmail
                        : job.customerEmail
                    }
                    customerName={job.customerName}
                    equipmentDescription={job.equipmentDescription}
                  />
                )}
                <StatusTimeline
                  job={job ? {
                    id: job.id,
                    status: job.status,
                    createdAt: job.createdAt,
                  } : null}
                  jobUpdates={jobUpdates}
                  isLoading={jobUpdatesLoading}
                />
                <WorkshopActivity 
                  activities={jobActivities} 
                  isLoading={activitiesLoading} 
                  limit={5}
                  job={job ? {
                    id: job.id,
                    status: job.status,
                    createdAt: job.createdAt,
                    timeInStatusDays: (job as any).timeInStatusDays,
                  } : null}
                  jobUpdates={jobUpdates}
                />
                {job && !editingJob && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirmDialog(true)}
                    disabled={deleteJobMutation.isPending}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {deleteJobMutation.isPending ? "Deleting..." : "Delete Job"}
                  </Button>
                )}
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {job && job.id && job.jobId && (
        <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Order for {job.jobId}</DialogTitle>
            </DialogHeader>
            <OrderForm
              initialData={{
                relatedJobId: job.id,
                customerName: job.customerName || "",
                customerPhone: job.customerPhone || "",
                customerEmail: job.customerEmail || "",
                notes: job.description ? `Requested for job ${job.jobId}: ${job.description}` : undefined,
              }}
              onSuccess={handleOrderCreated}
              onCancel={() => setOrderDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Order Details Dialog */}
      {selectedOrderForDetails && (
        <OrderDetailsDialog
          order={selectedOrderForDetails}
          isOpen={orderDetailsDialogOpen}
          onClose={() => {
            setOrderDetailsDialogOpen(false);
            setSelectedOrderForDetails(null);
          }}
        />
      )}

      {/* Order Status Update Dialog */}
      <Dialog open={orderStatusDialogOpen} onOpenChange={setOrderStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Update the status of order {selectedOrderForStatus?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          <Form {...statusForm}>
            <form onSubmit={statusForm.handleSubmit(onStatusUpdate)} className="space-y-4">
              <FormField
                control={statusForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_ordered">Not Ordered</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="arrived">Arrived</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={statusForm.control}
                name="changeReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Change (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Supplier confirmed delivery date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={statusForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOrderStatusDialogOpen(false);
                    setSelectedOrderForStatus(null);
                    statusForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={statusUpdateMutation.isPending} className="bg-green-700 hover:bg-green-800">
                  {statusUpdateMutation.isPending ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent className="z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be undone. 
              All related services, payment requests, and work records will also be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MetaItemProps {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
  subValue?: string | null;
  className?: string;
}

function MetaItem({ icon, label, value, subValue, className }: MetaItemProps) {
  return (
    <div className={cn("rounded-lg border border-neutral-100 bg-neutral-50/60 p-4", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-neutral-600 break-words">{value || "—"}</div>
      {subValue && <div className="mt-1 text-xs text-neutral-500 break-words">{subValue}</div>}
    </div>
  );
}

interface OrdersPanelProps {
  orders: OrderEntity[];
  isLoading: boolean;
  onCreate: () => void;
  jobId: number;
  onOrderClick: (order: OrderEntity) => void;
  onViewDetails: (order: OrderEntity, event?: React.MouseEvent) => void;
}

function OrdersPanel({ orders, isLoading, onCreate, jobId, onOrderClick, onViewDetails }: OrdersPanelProps) {
  return (
    <Card className="border-green-100">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold text-neutral-800">Orders</CardTitle>
        <Button size="sm" variant="outline" className="gap-1 text-green-700 hover:bg-green-50" onClick={onCreate}>
          <Package size={14} />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            No orders have been created for this job yet.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onOrderClick={onOrderClick}
                  onViewDetails={onViewDetails}
                />
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-4 pt-4 border-t border-neutral-100">
              Add an order that you've made for something related to this job
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    not_ordered: { label: "Not Ordered", className: "bg-red-100 text-red-700 border-red-300" },
    ordered: { label: "Ordered", className: "bg-blue-100 text-blue-700 border-blue-300" },
    arrived: { label: "Arrived", className: "bg-green-100 text-green-700 border-green-300" },
    completed: { label: "Completed", className: "bg-green-600 text-white" },
  };
  
  const config = statusConfig[status] || { label: status, className: "bg-neutral-100 text-neutral-700" };
  
  return <Badge className={config.className}>{config.label}</Badge>;
}

interface OrderCardProps {
  order: OrderEntity;
  onOrderClick: (order: OrderEntity) => void;
  onViewDetails: (order: OrderEntity, event?: React.MouseEvent) => void;
}

function OrderCard({ order, onOrderClick, onViewDetails }: OrderCardProps) {
  const { data: orderItems = [], isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: [`/api/orders/${order.id}/items`],
    enabled: !!order.id,
  });

  return (
    <div 
      className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:border-green-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div 
              className="text-sm font-semibold text-neutral-900 cursor-pointer hover:text-green-700"
              onClick={() => onOrderClick(order)}
            >
              {order.orderNumber}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-neutral-500 hover:text-green-700"
              onClick={(e) => onViewDetails(order, e)}
              title="View order details"
            >
              <Eye size={14} />
            </Button>
          </div>
          {order.supplierName && (
            <div className="text-xs text-neutral-500 mt-0.5">{order.supplierName}</div>
          )}
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Order Items Preview */}
      {itemsLoading ? (
        <div className="text-xs text-neutral-400 mb-2">Loading items...</div>
      ) : orderItems.length > 0 ? (
        <div className="mb-3 space-y-1">
          <div className="text-xs font-semibold text-neutral-600 mb-1">Items:</div>
          <div className="space-y-1">
            {orderItems.slice(0, 3).map((item: any) => (
              <div key={item.id} className="text-xs text-neutral-700 flex items-center gap-2">
                <span className="text-neutral-500">•</span>
                <span className="flex-1">
                  {item.quantity > 1 && <span className="font-medium">{item.quantity}x </span>}
                  {item.itemName}
                </span>
                {item.totalPrice && (
                  <span className="text-neutral-500">£{item.totalPrice.toFixed(2)}</span>
                )}
              </div>
            ))}
            {orderItems.length > 3 && (
              <div className="text-xs text-neutral-500 italic">
                +{orderItems.length - 3} more item{orderItems.length - 3 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
        {order.estimatedTotalCost != null && (
          <div className="flex justify-between">
            <span>Estimated cost</span>
            <span className="font-medium">£{order.estimatedTotalCost.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Expected delivery</span>
          <span>
            {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "Not provided"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface OrderDetailsDialogProps {
  order: OrderEntity;
  isOpen: boolean;
  onClose: () => void;
}

function OrderDetailsDialog({ order, isOpen, onClose }: OrderDetailsDialogProps) {
  const { data: orderItems = [], isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: [`/api/orders/${order.id}/items`],
    enabled: isOpen && !!order.id,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order {order.orderNumber} Details</DialogTitle>
          <DialogDescription>
            Complete information for this order
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase mb-1">Status</div>
              <OrderStatusBadge status={order.status} />
            </div>
            {order.supplierName && (
              <div>
                <div className="text-xs font-semibold text-neutral-500 uppercase mb-1">Supplier</div>
                <div className="text-sm">{order.supplierName}</div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div>
            <div className="text-sm font-semibold text-neutral-800 mb-2">Order Items ({orderItems.length})</div>
            {itemsLoading ? (
              <div className="text-sm text-neutral-500">Loading items...</div>
            ) : orderItems.length === 0 ? (
              <div className="text-sm text-neutral-500">No items in this order</div>
            ) : (
              <div className="space-y-2">
                {orderItems.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-3 bg-neutral-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.itemName}</div>
                        {item.itemSku && (
                          <div className="text-xs text-neutral-500 font-mono mt-1">SKU: {item.itemSku}</div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-neutral-600">
                          <span>Qty: <span className="font-medium">{item.quantity}</span></span>
                          {item.itemType && (
                            <Badge variant="outline" className="text-xs">{item.itemType}</Badge>
                          )}
                        </div>
                        {item.notes && (
                          <div className="text-xs text-neutral-500 mt-2">{item.notes}</div>
                        )}
                      </div>
                      <div className="text-right">
                        {item.unitPrice && (
                          <div className="text-xs text-neutral-500">£{item.unitPrice.toFixed(2)} each</div>
                        )}
                        {item.totalPrice && (
                          <div className="text-sm font-semibold mt-1">£{item.totalPrice.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="border-t pt-4 space-y-2">
            {order.estimatedTotalCost != null && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Estimated Total Cost</span>
                <span className="font-semibold">£{order.estimatedTotalCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Expected Delivery</span>
              <span>
                {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "Not provided"}
              </span>
            </div>
            {order.actualDeliveryDate && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Actual Delivery</span>
                <span>{formatDate(order.actualDeliveryDate)}</span>
              </div>
            )}
            {order.notes && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-neutral-500 uppercase mb-1">Notes</div>
                <div className="text-sm text-neutral-700">{order.notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
