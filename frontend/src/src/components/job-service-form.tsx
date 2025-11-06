import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, MoreHorizontal, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

// Define the part schema
const partSchema = z.object({
  name: z.string().min(1, { message: "Part name is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" })
    .refine(val => !isNaN(Number(val)), {
      message: "Quantity must be a number",
    }),
  cost: z.string().optional()
    .refine(val => !val || !isNaN(Number(val)), {
      message: "Cost must be a number",
    }),
});

// Define the service schema
const serviceSchema = z.object({
  jobId: z.number(),
  serviceType: z.string().optional(),
  details: z.string().optional(),
  cost: z.string().optional()
    .refine(val => !val || !isNaN(Number(val)), {
      message: "Cost must be a number",
    }),
  parts: z.array(partSchema).optional(),
  performedBy: z.string().optional(),
  notes: z.string().optional(),
  laborHours: z.string().optional()
    .refine(val => !val || !isNaN(Number(val)), {
      message: "Labor hours must be a number",
    }),
  partsUsed: z.any().optional(),
});

interface JobServiceFormProps {
  jobId: number;
  onServiceAdded?: () => void;
}

export function JobServiceForm({ jobId, onServiceAdded }: JobServiceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parts, setParts] = useState<z.infer<typeof partSchema>[]>([]);
  const [showAddPartDialog, setShowAddPartDialog] = useState(false);

  // Form for new part
  const partForm = useForm<z.infer<typeof partSchema>>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      name: "",
      quantity: "1",
      cost: "",
    },
  });

  // Form for service
  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      jobId,
      serviceType: "",
      details: "",
      cost: "",
      performedBy: "",
      notes: "",
      parts: [],
      laborHours: "",
    },
  });
  
  // Load existing service data into form when available
  useEffect(() => {
    if (latestService) {
      form.reset({
        jobId,
        serviceType: latestService.serviceType || "",
        details: latestService.details || "",
        cost: latestService.cost ? latestService.cost.toString() : "",
        performedBy: latestService.performedBy ? latestService.performedBy.toString() : "",
        notes: latestService.notes || "",
        parts: [],
        laborHours: latestService.laborHours ? latestService.laborHours.toString() : "",
      });
      
      // If parts were saved, load them
      if (latestService.partsUsed && Array.isArray(latestService.partsUsed)) {
        setParts(latestService.partsUsed);
      }
    }
  }, [jobId]);

  // Fetch the latest service record for this job (or empty array if none exists)
  const { data: services = [], isLoading: isServicesLoading, refetch: refetchServices } = useQuery({
    queryKey: [`/api/services?jobId=${jobId}`],
    enabled: !!jobId
  });
  
  // Get the latest service record if it exists
  const latestService = Array.isArray(services) && services.length > 0 ? 
    services.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0] : 
    null;

  // Fetch users for technician selection
  const { data: users = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  // Mutation to add a service
  const addService = useMutation({
    mutationFn: async (data: any) => {
      // Format the data
      const serviceData = {
        ...data,
        jobId: Number(jobId),
        cost: data.cost ? Number(data.cost) : null,
        performedBy: data.performedBy ? Number(data.performedBy) : null,
        laborHours: data.laborHours ? Number(data.laborHours) : null,
        partsUsed: parts, // Store parts as JSON object
      };

      // Remove the parts array before sending
      delete serviceData.parts;

      // If we have an existing service record, update it; otherwise create a new one
      if (latestService && latestService.id) {
        return apiRequest(`/api/services/${latestService.id}`, {
          method: 'PUT',
          data: serviceData
        });
      } else {
        // Create a new service record
        return apiRequest('/api/services', {
          method: 'POST',
          data: serviceData
        });
      }
    },
    onSuccess: () => {
      const actionText = latestService ? "updated" : "added";
      
      toast({
        title: `Work details ${actionText}`,
        description: `The work details have been successfully ${actionText}.`
      });
      
      // Don't reset the form - allow continuous updates
      
      // Refresh services and job data
      refetchServices();
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      
      if (onServiceAdded) onServiceAdded();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update work details: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Handler to add a part to the list
  const handleAddPart = (values: z.infer<typeof partSchema>) => {
    setParts([...parts, values]);
    partForm.reset({
      name: "",
      quantity: "1",
      cost: "",
    });
    setShowAddPartDialog(false);
  };

  // Handler to remove a part from the list
  const handleRemovePart = (index: number) => {
    const newParts = [...parts];
    newParts.splice(index, 1);
    setParts(newParts);
  };

  // Calculate total cost of parts
  const calculateTotalCost = () => {
    return parts.reduce((total, part) => {
      const cost = part.cost ? parseFloat(part.cost) : 0;
      const quantity = parseFloat(part.quantity);
      return total + (cost * quantity);
    }, 0).toFixed(2);
  };

  // Form submission handler
  function onSubmit(data: z.infer<typeof serviceSchema>) {
    // Add the parts to the data
    data.parts = parts;
    addService.mutate(data);
  }

  // Auto-save changes after field modifications (for incremental saves)
  const autoSaveChanges = (field: string, value: string) => {
    if (!jobId) return;
    
    // Don't save if currently submitting the form or if value is empty
    if (addService.isPending) return;
    
    // Get all current form values
    const currentValues = form.getValues();
    
    // Only proceed with auto-save if there's enough data to make a meaningful update
    if (currentValues.details || currentValues.serviceType || currentValues.performedBy || currentValues.cost || currentValues.laborHours) {
      const formattedData = {
        ...currentValues,
        jobId: Number(jobId),
        cost: currentValues.cost ? parseFloat(currentValues.cost) : null,
        performedBy: currentValues.performedBy ? parseInt(currentValues.performedBy) : null,
        laborHours: currentValues.laborHours ? parseFloat(currentValues.laborHours) : null,
        partsUsed: parts, // Include current parts
      };

      // Check if we're updating existing service or creating a new one
      if (latestService && latestService.id) {
        // Update existing service record
        apiRequest(`/api/services/${latestService.id}`, {
          method: 'PUT',
          data: formattedData
        })
          .then(() => {
            // Refresh services list after successful save
            refetchServices();
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
          })
          .catch(error => {
            console.error("Error auto-saving service details:", error);
          });
      } else {
        // Create new service record
        apiRequest('/api/services', {
          method: 'POST',
          data: formattedData
        })
          .then((response) => {
            // Refresh services list after successful save
            refetchServices();
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
          })
          .catch(error => {
            console.error("Error auto-saving service details:", error);
          });
      }
    }
  };
  
  // Format service type for display
  const formatServiceType = (type: string) => {
    switch (type) {
      case "inspection":
        return "Equipment Inspection";
      case "repair":
        return "Repair";
      case "maintenance":
        return "Maintenance";
      case "testing":
        return "Testing";
      case "parts_replacement":
        return "Parts Replacement";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Add Work Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Hidden jobId field */}
              <input type="hidden" {...form.register("jobId")} value={jobId} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service Type */}
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          autoSaveChanges('serviceType', value);
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inspection">Equipment Inspection</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                          <SelectItem value="parts_replacement">Parts Replacement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Performed By */}
                <FormField
                  control={form.control}
                  name="performedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Performed By</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          autoSaveChanges('performedBy', value);
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user: any) => (
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
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cost Field */}
                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Cost</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter service cost" 
                          type="number" 
                          step="0.01" 
                          onChange={(e) => {
                            field.onChange(e);
                            autoSaveChanges('cost', e.target.value);
                          }}
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the cost for this service (excluding parts)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Labor Hours Field */}
                <FormField
                  control={form.control}
                  name="laborHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Labor Hours</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter labor hours" 
                          type="number" 
                          step="0.5" 
                          min="0"
                          onChange={(e) => {
                            field.onChange(e);
                            autoSaveChanges('laborHours', e.target.value);
                          }}
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        Time spent on this service
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Service Details */}
              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the work performed in detail..." 
                        className="min-h-[100px]"
                        onChange={(e) => {
                          field.onChange(e);
                          autoSaveChanges('details', e.target.value);
                        }}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Notes Field */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes..." 
                        className="min-h-[60px]"
                        onChange={(e) => {
                          field.onChange(e);
                          autoSaveChanges('notes', e.target.value);
                        }}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Parts Used */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Parts Used</FormLabel>
                  <Dialog open={showAddPartDialog} onOpenChange={setShowAddPartDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Plus size={16} /> Add Part
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Part</DialogTitle>
                      </DialogHeader>
                      
                      <form onSubmit={partForm.handleSubmit(handleAddPart)} className="space-y-4 py-4">
                        <div className="space-y-2">
                          <FormLabel htmlFor="part-name">Part Name</FormLabel>
                          <Input
                            id="part-name"
                            placeholder="Enter part name"
                            {...partForm.register("name")}
                          />
                          {partForm.formState.errors.name && (
                            <p className="text-red-500 text-sm">{partForm.formState.errors.name.message}</p>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <FormLabel htmlFor="part-quantity">Quantity</FormLabel>
                            <Input
                              id="part-quantity"
                              type="number"
                              step="1"
                              min="1"
                              placeholder="1"
                              {...partForm.register("quantity")}
                            />
                            {partForm.formState.errors.quantity && (
                              <p className="text-red-500 text-sm">{partForm.formState.errors.quantity.message}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <FormLabel htmlFor="part-cost">Unit Cost (£)</FormLabel>
                            <Input
                              id="part-cost"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...partForm.register("cost")}
                            />
                            {partForm.formState.errors.cost && (
                              <p className="text-red-500 text-sm">{partForm.formState.errors.cost.message}</p>
                            )}
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" type="button">Cancel</Button>
                          </DialogClose>
                          <Button type="submit">Add Part</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {parts.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parts.map((part, index) => (
                          <TableRow key={index}>
                            <TableCell>{part.name}</TableCell>
                            <TableCell>{part.quantity}</TableCell>
                            <TableCell>{part.cost ? `£${parseFloat(part.cost).toFixed(2)}` : '-'}</TableCell>
                            <TableCell>
                              {part.cost 
                                ? `£${(parseFloat(part.quantity) * parseFloat(part.cost)).toFixed(2)}` 
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRemovePart(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 size={16} className="text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {parts.some(part => part.cost) && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-right font-medium">Total Cost:</TableCell>
                            <TableCell colSpan={2} className="font-bold">£{calculateTotalCost()}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed rounded-md">
                    <p className="text-neutral-500 text-sm">No parts added yet.</p>
                    <p className="text-neutral-400 text-xs mt-1">Click "Add Part" to add parts used in this service.</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  className="bg-green-700 hover:bg-green-800"
                  disabled={addService.isPending}
                >
                  {addService.isPending ? "Saving..." : "Add Work Details"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Service History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Service History</CardTitle>
        </CardHeader>
        <CardContent>
          {isServicesLoading ? (
            <div className="py-4 text-center">
              <p className="text-neutral-500">Loading service history...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="py-4 text-center border border-dashed rounded-md">
              <p className="text-neutral-500">No service records found for this job.</p>
              <p className="text-neutral-400 text-xs mt-1">Add a new service record above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service: any) => (
                <div key={service.id} className="border rounded-md p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge className="bg-green-700">
                        {formatServiceType(service.serviceType)}
                      </Badge>
                      <div className="flex items-center gap-2 mt-1 text-sm text-neutral-500">
                        <Clock size={14} />
                        <span>{formatDate(service.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {service.cost !== null && (
                        <div className="text-sm font-medium">
                          Cost: £{service.cost}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-neutral-700 whitespace-pre-line">{service.details}</p>
                  
                  {service.notes && (
                    <div className="mt-2">
                      <p className="text-xs text-neutral-500 font-medium">Notes:</p>
                      <p className="text-sm text-neutral-600">{service.notes}</p>
                    </div>
                  )}
                  
                  {service.partsUsed && service.partsUsed.length > 0 && (
                    <div className="mt-2">
                      <h4 className="text-sm font-semibold text-neutral-500 mb-2">Parts Used:</h4>
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Part Name</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Cost</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(Array.isArray(service.partsUsed) ? service.partsUsed : (typeof service.partsUsed === 'string' ? JSON.parse(service.partsUsed) : [])).map((part: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>{part.name}</TableCell>
                                <TableCell>{part.quantity}</TableCell>
                                <TableCell>{part.cost ? `£${parseFloat(part.cost).toFixed(2)}` : '-'}</TableCell>
                                <TableCell>
                                  {part.cost 
                                    ? `£${(parseFloat(part.quantity) * parseFloat(part.cost)).toFixed(2)}` 
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}