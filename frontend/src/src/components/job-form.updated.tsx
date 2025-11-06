import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Printer } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTimeAgo, generateJobId, getStatusColor } from "@/lib/utils";
import { PrintJobDialog } from "@/components/print-job-dialog";

// Define the job schema for form validation
const jobSchema = z
  .object({
    jobId: z.string().min(3, { message: "Job ID is required" }),
    customerId: z.string(),
    customerName: z.string().optional(),
    useCustomCustomer: z.boolean().optional().default(false),
    equipmentId: z.string().optional(),
    equipmentDescription: z.string().optional(),
    useCustomEquipment: z.boolean().optional().default(true),
    assignedTo: z.string().optional(),
    status: z.string(),
    description: z.string().min(3, { message: "Description is required" }),
    taskDetails: z.string().optional(),
    estimatedHours: z.string().optional(),
    customerNotified: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // If using custom customer, customerName must be provided
    if (data.useCustomCustomer === true && (!data.customerName || data.customerName.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer name is required when using manual entry",
        path: ["customerName"]
      });
    }
    
    // If not using custom customer, customerId must be provided
    if (data.useCustomCustomer === false && (!data.customerId || data.customerId === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a customer",
        path: ["customerId"]
      });
    }
  });

interface JobFormProps {
  jobId?: number;
  editMode?: boolean;
  readOnly?: boolean;
  onComplete?: () => void;
}

export function JobForm({ jobId, editMode = false, readOnly = false, onComplete }: JobFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState("details");
  const [showCustomerNotification, setShowCustomerNotification] = useState(false);
  const [showPrintOption, setShowPrintOption] = useState(false);
  const [createdJob, setCreatedJob] = useState<any>(null);

  // State for custom customer name
  const [customCustomerName, setCustomCustomerName] = useState("");
  
  // Form setup
  const form = useForm<z.infer<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      jobId: generateJobId(),
      customerId: "",
      customerName: "",
      useCustomCustomer: false,
      equipmentId: "",
      equipmentDescription: "",
      useCustomEquipment: true, // Default to custom equipment entry
      assignedTo: "",
      status: "waiting_assessment",
      description: "",
      taskDetails: "",
      estimatedHours: "",
      customerNotified: false
    }
  });
  
  // Handle customer name change
  const handleCustomerNameChange = (value: string) => {
    setCustomCustomerName(value);
    form.setValue("customerName", value);
  };

  // Fetch job data if in edit mode
  const { data: job = null, isLoading: isJobLoading } = useQuery({
    queryKey: [jobId ? `/api/jobs/${jobId}` : 'unused-key'],
    enabled: !!jobId
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

  // Update form values when job data is loaded
  useEffect(() => {
    if (job) {
      // Check if we have a custom customer name from the job
      if (job.customerName) {
        setCustomCustomerName(job.customerName);
      }
      
      form.reset({
        jobId: job.jobId || generateJobId(),
        customerId: job.customerId?.toString() || "",
        customerName: job.customerName || "", 
        useCustomCustomer: !!job.customerName, // Set to true if customerName exists
        equipmentId: job.equipmentId?.toString() || "",
        equipmentDescription: job.equipmentDescription || "",
        useCustomEquipment: job.equipmentDescription ? true : false,
        assignedTo: job.assignedTo?.toString() || "",
        status: job.status || "waiting_assessment",
        description: job.description || "",
        taskDetails: job.taskDetails || "",
        estimatedHours: job.estimatedHours?.toString() || "",
        customerNotified: job.customerNotified || false
      });
      
      setShowCustomerNotification(job.status === "completed");
    }
  }, [job, form]);

  // Create job mutation
  const createJob = useMutation({
    mutationFn: async (data: any) => {
      // If using custom customer entry, first create a new customer
      let customerId = data.customerId;
      
      if (data.useCustomCustomer && data.customerName) {
        try {
          console.log("Attempting to create customer with name:", data.customerName);
          // Create new customer with just the name, use space characters for other required fields
          const newCustomer = await apiRequest("POST", "/api/customers", {
            name: data.customerName,
            email: " ", // Use space instead of empty string
            phone: " ", // Use space instead of empty string
            address: " ", // Use space instead of empty string
            notes: "Auto-created from job form"
          });
          
          console.log("Customer creation response:", newCustomer);
          
          if (newCustomer && typeof newCustomer === 'object' && 'id' in newCustomer) {
            customerId = newCustomer.id.toString();
            console.log("Created new customer with ID:", customerId);
          } else {
            console.error("Invalid customer response:", newCustomer);
            throw new Error("Invalid customer response");
          }
        } catch (error: any) {
          console.error("Failed to create customer:", error);
          throw new Error("Failed to create customer: " + (error.message || "Unknown error"));
        }
      }
      
      return apiRequest("POST", "/api/jobs", {
        ...data,
        equipmentId: data.useCustomEquipment ? null : (data.equipmentId ? parseInt(data.equipmentId) : null),
        equipmentDescription: data.useCustomEquipment ? data.equipmentDescription : null,
        customerId: parseInt(customerId),
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : null
      });
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
      if (onComplete) onComplete();
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
      
      if (data.useCustomCustomer && data.customerName) {
        try {
          console.log("Attempting to create customer with name:", data.customerName);
          // Create new customer with just the name
          const newCustomer = await apiRequest("POST", "/api/customers", {
            name: data.customerName,
            email: " ", // Use space instead of empty string
            phone: " ", // Use space instead of empty string
            address: " ", // Use space instead of empty string
            notes: "Auto-created from job form"
          });
          
          console.log("Customer creation response:", newCustomer);
          
          if (newCustomer && typeof newCustomer === 'object' && 'id' in newCustomer) {
            customerId = newCustomer.id.toString();
            console.log("Created new customer with ID:", customerId);
          } else {
            console.error("Invalid customer response:", newCustomer);
            throw new Error("Invalid customer response");
          }
        } catch (error: any) {
          console.error("Failed to create customer:", error);
          throw new Error("Failed to create customer: " + (error.message || "Unknown error"));
        }
      }
      
      return apiRequest("PUT", `/api/jobs/${jobId}`, {
        ...data,
        equipmentId: data.useCustomEquipment ? null : (data.equipmentId ? parseInt(data.equipmentId) : null),
        equipmentDescription: data.useCustomEquipment ? data.equipmentDescription : null,
        customerId: parseInt(customerId),
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : null
      });
    },
    onSuccess: () => {
      toast({
        title: "Job updated",
        description: "The job has been successfully updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Form submission handler
  function onSubmit(data: z.infer<typeof jobSchema>) {
    console.log("Form data being submitted:", data);
    
    // Set customer name from the custom input if using custom customer
    if (data.useCustomCustomer) {
      data.customerName = customCustomerName;
      
      // Validate customer name before submission
      if (!customCustomerName || customCustomerName.trim() === "") {
        toast({
          title: "Validation Error",
          description: "Customer name is required when using manual entry",
          variant: "destructive"
        });
        return;
      }
    }
    
    // The validation is now handled by the zod schema
    if (editMode && jobId) {
      updateJob.mutate(data);
    } else {
      createJob.mutate(data);
    }
  }

  // Status options
  const statusOptions = [
    { value: "waiting_assessment", label: "Waiting Assessment" },
    { value: "in_progress", label: "In Progress" },
    { value: "parts_ordered", label: "Parts Ordered" },
    { value: "on_hold", label: "On Hold" },
    { value: "ready_for_pickup", label: "Ready for Pickup" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" }
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
            <TabsTrigger value="services">Services History</TabsTrigger>
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
                            field.onChange(value);
                            setShowCustomerNotification(value === "completed");
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
                
                <FormField
                  control={form.control}
                  name="useCustomCustomer"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Use custom customer entry</FormLabel>
                        <FormDescription>
                          Switch on to manually enter a customer name instead of selecting from existing customers.
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
                
                {!form.watch("useCustomCustomer") ? (
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer*</FormLabel>
                        <Select
                          disabled={readOnly}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer">
                                {getCustomerName(field.value)}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(customers) && customers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id.toString()}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
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
                  </div>
                )}
                
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        disabled={readOnly}
                        value={field.value}
                        onValueChange={field.onChange}
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
                  name="useCustomEquipment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Use custom equipment entry</FormLabel>
                        <FormDescription>
                          Switch on to manually enter equipment details instead of selecting from customer's equipment.
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
                
                {!form.watch("useCustomEquipment") && form.watch("customerId") ? (
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment</FormLabel>
                        <Select
                          disabled={readOnly}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customerEquipment.length > 0 ? (
                              customerEquipment.map(equipment => (
                                <SelectItem key={equipment.id} value={equipment.id.toString()}>
                                  {equipment.serialNumber}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>No equipment found for this customer</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="equipmentDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment Description</FormLabel>
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
                )}
                
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
                        customerName={createdJob.customerId ? getCustomerName(String(createdJob.customerId)) : "Customer"}
                        equipmentName={createdJob.useCustomEquipment 
                          ? (createdJob.equipmentDescription || "Custom Equipment") 
                          : (createdJob.equipmentId ? getEquipmentDetails(String(createdJob.equipmentId)) : "Equipment")}
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
                        onClick={onComplete}
                      >
                        Done
                      </Button>
                    </>
                  ) : (
                    <>
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
                        onClick={onComplete}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </CardFooter>
              )}
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="services">
          <CardContent>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Service History</h3>
              
              {Array.isArray(services) && services.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>{formatDate(service.createdAt)}</TableCell>
                        <TableCell>{service.serviceType}</TableCell>
                        <TableCell>{getUserName(service.technician?.toString())}</TableCell>
                        <TableCell>{service.description}</TableCell>
                        <TableCell>{service.hoursSpent || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  No service records found.
                </div>
              )}
            </div>
          </CardContent>
          
          {!readOnly && (
            <CardFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onComplete}
              >
                Close
              </Button>
            </CardFooter>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}