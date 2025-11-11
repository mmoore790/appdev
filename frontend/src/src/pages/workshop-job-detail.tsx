import { useMemo, useState } from "react";
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
import { PartOrderQuickCreate } from "@/components/part-order-quick-create";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface JobEntity {
  id: number;
  jobId: string;
  status: string;
  description?: string;
  taskDetails?: string;
  equipmentDescription?: string;
  assignedTo?: number | null;
  customerId?: number | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PartOrderEntity {
  id: number;
  partName: string;
  supplier: string;
  status: string;
  quantity: number;
  estimatedCost?: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  createdAt: string;
  isArrived: boolean;
  isCustomerNotified: boolean;
}

export default function WorkshopJobDetail() {
  const [, params] = useRoute<{ jobId: string }>("/workshop/jobs/:jobId");
  const [, navigate] = useLocation();
  const numericJobId = params?.jobId ? Number(params.jobId) : NaN;

  const [activeTab, setActiveTab] = useState<"overview" | "work" | "summary">("overview");
  const [partsDialogOpen, setPartsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: job,
    isLoading: jobLoading,
    refetch: refetchJob,
  } = useQuery<JobEntity | null>({
    queryKey: [Number.isFinite(numericJobId) ? `/api/jobs/${numericJobId}` : null],
    enabled: Number.isFinite(numericJobId),
  });

  const { data: services = [] } = useQuery<any[]>({
    queryKey: Number.isFinite(numericJobId) ? [`/api/services?jobId=${numericJobId}`] : ["services/disabled"],
    enabled: Number.isFinite(numericJobId),
  });

  const {
    data: partOrders = [],
    isLoading: partsLoading,
    refetch: refetchParts,
  } = useQuery<PartOrderEntity[]>({
    queryKey: Number.isFinite(numericJobId) ? [`/api/parts-on-order/job/${numericJobId}`] : ["parts-orders/disabled"],
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

  const handleCreatePartsOrder = () => {
    setPartsDialogOpen(true);
  };

  const handlePartOrderCreated = () => {
    setActiveTab("work");
    void refetchParts();
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

  const renderHeaderActions = () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => navigate("/workshop")} className="gap-2">
        <ArrowLeft size={16} />
        Back to workshop
      </Button>
      <Button
        variant="outline"
        onClick={() => setPartsDialogOpen(true)}
        className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
        disabled={!job || jobLoading}
      >
        <Package size={16} />
        Order parts
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
            <CardTitle className="text-2xl font-semibold text-neutral-900">{job.jobId}</CardTitle>
            <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
              <div className="flex items-center gap-3">
                <span className={statusBadgeClass}>{job.status.replace(/_/g, " ")}</span>
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
                  onValueChange={(value) => handleAssigneeChange(value, job)}
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
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem
            icon={<User size={16} />}
            label="Customer"
            value={job.customerName || "Not recorded"}
            subValue={job.customerEmail}
          />
          <MetaItem
            icon={<UserCheck size={16} />}
            label="Assigned to"
            value={assignedUserName ?? "Unassigned"}
          />
          <MetaItem
            icon={<Phone size={16} />}
            label="Phone"
            value={job.customerPhone || "No phone recorded"}
          />
          <MetaItem
            icon={<Calendar size={16} />}
            label="Created"
            value={job.createdAt ? formatDate(job.createdAt) : "No date"}
          />
          <MetaItem
            icon={<Clock size={16} />}
            label="Last updated"
            value={job.updatedAt ? formatDate(job.updatedAt) : "Never updated"}
          />
          <MetaItem
            icon={<Wrench size={16} />}
            label="Equipment"
            value={job.equipmentDescription || "No equipment details"}
            className="sm:col-span-2"
          />
          {job.customerAddress && (
            <MetaItem
              icon={<MapPin size={16} />}
              label="Address"
              value={job.customerAddress}
              className="sm:col-span-2"
            />
          )}
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
            <PartsPanel
              isLoading={partsLoading}
              parts={partOrders}
              onCreate={handleCreatePartsOrder}
            />
            <WorkshopActivity activities={jobActivities} isLoading={activitiesLoading} limit={5} />
          </aside>
        </div>
      </div>

      {job && (
        <PartOrderQuickCreate
          jobId={job.id}
          jobCode={job.jobId}
          open={partsDialogOpen}
          onOpenChange={setPartsDialogOpen}
          customerName={job.customerName || "Workshop customer"}
          customerPhone={job.customerPhone}
          customerEmail={job.customerEmail}
          defaultNotes={job.description ? `Requested for job ${job.jobId}: ${job.description}` : undefined}
          onCreated={handlePartOrderCreated}
        />
      )}
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
      <div className="mt-2 text-sm font-medium text-neutral-800">{value || "—"}</div>
      {subValue && <div className="mt-1 text-xs text-neutral-500">{subValue}</div>}
    </div>
  );
}

interface PartsPanelProps {
  parts: PartOrderEntity[];
  isLoading: boolean;
  onCreate: () => void;
}

function PartsPanel({ parts, isLoading, onCreate }: PartsPanelProps) {
  return (
    <Card className="border-green-100">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold text-neutral-800">Parts on order</CardTitle>
        <Button size="sm" variant="outline" className="gap-1 text-green-700 hover:bg-green-50" onClick={onCreate}>
          <Package size={14} />
          Log new
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : parts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            No parts have been ordered for this job yet.
          </div>
        ) : (
          <div className="space-y-4">
            {parts.map((part) => (
              <div key={part.id} className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{part.partName}</div>
                    <div className="text-xs text-neutral-500">{part.supplier}</div>
                  </div>
                  <StatusPill status={part.status} isArrived={part.isArrived} isNotified={part.isCustomerNotified} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Quantity</span>
                    <span>{part.quantity}</span>
                  </div>
                  {part.estimatedCost != null && (
                    <div className="flex justify-between">
                      <span>Estimated cost</span>
                      <span>£{part.estimatedCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Expected</span>
                    <span>
                      {part.expectedDeliveryDate ? formatDate(part.expectedDeliveryDate) : "Not provided"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatusPillProps {
  status: string;
  isArrived: boolean;
  isNotified: boolean;
}

function StatusPill({ status, isArrived, isNotified }: StatusPillProps) {
  if (status === "collected") {
    return <Badge className="bg-green-600 text-white">Collected</Badge>;
  }
  if (isArrived) {
    return <Badge className="bg-blue-600 text-white">Ready for pickup</Badge>;
  }
  if (isNotified) {
    return <Badge className="bg-amber-500 text-white">Customer notified</Badge>;
  }
  return <Badge variant="outline">Ordered</Badge>;
}
