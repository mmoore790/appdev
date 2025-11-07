import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Printer, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate, generateJobId, getStatusColor } from "@/lib/utils";
import { PrintJobDialog } from "@/components/print-job-dialog";
import { JobServiceForm } from "@/components/job-service-form";
import { WorkDetailsSummary } from "@/components/work-details-summary";
import { WorkCompletedForm } from "@/components/work-completed-form";

// Define the job schema for form validation
const jobSchema = z.object({
  jobId: z.string().min(3, { message: "Job ID is required" }),
  customerId: z.string().optional(),
  customerName: z.string().min(1, { message: "Customer name is required" }),
  customerEmail: z.string().email("Please enter a valid email").optional(),
  customerPhone: z.string().optional(),
  equipmentId: z.string().optional(),
  equipmentDescription: z.string().optional(),
  assignedTo: z.string().optional(),
  status: z.string(),
  description: z.string().min(3, { message: "Description is required" }),
  taskDetails: z.string().optional(),
  estimatedHours: z.string().optional(),
  customerNotified: z.boolean().optional(),
});

interface JobFormProps {
  jobId?: number;
  editMode?: boolean;
  readOnly?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function JobForm({ jobId, editMode = false, readOnly = false, onComplete, onCancel }: JobFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState("details");
  const [showCustomerNotification, setShowCustomerNotification] = useState(false);
  const [showPrintOption, setShowPrintOption] = useState(false);
  const [createdJob, setCreatedJob] = useState<any>(null);
  const [showServiceSection, setShowServiceSection] = useState(false);

  // State for custom customer name
  const [customCustomerName, setCustomCustomerName] = useState("");
  
  // Status change confirmation dialog state
  const [showStatusConfirmDialog, setShowStatusConfirmDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);
  
  // Delete job confirmation dialog state
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  
  // Form setup
  const form = useForm<z.infer<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      jobId: "",
      customerId: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      equipmentId: "",
      equipmentDescription: "",
      assignedTo: "",
      status: "waiting_assessment",
      description: "",
      taskDetails: "",
      estimatedHours: "",
      customerNotified: false
    }
  });

  // Generate job ID asynchronously when creating new jobs
  useEffect(() => {
    if (!jobId && !editMode && !readOnly) {
      generateJobId().then(newJobId => {
        form.setValue("jobId", newJobId);
      });
    }
  }, [jobId, editMode, readOnly, form]);
  
  // Handle customer name change
  const handleCustomerNameChange = (value: string) => {
    setCustomCustomerName(value);
    form.setValue("customerName", value);
  };

  // Define job interface to fix type errors
  interface JobData {
    id?: number;
    jobId?: string;
    customerId?: number;
    customerName?: string;
    equipmentId?: number;
    equipmentDescription?: string;
    assignedTo?: number;
    status?: string;
    description?: string;
    taskDetails?: string;
    estimatedHours?: number;
    customerNotified?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }
  
  // Generate a unique timestamp for each query to force fresh data
  const [queryTimestamp, setQueryTimestamp] = useState(Date.now());

  // Fetch job data if in edit mode
  const { data: job, isLoading: isJobLoading, refetch: refetchJob } = useQuery({
    queryKey: [`/api/jobs/${jobId}`, queryTimestamp], // Use timestamp to force fresh data
    queryFn: async () => {
      if (!jobId) return null;
      const response = await fetch(`/api/jobs/${jobId}?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always'
  });

  // Fetch customers for dropdown
  const { data: customers = [], isLoading: isCustomersLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Fetch equipment for dropdown
  const { data: allEquipment = [], isLoading: isEquipmentLoading } = useQuery({
    queryKey: ["/api/equipment"],
  });

  // Fetch users for dropdown (mechanics)
  const { data: users = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  // Fetch services for this job
  const { data: services = [], isLoading: isServicesLoading } = useQuery({
    queryKey: jobId ? [`/api/services?jobId=${jobId}`] : ['unused-key'],
    enabled: !!jobId
  });

  // Get equipment for selected customer
  const [customerEquipment, setCustomerEquipment] = useState<any[]>([]);
  
  useEffect(() => {
    const customerId = form.watch("customerId");
    if (customerId && Array.isArray(allEquipment)) {
      const equipment = allEquipment.filter(item => item.customerId === parseInt(customerId));
      setCustomerEquipment(equipment);
    } else {
      setCustomerEquipment([]);
    }
  }, [form.watch("customerId"), allEquipment]);

  // Use all users as potential assignees
  console.log("Users data:", users);

  // Refetch job data when component mounts or jobId changes
  useEffect(() => {
    if (jobId) {
      setQueryTimestamp(Date.now()); // Force new query with fresh timestamp
      if (refetchJob) {
        refetchJob();
      }
    }
  }, [jobId]);

  // Update form values when job data is loaded
  useEffect(() => {
    // Only process if job exists and has data
    if (job && typeof job === 'object' && 'jobId' in job) {
      console.log("[JobForm] Loading job data into form:", job);
      
      // Check if we have a custom customer name from the job
      if ('customerName' in job && job.customerName) {
        setCustomCustomerName(job.customerName as string);
      }
      
      // Get customer data from customers array if we have a customerId
      let customerName = (job as any).customerName || "";
      let customerEmail = "";
      let customerPhone = "";
      
      if ((job as any).customerId && customers && Array.isArray(customers)) {
        const customer = customers.find((c: any) => c.id === (job as any).customerId);
        if (customer) {
          customerName = customer.name;
          customerEmail = customer.email || "";
          customerPhone = customer.phone || "";
          // Set the custom customer name state for display
          setCustomCustomerName(customer.name);
        }
      } else if ((job as any).customerName) {
        // If no customerId but we have a customerName (custom entry), use that
        customerName = (job as any).customerName;
        setCustomCustomerName((job as any).customerName);
      }
      
      form.reset({
        jobId: (job as any).jobId || "",
        customerId: (job as any).customerId?.toString() || "",
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        equipmentId: (job as any).equipmentId?.toString() || "",
        equipmentDescription: (job as any).equipmentDescription || "",
        assignedTo: (job as any).assignedTo?.toString() || "",
        status: (job as any).status || "waiting_assessment",
        description: (job as any).description || "",
        taskDetails: (job as any).taskDetails || "",
        estimatedHours: (job as any).estimatedHours?.toString() || "",
        customerNotified: !!(job as any).customerNotified
      });
      
      // Show notification toggle if job is completed
      setShowCustomerNotification((job as any).status === "completed");
      
      // Show service section if job is in progress or parts_ordered
      const jobInProgress = ['in_progress', 'parts_ordered'].includes((job as any).status);
      setShowServiceSection(jobInProgress);
      
      // No longer forcing tab change to service when job is in progress
      // This allows users to freely switch between tabs
    }
  }, [job, form, customers, editMode, currentTab]);

  // Create job mutation
  const createJob = useMutation({
    mutationFn: async (data: any) => {
      // If using custom customer entry, first create a new customer
      let customerId = data.customerId;
      
      // Check if we need to create a new customer (when customCustomerName is used)
      if (customCustomerName && customCustomerName.trim() && !data.customerId) {
        try {
          console.log("[DEBUG] Attempting to create customer with name:", customCustomerName);
          
          // Create customer data with proper defaults
          const customerData = {
            name: customCustomerName.trim(),
            email: data.customerEmail?.trim() || " ", // Use provided email or space character
            phone: data.customerPhone?.trim() || " ", // Use provided phone or space character
            address: " ", // Space character to avoid empty string validation issues
            notes: "Auto-created from job form"
          };
          
          console.log("[DEBUG] Customer data being sent:", customerData);
          
          // Create new customer
          const newCustomer = await apiRequest("POST", "/api/customers", customerData);
          
          console.log("[DEBUG] Customer creation response:", newCustomer);
          
          // Validate customer response
          if (!newCustomer) {
            console.error("[ERROR] Customer creation returned empty response");
            throw new Error("Customer creation failed - empty response from server");
          }
          
          if (typeof newCustomer !== 'object') {
            console.error("[ERROR] Customer creation returned non-object response:", newCustomer);
            throw new Error("Customer creation failed - invalid response format");
          }
          
          if (!('id' in newCustomer) || !newCustomer.id) {
            console.error("[ERROR] Customer creation returned response without ID:", newCustomer);
            throw new Error("Customer creation failed - no ID returned");
          }
          
          // Successfully created customer
          customerId = newCustomer.id.toString();
          console.log("[DEBUG] Created new customer with ID:", customerId);
        } catch (error: any) {
          console.error("[ERROR] Failed to create customer:", error);
          throw new Error("Failed to create customer: " + (error.message || "Unknown error"));
        }
      }
      
      try {
        // Prepare job data with proper type conversions
        const jobData = {
          ...data,
          equipmentId: data.useCustomEquipment ? null : (data.equipmentId ? parseInt(data.equipmentId) : null),
          equipmentDescription: data.equipmentDescription || null, // Always save equipment description from Brand & Model field
          customerId: parseInt(customerId),
          assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
          estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : null
        };
        
        console.log("[DEBUG] Submitting job with prepared data:", jobData);
        
        // Create the job
        const result = await apiRequest("POST", "/api/jobs", jobData);
        console.log("[DEBUG] Job created successfully:", result);
        return result;
      } catch (error: any) {
        console.error("[ERROR] Failed to create job:", error);
        throw new Error("Failed to create job: " + (error.message || "Unknown error"));
      }
    },
    onSuccess: (newJob) => {
      toast({
        title: "Job created",
        description: "The job has been successfully created."
      });
      
      // Store the created job and show print option
      setCreatedJob(newJob);
      setShowPrintOption(true);
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      // Don't auto-close to allow user to print receipt if needed
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update job mutation
  const updateJob = useMutation({
    mutationFn: async (data: any) => {
      // If using custom customer entry, first create a new customer
      let customerId = data.customerId;
      
      // Check if we need to create a new customer (when customCustomerName is used)
      if (customCustomerName && customCustomerName.trim() && !data.customerId) {
        try {
          console.log("[Job Form] Attempting to create customer with name:", customCustomerName);
          
          // Create customer data with proper defaults
          const customerData = {
            name: customCustomerName.trim(),
            email: data.customerEmail?.trim() || " ", // Use provided email or space character
            phone: data.customerPhone?.trim() || " ", // Use provided phone or space character
            address: " ", // Space character to avoid empty string validation issues
            notes: "Auto-created from job form"
          };
          
          console.log("[Job Form] Customer data being sent:", customerData);
          
          // Create new customer
          const newCustomer = await apiRequest("POST", "/api/customers", customerData);
          
          console.log("[Job Form] Customer creation response:", newCustomer);
          
          // Validate customer response
          if (!newCustomer) {
            console.error("[Job Form] Customer creation returned empty response");
            throw new Error("Customer creation failed - empty response from server");
          }
          
          if (typeof newCustomer !== 'object') {
            console.error("[Job Form] Customer creation returned non-object response:", newCustomer);
            throw new Error("Customer creation failed - invalid response format");
          }
          
          if (!('id' in newCustomer) || !newCustomer.id) {
            console.error("[Job Form] Customer creation returned response without ID:", newCustomer);
            throw new Error("Customer creation failed - no ID returned");
          }
          
          // Successfully created customer
          customerId = newCustomer.id.toString();
          console.log("[Job Form] Created new customer with ID:", customerId);
        } catch (error: any) {
          console.error("[Job Form] Failed to create customer:", error);
          throw new Error("Failed to create customer: " + (error.message || "Unknown error"));
        }
      }
      
      // Prepare job data
      const jobData = {
        ...data,
        equipmentId: data.useCustomEquipment ? null : (data.equipmentId ? parseInt(data.equipmentId) : null),
        equipmentDescription: data.equipmentDescription || null, // Always save equipment description from Brand & Model field
        customerId: parseInt(customerId),
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : null
      };
      
      console.log("[Job Form] Updating job with data:", jobData);
      
      // Update the job
      return apiRequest("PUT", `/api/jobs/${jobId}`, jobData);
    },
    onSuccess: async () => {
      toast({
        title: "Job updated",
        description: "The job has been successfully updated."
      });
      
      // Invalidate queries and wait for them to complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] })
      ]);
      
      // Force a fresh query with new timestamp to ensure form shows updated values
      setQueryTimestamp(Date.now());
      if (refetchJob) {
        await refetchJob();
      }
      
      // Don't automatically close the dialog - let user review changes and close manually
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Delete job mutation
  const deleteJob = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID provided");
      return apiRequest("DELETE", `/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      toast({
        title: "Job deleted",
        description: "The job has been successfully deleted."
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      // Close the dialog
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Delete confirmation handler
  const handleDeleteConfirm = () => {
    setShowDeleteConfirmDialog(false);
    deleteJob.mutate();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmDialog(false);
  };

  // Form submission handler
  function onSubmit(data: z.infer<typeof jobSchema>) {
    console.log("Form data being submitted:", data);
    
    // Use the customer name from the form input
    data.customerName = customCustomerName || data.customerName;
    
    // Validate customer name before submission
    if (!data.customerName || data.customerName.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive"
      });
      return;
    }
    
    // The validation is now handled by the zod schema
    if (editMode && jobId) {
      updateJob.mutate(data);
    } else {
      createJob.mutate(data);
    }
  }

  // Status change confirmation handlers
  const handleStatusConfirm = () => {
    if (pendingStatusChange) {
      form.setValue("status", pendingStatusChange);
      setShowCustomerNotification(pendingStatusChange === "ready_for_pickup");
      
      // If editing an existing job, automatically save the status change
      if (editMode && jobId) {
        const currentData = form.getValues();
        currentData.status = pendingStatusChange;
        currentData.customerName = customCustomerName || currentData.customerName;
        updateJob.mutate(currentData);
      }
      
      toast({
        title: "Status Updated",
        description: `Job status changed to ${formatStatusText(pendingStatusChange)}. ${
          pendingStatusChange === "ready_for_pickup" ? "Customer will be notified automatically that their equipment is ready for collection." : ""
        }`,
      });
    }
    setShowStatusConfirmDialog(false);
    setPendingStatusChange(null);
    setPreviousStatus(null);
  };

  const handleStatusCancel = () => {
    setShowStatusConfirmDialog(false);
    setPendingStatusChange(null);
    setPreviousStatus(null);
  };

  const formatStatusText = (status: string) => {
    return statusOptions.find(opt => opt.value === status)?.label || status;
  };

  // Status options
  const statusOptions = [
    { value: "waiting_assessment", label: "Waiting Assessment" },
    { value: "in_progress", label: "In Progress" },
    { value: "parts_ordered", label: "Parts Ordered" },
    { value: "on_hold", label: "On Hold" },
    { value: "ready_for_pickup", label: "Ready for Pickup" },
    { value: "completed", label: "Completed" }
  ];

  // Get customer name
  const getCustomerName = (id: string | undefined) => {
    if (!id || !Array.isArray(customers)) return "Select customer";
    const customer = customers.find((c: any) => c.id === parseInt(id));
    return customer ? customer.name : "Select customer";
  };

  // Get equipment name and details
  const getEquipmentDetails = (id: string | undefined) => {
    if (!id || !Array.isArray(allEquipment)) return "Select equipment";
    const equipment = allEquipment.find((e: any) => e.id === parseInt(id));
    if (!equipment) return "Select equipment";
    
    // Get equipment type
    const { data: equipmentTypes = [] } = useQuery({
      queryKey: ["/api/equipment-types"],
    });
    
    const type = Array.isArray(equipmentTypes) ? 
      equipmentTypes.find((t: any) => t.id === equipment.typeId) : null;
    if (!type) return `Equipment #${id}`;
    
    return `${type.name} (${type.brand} ${type.model}) - SN: ${equipment.serialNumber}`;
  };

  // Get user name
  const getUserName = (id: string | undefined) => {
    if (!id || !users) return "Select user";
    if (!Array.isArray(users)) return "Select user";
    
    // Special case for unassigned
    if (id === "unassigned") return "Unassigned";
    
    const user = users.find(u => u.id === parseInt(id));
    return user ? user.fullName : "Select user";
  };

  if ((isJobLoading || isCustomersLoading || isEquipmentLoading || isUsersLoading) && (editMode || readOnly)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Job...</CardTitle>
          <CardDescription>Please wait while we fetch the job details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>{readOnly ? "Job Details" : editMode ? "Edit Job" : "Add New Job"}</CardTitle>
        <CardDescription>
          {readOnly 
            ? "View job information" 
            : editMode 
              ? "Update job information" 
              : "Enter job details to create a new work order"
          }
        </CardDescription>
      </CardHeader>
      
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="px-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          {jobId && (
            <TabsTrigger value="work-completed">Work Completed</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="details">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job ID*</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Auto-generated job ID" 
                            {...field} 
                            disabled={editMode || readOnly}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status*</FormLabel>
                        <Select
                          disabled={readOnly}
                          value={field.value}
                          onValueChange={(value) => {
                            // Check if changing to ready for pickup status - show confirmation
                            if (value === "ready_for_pickup" && field.value !== value) {
                              setPreviousStatus(field.value);
                              setPendingStatusChange(value);
                              setShowStatusConfirmDialog(true);
                            } else {
                              field.onChange(value);
                              setShowCustomerNotification(value === "ready_for_pickup");
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select job status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="space-y-2">
                  <FormItem>
                    <FormLabel>Customer Name*</FormLabel>
                    <Input
                      placeholder="Enter customer name"
                      value={customCustomerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      disabled={readOnly}
                    />
                    {form.formState.errors.customerName && (
                      <p className="text-sm font-medium text-destructive">
                        {form.formState.errors.customerName.message}
                      </p>
                    )}
                  </FormItem>
                  
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Email</FormLabel>
                        <Input
                          placeholder="customer@example.com"
                          {...field}
                          disabled={readOnly}
                        />
                        <FormDescription>
                          Used for job tracking and notifications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Phone Number</FormLabel>
                        <Input
                          placeholder="e.g. 01234 567890"
                          {...field}
                          disabled={readOnly}
                        />
                        <FormDescription>
                          Contact number for any queries about the job
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        disabled={readOnly}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          
                          // If job is in 'waiting_assessment' status and someone is assigned, change to 'in_progress'
                          const currentStatus = form.getValues("status");
                          if (value && currentStatus === "waiting_assessment") {
                            form.setValue("status", "in_progress");
                            setShowServiceSection(true);
                            // Show toast notification about status change
                            toast({
                              title: "Status Updated",
                              description: "Job has been automatically moved to 'In Progress' status.",
                            });
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user">
                              {getUserName(field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {Array.isArray(users) && users.map(user => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName} ({user.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="equipmentDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand & Model of Machine</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter brand, model, and serial number" 
                          className="min-h-[80px]"
                          disabled={readOnly}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description*</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Description of the problem or service required" 
                          className="min-h-[80px]"
                          disabled={readOnly}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Estimated repair time in hours" 
                            disabled={readOnly}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="taskDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Details</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Specific tasks for this job" 
                            disabled={readOnly}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {showCustomerNotification && (
                  <FormField
                    control={form.control}
                    name="customerNotified"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Customer Notified</FormLabel>
                          <FormDescription>
                            Toggle this when you've notified the customer that their equipment is ready.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={readOnly}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
              
              {!readOnly && (
                <CardFooter className="flex justify-between">
                  {showPrintOption && createdJob ? (
                    <>
                      <PrintJobDialog
                        job={createdJob}
                        customerName={createdJob.customerName || (createdJob.customerId ? getCustomerName(String(createdJob.customerId)) : "Customer")}
                        customerEmail={createdJob.customerEmail || ""}
                        equipmentName={createdJob.equipmentDescription || "No equipment specified"}
                        assigneeName={createdJob.assignedTo ? getUserName(String(createdJob.assignedTo)) : "Unassigned"}
                        trigger={
                          <Button
                            type="button"
                            className="flex gap-2 bg-green-700 hover:bg-green-800"
                          >
                            <Printer size={16} />
                            Print Receipt
                          </Button>
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          // Reset form state
                          setShowPrintOption(false);
                          setCreatedJob(null);
                          form.reset();
                          
                          // Close the dialog with a small delay to prevent reopening
                          setTimeout(() => {
                            if (onComplete) {
                              onComplete();
                            }
                          }, 100);
                        }}
                      >
                        Done
                      </Button>
                    </>
                  ) : (
                    <div className="flex justify-between w-full">
                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          className="bg-primary"
                          disabled={createJob.isPending || updateJob.isPending}
                        >
                          {createJob.isPending || updateJob.isPending ? "Saving..." : editMode ? "Update Job" : "Create Job"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onCancel}
                        >
                          Cancel
                        </Button>
                      </div>
                      {editMode && jobId && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirmDialog(true)}
                          disabled={deleteJob.isPending}
                          className="flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          {deleteJob.isPending ? "Deleting..." : "Delete Job"}
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              )}
            </form>
          </Form>
        </TabsContent>
        
        {jobId && showServiceSection && (
          <TabsContent value="service">
            <CardContent>
              {!readOnly && (
                <JobServiceForm 
                  jobId={parseInt(jobId?.toString() || "0")} 
                  onServiceAdded={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/services?jobId=${jobId}`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
                  }} 
                />
              )}
              {readOnly && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Work Details Summary</h3>
                  <WorkDetailsSummary 
                    jobId={parseInt(jobId?.toString() || "0")} 
                    services={services && Array.isArray(services) ? services : []}
                  />
                </div>
              )}
            </CardContent>
          </TabsContent>
        )}

        {jobId && (
          <TabsContent value="work-completed">
            <CardContent>
              <WorkCompletedForm 
                jobId={parseInt(jobId?.toString() || "0")} 
                readOnly={readOnly}
                onWorkAdded={() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/work-completed/${jobId}`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
                }} 
              />
            </CardContent>
          </TabsContent>
        )}

      </Tabs>
    </Card>

    {/* Status Change Confirmation Dialog - with high z-index to appear above other dialogs */}
    <AlertDialog open={showStatusConfirmDialog} onOpenChange={setShowStatusConfirmDialog}>
      <AlertDialogContent className="z-[60]">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingStatusChange === "ready_for_pickup" && (
              <span>
                You are about to mark this job as <strong>ready for pickup</strong>. 
                This will automatically send an email notification to the customer 
                letting them know their equipment is ready for collection.
                <br /><br />
                Are you sure you want to continue?
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleStatusCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleStatusConfirm}>
            Yes, Update Status
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
          <AlertDialogCancel onClick={handleDeleteCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDeleteConfirm}
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