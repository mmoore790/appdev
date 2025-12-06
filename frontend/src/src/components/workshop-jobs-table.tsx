import { useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Search, Plus, Printer } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { formatDate, getStatusColor, cn } from "../lib/utils";
import { JobWizard } from "./job-wizard";
import { PrintJobDialog } from "./print-job-dialog";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

export interface WorkshopJobsTableProps {
  jobs: any[];
  isLoading?: boolean;
  showSearch?: boolean;
  showPagination?: boolean;
  className?: string;
}

export function WorkshopJobsTable({
  jobs = [],
  isLoading = false,
  showSearch = false,
  showPagination = true,
  className = "",
}: WorkshopJobsTableProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [wizardDialogOpen, setWizardDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [statusChangeJob, setStatusChangeJob] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const itemsPerPage = 10;
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: string }) => {
      return apiRequest("PUT", `/api/jobs/${jobId}`, { status });
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
    },
  });

  const handleStatusChange = (job: any, status: string) => {
    if (status === "ready_for_pickup") {
      setStatusChangeJob(job);
      setNewStatus(status);
      setConfirmDialogOpen(true);
    } else {
      const navigateAfterUpdate = false;
      statusUpdateMutation.mutate(
        { jobId: job.id, status },
        {
          onSuccess: () => {
            if (navigateAfterUpdate) {
              handleNavigateToJob(job.id);
            }
          },
        }
      );
    }
  };

  const confirmStatusChange = () => {
    if (statusChangeJob && newStatus) {
      statusUpdateMutation.mutate({
        jobId: statusChangeJob.id,
        status: newStatus,
      });
    }
  };

  const { data: customerData = [] } = useQuery({
    queryKey: ["/api/customers"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: userData = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 1000 * 60 * 5,
  });

  const customerMap: Record<number, string> = {};
  if (Array.isArray(customerData)) {
    customerData.forEach((customer: any) => {
      if (customer && customer.id && customer.name) {
        customerMap[customer.id] = customer.name;
      }
    });
  }

  const userMap: Record<number, string> = {};
  if (Array.isArray(userData)) {
    userData.forEach((user: any) => {
      if (user && user.id) {
        userMap[user.id] = user.fullName || user.username;
      }
    });
  }

  const filteredJobs = jobs.filter((job) => {
    const searchTerms = searchQuery.toLowerCase().trim();
    if (!searchTerms) return true;

    if (job.jobId?.toLowerCase().includes(searchTerms)) return true;
    if (job.equipmentDescription?.toLowerCase().includes(searchTerms)) return true;
    if (formatStatus(job.status).toLowerCase().includes(searchTerms)) return true;

    const customerName = getCustomerName(job.customerId, job).toLowerCase();
    if (customerName.includes(searchTerms)) return true;

    return false;
  });

  const totalPages = Math.max(Math.ceil(filteredJobs.length / itemsPerPage), 1);
  const effectivePage = Math.min(currentPage, totalPages);
  const startIndex = (effectivePage - 1) * itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  const handleNavigateToJob = (jobId: number | null | undefined) => {
    if (!jobId) return;
    navigate(`/workshop/jobs/${jobId}`);
  };

  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  function getCustomerName(customerId: number | null, job?: any): string {
    if (job && job.customer) {
      return job.customer;
    }

    if (customerId && customerMap[customerId]) {
      return customerMap[customerId];
    }

    if (job?.customerName) {
      return job.customerName;
    }

    return "Unknown Customer";
  }

  function getCustomerEmail(customerId: number): string {
    return "";
  }

  function getEquipmentName(job: any): string {
    if (!job) return "No equipment specified";

    if (job.equipmentDescription && typeof job.equipmentDescription === "string" && job.equipmentDescription.trim() !== "") {
      return job.equipmentDescription;
    }

    if (job.equipmentId) {
      const equipmentData: Record<number, string> = {
        1: "Honda Lawnmower HRX217",
        2: "Stihl Chainsaw MS250",
        3: "John Deere Tractor X350",
        4: "Husqvarna Trimmer 128LD",
        5: "ECHO Leaf Blower PB-2520",
      };

      return equipmentData[job.equipmentId] || "Unknown Equipment";
    }

    return "No equipment specified";
  }

  function getAssigneeName(assigneeId: number): string {
    if (!assigneeId) return "Unassigned";
    if (userMap[assigneeId]) {
      return userMap[assigneeId];
    }
    return "Unknown Assignee";
  }

  function formatStatus(status: string): string {
    switch (status) {
      case "waiting_assessment":
        return "Waiting Assessment";
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showSearch && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Input
                type="text"
                placeholder="Search jobs, customers..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 w-full rounded-md border-neutral-200 pl-10 pr-3 text-sm shadow-sm focus-visible:border-green-600 focus-visible:ring-green-600"
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                onClick={() => setWizardDialogOpen(true)}
                className="h-11 gap-1.5 bg-green-700 text-white hover:bg-green-800"
              >
                <Plus size={16} />
                New Job
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="hidden lg:block">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] px-4 py-4">
            <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow className="border-b border-neutral-200">
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Job ID
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Brand &amp; Model
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Customer
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Assigned To
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Status
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Created
                    </TableHead>
                    <TableHead className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
                        <p className="text-sm text-neutral-600">Loading jobs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                  ) : filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-full bg-neutral-100 p-3">
                          <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-700">No jobs found</p>
                          <p className="text-xs text-neutral-500">Try adjusting your filters or create a new job.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  ) : (
                    paginatedJobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="border-b border-neutral-100 transition-colors hover:bg-neutral-50 cursor-pointer"
                        onClick={() => handleNavigateToJob(job.id)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleNavigateToJob(job.id);
                          }
                        }}
                      >
                        <TableCell className="px-6 py-4 text-sm font-semibold text-green-800">
                          <button
                            type="button"
                            className="text-left underline-offset-2 hover:underline focus-visible:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleNavigateToJob(job.id);
                            }}
                          >
                            {job.jobId}
                          </button>
                        </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        {getEquipmentName(job)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                            {getCustomerName(job.customerId, job)
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-neutral-800">
                              {getCustomerName(job.customerId, job)}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {getCustomerEmail(job.customerId)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-700">
                        {job.assignedTo ? (
                          getAssigneeName(job.assignedTo)
                        ) : (
                          <span className="font-medium text-amber-600">Unassigned</span>
                        )}
                      </TableCell>
                        <TableCell className="px-6 py-4" onClick={stopPropagation}>
                        <Select
                          value={job.status}
                          onValueChange={(status) => handleStatusChange(job, status)}
                          disabled={statusUpdateMutation.isPending}
                        >
                          <SelectTrigger className="w-44 border-neutral-200">
                            <SelectValue>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                  getStatusColor(job.status).bgColor,
                                  getStatusColor(job.status).textColor
                                )}
                              >
                                {formatStatus(job.status)}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="waiting_assessment">Waiting Assessment</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-neutral-600">
                        {formatDate(job.createdAt)}
                      </TableCell>
                        <TableCell className="px-6 py-4 text-right" onClick={stopPropagation}>
                          <div className="flex items-center justify-end gap-2">
                            <PrintJobDialog
                              job={job}
                              customerName={getCustomerName(job.customerId, job)}
                              equipmentName={getEquipmentName(job)}
                              assigneeName={getAssigneeName(job.assignedTo)}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 border-neutral-200 text-neutral-600 hover:text-green-700"
                                >
                                  <Printer size={14} />
                                  <span className="hidden sm:inline">Print</span>
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="lg:hidden overflow-y-auto max-h-[600px] px-4 py-4">
          {isLoading ? (
            <div className="py-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
              <p className="mt-3 text-sm text-neutral-600">Loading jobs...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-10 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-neutral-100 p-3">
                  <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">No jobs found</p>
                  <p className="text-xs text-neutral-500">Try adjusting your filters or create a new job.</p>
                </div>
              </div>
            </div>
            ) : (
              <div className="space-y-4">
                {paginatedJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="border border-neutral-200 shadow-sm cursor-pointer"
                    onClick={() => handleNavigateToJob(job.id)}
                  >
                    <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-lg font-semibold text-green-800 block mb-1">{job.jobId}</span>
                            <p className="text-sm font-medium text-neutral-800">{getEquipmentName(job)}</p>
                          </div>
                          <div className="flex gap-2">
                            <PrintJobDialog
                              job={job}
                              customerName={getCustomerName(job.customerId, job)}
                              equipmentName={getEquipmentName(job)}
                              assigneeName={getAssigneeName(job.assignedTo)}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-neutral-200 text-neutral-600 hover:text-green-700"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Printer size={14} />
                                </Button>
                              }
                            />
                          </div>
                        </div>

                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">
                          {getCustomerName(job.customerId, job)
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-800">
                            {getCustomerName(job.customerId, job)}
                          </p>
                          <p className="text-xs text-neutral-500">
                            Assigned:&nbsp;
                            {job.assignedTo ? (
                              getAssigneeName(job.assignedTo)
                            ) : (
                              <span className="font-semibold text-amber-600">Unassigned</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3" onClick={stopPropagation}>
                        <Select
                          value={job.status}
                          onValueChange={(status) => handleStatusChange(job, status)}
                          disabled={statusUpdateMutation.isPending}
                        >
                          <SelectTrigger className="w-full border-neutral-200">
                            <SelectValue>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                                  getStatusColor(job.status).bgColor,
                                  getStatusColor(job.status).textColor
                                )}
                              >
                                {formatStatus(job.status)}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="waiting_assessment">Waiting Assessment</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-neutral-500">{formatDate(job.createdAt)}</span>
                      </div>

                        <div className="flex justify-end" onClick={stopPropagation}>
                          <PrintJobDialog
                            job={job}
                            customerName={getCustomerName(job.customerId, job)}
                            equipmentName={getEquipmentName(job)}
                            assigneeName={getAssigneeName(job.assignedTo)}
                            trigger={
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 border-neutral-200 text-neutral-600 hover:text-green-700"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Printer size={14} />
                                <span className="text-xs font-medium">Print</span>
                              </Button>
                            }
                          />
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
          )}
        </div>
      </div>

      {showPagination && filteredJobs.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredJobs.length)} of {filteredJobs.length} jobs
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => goToPage(effectivePage - 1)}
                  className={effectivePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (effectivePage <= 3) {
                  page = i + 1;
                } else if (effectivePage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = effectivePage - 2 + i;
                }

                return (
                  <PaginationItem key={page} className="hidden sm:block">
                    <button
                      onClick={() => goToPage(page)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                        page === effectivePage
                          ? "border border-green-600 bg-green-50 text-green-700"
                          : "text-neutral-600 hover:bg-neutral-50"
                      )}
                    >
                      {page}
                    </button>
                  </PaginationItem>
                );
              })}
              <PaginationItem className="sm:hidden">
                <span className="flex h-9 items-center px-3 text-sm font-medium text-neutral-700">
                  {effectivePage} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => goToPage(effectivePage + 1)}
                  className={effectivePage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              {newStatus === "ready_for_pickup" && (
                <>
                  Are you sure you want to mark job <strong>{statusChangeJob?.jobId}</strong> as ready for pickup?
                  {(() => {
                    const customerEmail = statusChangeJob ? getCustomerEmail(statusChangeJob.customerId) : "";
                    return customerEmail
                      ? ` This will send an email notification to the customer at ${customerEmail}.`
                      : " This will notify the customer using their saved contact preferences.";
                  })()}
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
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {statusUpdateMutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JobWizard open={wizardDialogOpen} onOpenChange={setWizardDialogOpen} mode="create" />
    </div>
  );
}
