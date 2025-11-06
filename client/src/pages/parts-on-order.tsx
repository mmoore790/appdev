import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Search, 
  Package, 
  Phone, 
  Mail, 
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Calendar,
  DollarSign,
  User,
  History,
  Bell,
  PackageCheck,
  PackageX,
  Eye,
  FileText,
  Wrench
} from "lucide-react";
import { format, isAfter, subDays } from "date-fns";

// Form schemas
const partOrderSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  partNumber: z.string().optional(),
  supplier: z.string().min(1, "Supplier is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  customerPhone: z.string().min(1, "Phone number is required"),
  expectedDeliveryDate: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  estimatedCost: z.number().optional(),
  notes: z.string().optional(),
  relatedJobId: z.number().optional(),
});

const markArrivedSchema = z.object({
  actualDeliveryDate: z.string().optional(),
  actualCost: z.number().optional(),
  notes: z.string().optional(),
});

type PartOrderFormData = z.infer<typeof partOrderSchema>;
type MarkArrivedFormData = z.infer<typeof markArrivedSchema>;

interface PartOnOrder {
  id: number;
  partName: string;
  partNumber?: string;
  supplier: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: string;
  isArrived: boolean;
  isCustomerNotified: boolean;
  quantity: number;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
  relatedJobId?: number;
}

export default function PartsOnOrder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [arrivalDialogOpen, setArrivalDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartOnOrder | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch all parts
  const { data: parts = [], isLoading } = useQuery<PartOnOrder[]>({
    queryKey: ["/api/parts-on-order"],
  });

  // Fetch overdue parts
  const { data: overdueParts = [] } = useQuery<PartOnOrder[]>({
    queryKey: ["/api/parts-on-order/overdue"],
  });

  // Fetch part updates history
  const { data: partUpdates = [] } = useQuery<any[]>({
    queryKey: [`/api/parts-on-order/${selectedPart?.id}/updates`],
    enabled: !!selectedPart?.id && historyDialogOpen,
  });

  // Create part mutation
  const createPartMutation = useMutation({
    mutationFn: (data: PartOrderFormData) => apiRequest("POST", "/api/parts-on-order", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-on-order"] });
      setCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Part order created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create part order",
        variant: "destructive",
      });
    },
  });

  // Mark as arrived mutation
  const markArrivedMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MarkArrivedFormData }) =>
      apiRequest("POST", `/api/parts-on-order/${id}/arrived`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-on-order"] });
      setArrivalDialogOpen(false);
      toast({
        title: "Success",
        description: "Part marked as arrived",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark part as arrived",
        variant: "destructive",
      });
    },
  });

  // Mark as collected mutation
  const markCollectedMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/parts-on-order/${id}/collected`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-on-order"] });
      toast({
        title: "Success",
        description: "Part marked as collected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark part as collected",
        variant: "destructive",
      });
    },
  });

  // Notify customer mutation
  const notifyCustomerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/parts-on-order/${id}/notify-customer`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-on-order"] });
      toast({
        title: "Success",
        description: "Customer notified successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to notify customer",
        variant: "destructive",
      });
    },
  });

  // Forms
  const createForm = useForm<PartOrderFormData>({
    resolver: zodResolver(partOrderSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const arrivalForm = useForm<MarkArrivedFormData>({
    resolver: zodResolver(markArrivedSchema),
  });

  // Filter parts based on search
  const filteredParts = parts.filter((part) => 
    part.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (part.partNumber && part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get status badge styling
  const getStatusBadge = (part: PartOnOrder) => {
    if (part.status === "collected") {
      return <Badge variant="default" className="bg-green-100 text-green-800">Collected</Badge>;
    } else if (part.isArrived) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Ready for Pickup</Badge>;
    } else if (isAfter(new Date(), subDays(new Date(part.orderDate), -8))) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else {
      return <Badge variant="outline">Ordered</Badge>;
    }
  };

  // Check if part is overdue
  const isPartOverdue = (part: PartOnOrder) => {
    if (part.isArrived || part.status === "collected") return false;
    const orderDate = new Date(part.orderDate);
    const eightDaysAgo = subDays(new Date(), -8);
    return isAfter(eightDaysAgo, orderDate);
  };

  // Handle form submissions
  const onCreateSubmit = (data: PartOrderFormData) => {
    createPartMutation.mutate(data);
  };

  const onArrivalSubmit = (data: MarkArrivedFormData) => {
    if (selectedPart) {
      markArrivedMutation.mutate({ id: selectedPart.id, data });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">Parts on Order</h1>
          <p className="text-neutral-600 mt-1">Track supplier parts ordered for customers</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-700 hover:bg-green-800">
              <Plus className="h-4 w-4 mr-2" />
              Order Part
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Order New Part</DialogTitle>
              <DialogDescription>
                Create a new part order for a customer. All details will be tracked automatically.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="partName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Blade Belt" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="partNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., XYZ-123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Parts Plus Ltd" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Phone *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 01234 567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Email</FormLabel>
                      <FormControl>
                        <Input placeholder="customer@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={createForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="estimatedCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Cost (£)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="expectedDeliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Delivery</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPartMutation.isPending}>
                    {createPartMutation.isPending ? "Creating..." : "Create Order"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overdue Parts Alert */}
      {overdueParts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>{overdueParts.length} parts</strong> have been on order for more than 8 days. 
            Please check stock with suppliers and contact customers with updates.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <Package className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-neutral-600">Total Parts</p>
              <p className="text-2xl font-bold">{parts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <Clock className="h-8 w-8 text-amber-600 mr-3" />
            <div>
              <p className="text-sm text-neutral-600">Pending</p>
              <p className="text-2xl font-bold">
                {parts.filter(p => !p.isArrived && p.status !== "collected").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-neutral-600">Arrived</p>
              <p className="text-2xl font-bold">
                {parts.filter(p => p.isArrived && p.status !== "collected").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm text-neutral-600">Overdue</p>
              <p className="text-2xl font-bold">{overdueParts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
              <Input
                placeholder="Search parts, customers, suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-7 w-7 border-4 border-green-600 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredParts.length === 0 ? (
            <div className="py-10 text-center">
              <Package className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="font-medium text-neutral-700 mb-2">No parts found</h3>
              <p className="text-neutral-500">Create your first part order to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.map((part) => (
                  <TableRow key={part.id} className={isPartOverdue(part) ? "bg-red-50" : ""}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{part.partName}</div>
                        {part.partNumber && (
                          <div className="text-sm text-neutral-500">{part.partNumber}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-neutral-400 mr-1" />
                          <span className="text-sm">{part.customerName}</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-neutral-400 mr-1" />
                          <span className="text-xs text-neutral-500">{part.customerPhone}</span>
                        </div>
                        {part.customerEmail && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 text-neutral-400 mr-1" />
                            <span className="text-xs text-neutral-500">{part.customerEmail}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{part.supplier}</TableCell>
                    <TableCell>{getStatusBadge(part)}</TableCell>
                    <TableCell>{format(new Date(part.orderDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {part.expectedDeliveryDate 
                        ? format(new Date(part.expectedDeliveryDate), "MMM d, yyyy")
                        : "TBD"
                      }
                    </TableCell>
                    <TableCell>
                      {part.estimatedCost 
                        ? `£${part.estimatedCost.toFixed(2)}`
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPart(part);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        {!part.isArrived && part.status !== "collected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPart(part);
                              setArrivalDialogOpen(true);
                            }}
                          >
                            <Truck className="h-4 w-4 mr-1" />
                            Mark Arrived
                          </Button>
                        )}
                        {part.isArrived && !part.isCustomerNotified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => notifyCustomerMutation.mutate(part.id)}
                            disabled={notifyCustomerMutation.isPending}
                          >
                            <Bell className="h-4 w-4 mr-1" />
                            Notify Customer
                          </Button>
                        )}
                        {part.isArrived && part.status !== "collected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markCollectedMutation.mutate(part.id)}
                            disabled={markCollectedMutation.isPending}
                          >
                            <PackageCheck className="h-4 w-4 mr-1" />
                            Mark Collected
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPart(part);
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>



      {/* Mark Arrived Dialog */}
      <Dialog open={arrivalDialogOpen} onOpenChange={setArrivalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Part as Arrived</DialogTitle>
            <DialogDescription>
              Record that {selectedPart?.partName} has been delivered and is ready for customer collection.
            </DialogDescription>
          </DialogHeader>
          <Form {...arrivalForm}>
            <form onSubmit={arrivalForm.handleSubmit(onArrivalSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={arrivalForm.control}
                  name="actualDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={arrivalForm.control}
                  name="actualCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Cost (£)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field} 
                          onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={arrivalForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes about the delivery..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setArrivalDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={markArrivedMutation.isPending}>
                  {markArrivedMutation.isPending ? "Updating..." : "Mark as Arrived"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Part History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Part Order History</DialogTitle>
            <DialogDescription>
              Complete timeline for {selectedPart?.partName} ({selectedPart?.customerName})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {partUpdates && partUpdates.length > 0 ? (
              partUpdates.map((update: any, index: number) => (
                <div key={update.id || index} className="flex items-start space-x-3 pb-3 border-b last:border-0">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium capitalize">{update.updateType?.replace('_', ' ') || 'Update'}</h4>
                      <span className="text-sm text-neutral-500">
                        {format(new Date(update.createdAt || new Date()), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    {update.notes && <p className="text-sm text-neutral-600 mt-1">{update.notes}</p>}
                    {update.previousStatus && update.newStatus && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Status: {update.previousStatus} → {update.newStatus}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Part Order Created</h4>
                      <span className="text-sm text-neutral-500">
                        {selectedPart && format(new Date(selectedPart.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">
                      Part order "{selectedPart?.partName}" created for {selectedPart?.customerName}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Supplier: {selectedPart?.supplier} | Quantity: {selectedPart?.quantity}
                    </p>
                  </div>
                </div>
                {selectedPart?.isArrived && (
                  <div className="flex items-start space-x-3 mt-4 pt-3 border-t">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Part Arrived</h4>
                        <span className="text-sm text-neutral-500">
                          {selectedPart.actualDeliveryDate && format(new Date(selectedPart.actualDeliveryDate), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">Part arrived and ready for customer collection</p>
                    </div>
                  </div>
                )}
                {selectedPart?.status === "collected" && (
                  <div className="flex items-start space-x-3 mt-4 pt-3 border-t">
                    <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Part Collected</h4>
                        <span className="text-sm text-neutral-500">
                          {selectedPart.updatedAt && format(new Date(selectedPart.updatedAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">Part collected by customer</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Part Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Part Order Details
            </DialogTitle>
            <DialogDescription>
              Complete information for part order #{selectedPart?.id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPart && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedPart)}
                <span className="text-sm text-neutral-500">
                  Order #{selectedPart.id} | Created {format(new Date(selectedPart.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>

              {/* Part Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Part Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Part Name</label>
                    <p className="text-lg font-semibold">{selectedPart.partName}</p>
                  </div>
                  {selectedPart.partNumber && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">Part Number</label>
                      <p className="text-lg">{selectedPart.partNumber}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Supplier</label>
                    <p className="text-lg">{selectedPart.supplier}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Quantity</label>
                    <p className="text-lg">{selectedPart.quantity}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Customer Name</label>
                    <p className="text-lg">{selectedPart.customerName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Phone Number</label>
                    <p className="text-lg flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-neutral-400" />
                      {selectedPart.customerPhone}
                    </p>
                  </div>
                  {selectedPart.customerEmail && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-neutral-600">Email Address</label>
                      <p className="text-lg flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-neutral-400" />
                        {selectedPart.customerEmail}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order & Delivery Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Order & Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Order Date</label>
                    <p className="text-lg">{format(new Date(selectedPart.orderDate), "MMMM d, yyyy")}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Expected Delivery</label>
                    <p className="text-lg">
                      {selectedPart.expectedDeliveryDate 
                        ? format(new Date(selectedPart.expectedDeliveryDate), "MMMM d, yyyy")
                        : "To be determined"
                      }
                    </p>
                  </div>
                  {selectedPart.actualDeliveryDate && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">Actual Delivery Date</label>
                      <p className="text-lg text-green-700 font-medium">
                        {format(new Date(selectedPart.actualDeliveryDate), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Customer Notified</label>
                    <p className={`text-lg font-medium ${selectedPart.isCustomerNotified ? 'text-green-700' : 'text-amber-600'}`}>
                      {selectedPart.isCustomerNotified ? "Yes" : "Not yet"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Cost Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Estimated Cost</label>
                    <p className="text-lg">
                      {selectedPart.estimatedCost 
                        ? `£${selectedPart.estimatedCost.toFixed(2)}`
                        : "Not specified"
                      }
                    </p>
                  </div>
                  {selectedPart.actualCost && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">Actual Cost</label>
                      <p className="text-lg font-semibold text-green-700">
                        £{selectedPart.actualCost.toFixed(2)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes Section */}
              {selectedPart.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Order Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-neutral-50 p-4 rounded-lg">
                      <p className="text-neutral-700 whitespace-pre-wrap">{selectedPart.notes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Related Job Information */}
              {selectedPart.relatedJobId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Wrench className="h-4 w-4 mr-2" />
                      Related Job
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg">
                      This part is ordered for Job #{selectedPart.relatedJobId}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      setHistoryDialogOpen(true);
                    }}
                  >
                    <History className="h-4 w-4 mr-2" />
                    View History
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  {!selectedPart.isArrived && selectedPart.status !== "collected" && (
                    <Button
                      onClick={() => {
                        setDetailsDialogOpen(false);
                        setArrivalDialogOpen(true);
                      }}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Mark Arrived
                    </Button>
                  )}
                  
                  {selectedPart.isArrived && !selectedPart.isCustomerNotified && (
                    <Button
                      onClick={() => {
                        notifyCustomerMutation.mutate(selectedPart.id);
                        setDetailsDialogOpen(false);
                      }}
                      disabled={notifyCustomerMutation.isPending}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Notify Customer
                    </Button>
                  )}
                  
                  {selectedPart.isArrived && selectedPart.status !== "collected" && (
                    <Button
                      onClick={() => {
                        markCollectedMutation.mutate(selectedPart.id);
                        setDetailsDialogOpen(false);
                      }}
                      disabled={markCollectedMutation.isPending}
                    >
                      <PackageCheck className="h-4 w-4 mr-2" />
                      Mark Collected
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}