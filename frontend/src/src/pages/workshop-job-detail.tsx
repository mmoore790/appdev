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
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobForm } from "@/components/job-form";
import { WorkCompletedForm } from "@/components/work-completed-form";
import { WorkDetailsSummary } from "@/components/work-details-summary";
import { WorkshopActivity } from "@/components/workshop-activity";
import { OrderForm } from "@/components/order-form";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

  const [activeTab, setActiveTab] = useState<"overview" | "work" | "summary">("overview");
  const [partsDialogOpen, setPartsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <CardTitle className="text-2xl font-semibold text-neutral-900">{job?.jobId || "Unknown"}</CardTitle>
            <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
              <div className="flex items-center gap-3">
                <span className={statusBadgeClass}>{(job?.status || "unknown").replace(/_/g, " ")}</span>
                {assignedUserName ? (
                  <Badge variant="outline" className="border-blue-200 text-blue-600">
                    <UserCheck size={14} className="mr-1" />
                    {assignedUserName}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    Awaiting assignment
                  </Badge>
                )}
              </div>
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
            </div>
          </div>
          {job.description && <p className="text-sm text-neutral-600">{job.description}</p>}
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

          {/* Other Job Details */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaItem
              icon={<Calendar size={16} />}
              label="Created"
              value={job?.createdAt ? formatDate(job.createdAt) : "No date"}
            />
            <MetaItem
              icon={<Clock size={16} />}
              label="Last updated"
              value={job?.updatedAt ? formatDate(job.updatedAt) : "Never updated"}
            />
            <MetaItem
              icon={<Wrench size={16} />}
              label="Equipment"
              value={job?.equipmentDescription || "No equipment details"}
              className="sm:col-span-2 lg:col-span-1"
            />
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

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {renderMetaCard()}

            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-semibold text-neutral-800">Job workspace</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
                  <TabsList>
                    <TabsTrigger value="overview">Job details</TabsTrigger>
                    <TabsTrigger value="work">Work completed</TabsTrigger>
                    <TabsTrigger value="summary">Summary & printouts</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    {job && (
                      <JobForm
                        jobId={job.id}
                        editMode
                        onComplete={() => {
                          refetchJob();
                        }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="work" className="space-y-4">
                    {job && (
                      <WorkCompletedForm
                        jobId={job.id}
                        onWorkAdded={() => {
                          refetchJob();
                        }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="summary" className="space-y-4">
                    {job && (
                      <WorkDetailsSummary
                        jobId={job.id}
                        services={Array.isArray(services) ? services : []}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
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
            <WorkshopActivity activities={jobActivities} isLoading={activitiesLoading} limit={5} />
          </aside>
        </div>
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
      <div className="mt-2 text-sm font-medium text-neutral-800 break-words">{value || "—"}</div>
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
