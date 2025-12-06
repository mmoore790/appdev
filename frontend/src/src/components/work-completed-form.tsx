import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { useToast } from "../hooks/use-toast";
import { formatDate } from "../lib/utils";
import { Plus, Clock, Wrench, Package } from "lucide-react";
import { PrintWorkCompletion } from "./print-work-completion";

// Schema for work completed entry
const workCompletedSchema = z.object({
  jobId: z.number(),
  workDescription: z.string().min(10, { message: "Work description must be at least 10 characters" }),
  category: z.string().min(1, { message: "Category is required" }),
  laborHours: z.string().min(1, { message: "Labor hours is required" }),
  partsUsed: z.string().optional(),
  partsCost: z.string().optional(),
  notes: z.string().optional(),
  completedBy: z.string().min(1, { message: "Completed by is required" }),
});

interface WorkCompletedFormProps {
  jobId: number;
  readOnly?: boolean;
  onWorkAdded?: () => void;
}

export function WorkCompletedForm({ jobId, readOnly = false, onWorkAdded }: WorkCompletedFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingWork, setIsAddingWork] = useState(false);

  // Form setup
  const form = useForm<z.infer<typeof workCompletedSchema>>({
    resolver: zodResolver(workCompletedSchema),
    defaultValues: {
      jobId: jobId,
      workDescription: "",
      category: "",
      laborHours: "",
      partsUsed: "",
      partsCost: "",
      notes: "",
      completedBy: "",
    },
  });

  // Get users for "completed by" dropdown
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Get existing work completed entries
  const { data: workEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: [`/api/work-completed/${jobId}`],
    enabled: !!jobId,
  });

  // Add work completed mutation
  const addWorkMutation = useMutation({
    mutationFn: async (data: z.infer<typeof workCompletedSchema>) => {
      const workData = {
        ...data,
        laborHours: parseFloat(data.laborHours),
        partsCost: data.partsCost ? parseFloat(data.partsCost) : null,
      };
      return apiRequest("POST", "/api/work-completed", workData);
    },
    onSuccess: () => {
      toast({
        title: "Work Entry Added",
        description: "Work completed entry has been successfully recorded.",
      });
      form.reset({
        jobId: jobId,
        workDescription: "",
        category: "",
        laborHours: "",
        partsUsed: "",
        partsCost: "",
        notes: "",
        completedBy: "",
      });
      setIsAddingWork(false);
      queryClient.invalidateQueries({ queryKey: [`/api/work-completed/${jobId}`] });
      if (onWorkAdded) onWorkAdded();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to add work entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof workCompletedSchema>) => {
    addWorkMutation.mutate(data);
  };

  // Work categories for industry standard classification
  const workCategories = [
    { value: "diagnosis", label: "Diagnosis & Assessment" },
    { value: "repair", label: "Equipment Repair" },
    { value: "maintenance", label: "Routine Maintenance" },
    { value: "replacement", label: "Parts Replacement" },
    { value: "adjustment", label: "Adjustment & Calibration" },
    { value: "cleaning", label: "Cleaning & Service" },
    { value: "testing", label: "Testing & Inspection" },
    { value: "assembly", label: "Assembly & Installation" },
    { value: "other", label: "Other Work" },
  ];

  const getUserName = (userId: string) => {
    if (!Array.isArray(users)) return "Unknown";
    const user = users.find((u: any) => u.id === parseInt(userId));
    return user ? user.fullName : "Unknown";
  };

  const getCategoryLabel = (category: string) => {
    const cat = workCategories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const calculateTotalHours = () => {
    if (!Array.isArray(workEntries)) return 0;
    return workEntries.reduce((total: number, entry: any) => total + (parseFloat(entry.laborHours) || 0), 0);
  };

  const calculateTotalCost = () => {
    if (!Array.isArray(workEntries)) return 0;
    return workEntries.reduce((total: number, entry: any) => total + (parseFloat(entry.partsCost) || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header with Print Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Work Completed</h3>
        <PrintWorkCompletion jobId={jobId} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <Clock className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Labor Hours</p>
              <p className="text-2xl font-bold">{calculateTotalHours()}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <Wrench className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Work Entries</p>
              <p className="text-2xl font-bold">{Array.isArray(workEntries) ? workEntries.length : 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <Package className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Parts Cost</p>
              <p className="text-2xl font-bold">£{calculateTotalCost().toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Work Entry */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Work Completed Entries</CardTitle>
              <CardDescription>
                Record detailed work completed, parts used, and labor hours
              </CardDescription>
            </div>
            {!readOnly && (
              <Button
                onClick={() => setIsAddingWork(!isAddingWork)}
                variant={isAddingWork ? "outline" : "default"}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isAddingWork ? "Cancel" : "Add Work Entry"}
              </Button>
            )}
          </div>
        </CardHeader>

          {!readOnly && isAddingWork && (
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work category*</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select work category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {workCategories.map((category) => (
                                <SelectItem key={category.value} value={category.value}>
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Group the work into a service bucket for reporting.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="completedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Completed by*</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select technician" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.isArray(users) &&
                                users.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.fullName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Who carried out this portion of the work.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="workDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What was done*</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Highlight the diagnostics and repairs performed…" rows={3} {...field} />
                        </FormControl>
                        <FormDescription>Customers see this on their paperwork, so be specific and friendly.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="laborHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Labour hours*</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.25"
                              min="0"
                              placeholder="e.g. 2.5"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Log the time spent so we can track utilisation.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="partsCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parts cost (£)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="e.g. 45.99" {...field} />
                          </FormControl>
                          <FormDescription>Optional — helps reconcile job profitability.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="partsUsed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parts used</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="List any parts fitted or consumables used…"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>This feeds into the job summary and customer paperwork.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Optional handover notes for the front desk…" rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={addWorkMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {addWorkMutation.isPending ? "Saving…" : "Save work entry"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsAddingWork(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          )}
      </Card>

      {/* Existing Work Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Work History</CardTitle>
          <CardDescription>
            Complete record of all work performed on this job
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="text-center py-4">Loading work entries...</div>
          ) : !Array.isArray(workEntries) || workEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No work entries recorded yet</p>
              <p className="text-sm">Start by adding your first work entry above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workEntries.map((entry: any, index: number) => (
                <div key={entry.id || index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {getCategoryLabel(entry.category)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{entry.laborHours}h</div>
                      {entry.partsCost && (
                        <div className="text-sm text-gray-600">£{entry.partsCost}</div>
                      )}
                    </div>
                  </div>

                  <h4 className="font-medium mb-2">Work Description</h4>
                  <p className="text-gray-700 mb-3">{entry.workDescription}</p>

                  {entry.partsUsed && (
                    <>
                      <h4 className="font-medium mb-2">Parts Used</h4>
                      <p className="text-gray-700 mb-3">{entry.partsUsed}</p>
                    </>
                  )}

                  {entry.notes && (
                    <>
                      <h4 className="font-medium mb-2">Notes</h4>
                      <p className="text-gray-700 mb-3">{entry.notes}</p>
                    </>
                  )}

                  <div className="text-sm text-gray-500">
                    Completed by: {getUserName(entry.completedBy)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}