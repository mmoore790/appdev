import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Edit,
  Trash2,
  Send,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { format, isAfter, subDays, startOfDay, endOfDay } from "date-fns";
import { OrderForm } from "@/components/order-form";
import { OrderDetailView } from "@/components/order-detail-view";
import { OrderEditForm } from "@/components/order-edit-form";

// Form schemas
const orderStatusUpdateSchema = z.object({
  status: z.enum(["not_ordered", "ordered", "arrived", "completed"]),
  changeReason: z.string().optional(),
  notes: z.string().optional(),
  notifyOnArrival: z.boolean().optional(),
});

type OrderStatusUpdateFormData = z.infer<typeof orderStatusUpdateSchema>;

interface Order {
  id: number;
  orderNumber: string;
  customerId?: number;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress?: string;
  customerNotes?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: string;
  supplierName?: string;
  supplierContact?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  expectedLeadTime?: number;
  trackingNumber?: string;
  estimatedTotalCost?: number;
  actualTotalCost?: number;
  depositAmount?: number;
  notes?: string;
  internalNotes?: string;
  notifyOnOrderPlaced: boolean;
  notifyOnStatusChange: boolean;
  notifyOnArrival: boolean;
  notificationMethod: string;
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
  relatedJobId?: number;
}

interface OrderItem {
  id: number;
  orderId: number;
  itemName: string;
  itemSku?: string;
  itemType: string;
  itemCategory?: string;
  quantity: number;
  unitPrice?: number;
  priceExcludingVat?: number;
  priceIncludingVat?: number;
  totalPrice?: number;
  supplierName?: string;
  supplierSku?: string;
  notes?: string;
}

const ORDER_STATUSES = {
  NOT_ORDERED: 'not_ordered',
  ORDERED: 'ordered',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
} as const;

type SortField = 'orderNumber' | 'customerName' | 'orderDate' | 'expectedDeliveryDate' | 'totalCost' | 'status';
type SortDirection = 'asc' | 'desc';

export default function Orders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"open" | "completed">("open");
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('orderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    from: Date | null;
    to: Date | null;
  }>({ from: null, to: null });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Fetch orders with pagination
  const { data: ordersResponse, isLoading } = useQuery<{
    data: Order[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>({
    queryKey: ["/api/orders", currentPage],
    queryFn: () => apiRequest("GET", `/api/orders?page=${currentPage}&limit=${itemsPerPage}`),
  });

  const orders = ordersResponse?.data || [];
  const pagination = ordersResponse?.pagination;

  // Fetch order items for selected order
  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: [`/api/orders/${selectedOrder?.id}/items`],
    enabled: !!selectedOrder?.id && (detailsDialogOpen || historyDialogOpen),
  });

  // Fetch order status history
  const { data: orderHistory = [] } = useQuery<any[]>({
    queryKey: [`/api/orders/${selectedOrder?.id}/history`],
    enabled: !!selectedOrder?.id && historyDialogOpen,
  });

  // Handle orderId from URL params - auto-select order when navigating from notification
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orderIdParam = searchParams.get('orderId');
    
    if (orderIdParam && !selectedOrder) {
      const orderId = parseInt(orderIdParam, 10);
      if (!isNaN(orderId)) {
        // First try to find in current orders list
        const order = orders.find(o => o.id === orderId);
        if (order) {
          setSelectedOrder(order);
          setDetailsDialogOpen(true);
          // Clean up URL by removing the query parameter
          searchParams.delete('orderId');
          const newSearch = searchParams.toString();
          const newUrl = newSearch ? `${location.split('?')[0]}?${newSearch}` : location.split('?')[0];
          navigate(newUrl, { replace: true });
        } else if (orders.length > 0 && !isLoading) {
          // Order not found in current page, fetch it directly
          apiRequest("GET", `/api/orders/${orderId}`)
            .then((fetchedOrder) => {
              if (fetchedOrder) {
                setSelectedOrder(fetchedOrder as Order);
                setDetailsDialogOpen(true);
                // Clean up URL by removing the query parameter
                searchParams.delete('orderId');
                const newSearch = searchParams.toString();
                const newUrl = newSearch ? `${location.split('?')[0]}?${newSearch}` : location.split('?')[0];
                navigate(newUrl, { replace: true });
              }
            })
            .catch((error) => {
              console.error('Failed to fetch order:', error);
              // Clean up URL even if order not found
              searchParams.delete('orderId');
              const newSearch = searchParams.toString();
              const newUrl = newSearch ? `${location.split('?')[0]}?${newSearch}` : location.split('?')[0];
              navigate(newUrl, { replace: true });
            });
        }
      }
    }
  }, [orders, selectedOrder, location, navigate, isLoading]);

  // Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: OrderStatusUpdateFormData }) =>
      apiRequest("POST", `/api/orders/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setCurrentPage(1);
      setStatusDialogOpen(false);
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

  // Notify customer mutation
  const notifyCustomerMutation = useMutation({
    mutationFn: ({ id, type }: { id: number; type: string }) =>
      apiRequest("POST", `/api/orders/${id}/notify`, { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setCurrentPage(1);
      toast({
        title: "Success",
        description: "Customer notification sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setCurrentPage(1);
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    },
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setCurrentPage(1);
      if (selectedOrder) {
        queryClient.invalidateQueries({ queryKey: [`/api/orders/${selectedOrder.id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/orders/${selectedOrder.id}/items`] });
      }
      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Order updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    },
  });

  // Status update form
  const statusForm = useForm<OrderStatusUpdateFormData>({
    resolver: zodResolver(orderStatusUpdateSchema),
    defaultValues: {
      status: "ordered",
      notifyOnArrival: true, // Default to checked
    },
  });

  // Filter orders based on all filters
  const filteredOrders = useMemo(() => {
    let filtered = orders.filter((order) => {
      // Tab filter - separate open and completed orders
      const isCompleted = order.status === ORDER_STATUSES.COMPLETED;
      const matchesTab = activeTab === "completed" ? isCompleted : !isCompleted;
      
      // Search filter
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customerEmail && order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        order.customerPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.supplierName && order.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Status filter
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      
      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter.from || dateRangeFilter.to) {
        const orderDate = new Date(order.orderDate);
        if (dateRangeFilter.from && orderDate < startOfDay(dateRangeFilter.from)) {
          matchesDateRange = false;
        }
        if (dateRangeFilter.to && orderDate > endOfDay(dateRangeFilter.to)) {
          matchesDateRange = false;
        }
      }
      
      return matchesTab && matchesSearch && matchesStatus && matchesDateRange;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'orderNumber':
          aValue = a.orderNumber;
          bValue = b.orderNumber;
          break;
        case 'customerName':
          aValue = a.customerName.toLowerCase();
          bValue = b.customerName.toLowerCase();
          break;
        case 'orderDate':
          aValue = new Date(a.orderDate).getTime();
          bValue = new Date(b.orderDate).getTime();
          break;
        case 'expectedDeliveryDate':
          aValue = a.expectedDeliveryDate ? new Date(a.expectedDeliveryDate).getTime() : 0;
          bValue = b.expectedDeliveryDate ? new Date(b.expectedDeliveryDate).getTime() : 0;
          break;
        case 'totalCost':
          aValue = a.actualTotalCost || a.estimatedTotalCost || 0;
          bValue = b.actualTotalCost || b.estimatedTotalCost || 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [orders, searchQuery, statusFilter, dateRangeFilter, sortField, sortDirection, activeTab]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateRangeFilter({ from: null, to: null });
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && pagination && page <= pagination.totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery !== "" ||
           statusFilter !== "all" ||
           dateRangeFilter.from !== null ||
           dateRangeFilter.to !== null;
  }, [searchQuery, statusFilter, dateRangeFilter]);

  // Get status badge styling
  const getStatusBadge = (order: Order) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      not_ordered: { label: "Not Ordered", className: "bg-gray-100 text-gray-800" },
      ordered: { label: "Ordered", className: "bg-blue-100 text-blue-800" },
      arrived: { label: "Arrived", className: "bg-green-100 text-green-800" },
      completed: { label: "Completed", className: "bg-green-200 text-green-900" },
    };

    const config = statusConfig[order.status] || { label: order.status, className: "bg-gray-100 text-gray-800" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Handle status update
  const onStatusUpdate = (data: OrderStatusUpdateFormData) => {
    if (selectedOrder) {
      statusUpdateMutation.mutate({ id: selectedOrder.id, data });
    }
  };

  // Handle notify customer
  const handleNotifyCustomer = (order: Order, type: 'order_placed' | 'arrived') => {
    notifyCustomerMutation.mutate({ id: order.id, type });
  };

  // Handle mark as complete
  const handleMarkAsComplete = (order: Order) => {
    if (confirm(`Mark order ${order.orderNumber} as completed?`)) {
      statusUpdateMutation.mutate({ 
        id: order.id, 
        data: { 
          status: ORDER_STATUSES.COMPLETED,
          changeReason: "Order completed",
          notes: "Order marked as completed"
        } 
      });
    }
  };

  // Handle delete order
  const handleDeleteOrder = (order: Order) => {
    if (confirm(`Are you sure you want to delete order ${order.orderNumber}? This action cannot be undone.`)) {
      deleteOrderMutation.mutate(order.id);
    }
  };

  return (
    <div className="container mx-auto py-2 sm:py-3 px-2 sm:px-3 max-w-[1920px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage orders for any type of item</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 bg-green-700 hover:bg-green-800">
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
              <DialogDescription>
                Create a new order for any type of item. All details will be tracked automatically.
              </DialogDescription>
            </DialogHeader>
            <OrderForm
              onSuccess={() => {
                setCreateDialogOpen(false);
                setCurrentPage(1);
                queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
              }}
              onCancel={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabs for Open/Completed Orders */}
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as "open" | "completed");
        setCurrentPage(1);
      }}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="open">
            Open Orders
            {orders.filter(o => o.status !== ORDER_STATUSES.COMPLETED).length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {orders.filter(o => o.status !== ORDER_STATUSES.COMPLETED).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed Orders
            {orders.filter(o => o.status === ORDER_STATUSES.COMPLETED).length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {orders.filter(o => o.status === ORDER_STATUSES.COMPLETED).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Main filter row */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
                  <Input
                    placeholder="Search by order number, customer, supplier..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={ORDER_STATUSES.NOT_ORDERED}>Not Ordered</SelectItem>
                  <SelectItem value={ORDER_STATUSES.ORDERED}>Ordered</SelectItem>
                  <SelectItem value={ORDER_STATUSES.ARRIVED}>Arrived</SelectItem>
                  <SelectItem value={ORDER_STATUSES.COMPLETED}>Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Advanced Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    Active
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-neutral-600"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Advanced filters */}
            {showAdvancedFilters && (
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date range filter */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700 mb-2 block">
                      Order Date From
                    </label>
                    <Input
                      type="date"
                      value={dateRangeFilter.from ? format(dateRangeFilter.from, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        setDateRangeFilter(prev => ({ ...prev, from: date }));
                        setCurrentPage(1);
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-neutral-700 mb-2 block">
                      Order Date To
                    </label>
                    <Input
                      type="date"
                      value={dateRangeFilter.to ? format(dateRangeFilter.to, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        setDateRangeFilter(prev => ({ ...prev, to: date }));
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Orders
            {pagination ? ` (${pagination.totalCount} total, showing ${filteredOrders.length} on this page)` : ` (${filteredOrders.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No orders found. Create your first order to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort('orderNumber')}
                        className="flex items-center hover:text-neutral-900 transition-colors"
                      >
                        Order #
                        {getSortIcon('orderNumber')}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('customerName')}
                        className="flex items-center hover:text-neutral-900 transition-colors"
                      >
                        Customer
                        {getSortIcon('customerName')}
                      </button>
                    </TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center hover:text-neutral-900 transition-colors"
                      >
                        Status
                        {getSortIcon('status')}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('orderDate')}
                        className="flex items-center hover:text-neutral-900 transition-colors"
                      >
                        Order Date
                        {getSortIcon('orderDate')}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('expectedDeliveryDate')}
                        className="flex items-center hover:text-neutral-900 transition-colors"
                      >
                        Expected Delivery
                        {getSortIcon('expectedDeliveryDate')}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('totalCost')}
                        className="flex items-center hover:text-neutral-900 transition-colors"
                      >
                        Total Cost
                        {getSortIcon('totalCost')}
                      </button>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-semibold">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          {order.customerPhone && (
                            <div className="text-sm text-neutral-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.customerPhone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          View Items
                        </Button>
                      </TableCell>
                      <TableCell>{getStatusBadge(order)}</TableCell>
                      <TableCell>{format(new Date(order.orderDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {order.expectedDeliveryDate
                          ? format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {order.estimatedTotalCost
                          ? `£${order.estimatedTotalCost.toFixed(2)}`
                          : order.actualTotalCost
                          ? `£${order.actualTotalCost.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          {order.status === ORDER_STATUSES.ARRIVED && (
                            <Button
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                              size="sm"
                              onClick={() => handleMarkAsComplete(order)}
                              title="Mark order as completed"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              statusForm.reset({ status: order.status as any });
                              setStatusDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {order.status === ORDER_STATUSES.ARRIVED && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNotifyCustomer(order, 'arrived')}
                              title="Notify customer order is ready"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOrder(order)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className={!pagination.hasPreviousPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (pagination.hasPreviousPage) {
                      handlePageChange(currentPage - 1);
                    }
                  }}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                let pageNumber: number;
                if (pagination.totalPages <= 7) {
                  pageNumber = i + 1;
                } else if (currentPage <= 4) {
                  pageNumber = i + 1;
                } else if (currentPage >= pagination.totalPages - 3) {
                  pageNumber = pagination.totalPages - 6 + i;
                } else {
                  pageNumber = currentPage - 3 + i;
                }
                
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      isActive={currentPage === pageNumber}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  className={!pagination.hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (pagination.hasNextPage) {
                      handlePageChange(currentPage + 1);
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <div className="text-center text-sm text-muted-foreground mt-2">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.totalCount)} of {pagination.totalCount} orders
          </div>
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => {
        setStatusDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          statusForm.reset({
            status: "ordered",
            changeReason: "",
            notes: "",
            notifyOnArrival: true, // Default to checked
          });
        } else if (selectedOrder) {
          // Initialize form with current order status when dialog opens
          statusForm.reset({
            status: selectedOrder.status as any,
            changeReason: "",
            notes: "",
            notifyOnArrival: true, // Default to checked
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Update the status of order {selectedOrder?.orderNumber}
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
                        <SelectItem value={ORDER_STATUSES.NOT_ORDERED}>Not Ordered</SelectItem>
                        <SelectItem value={ORDER_STATUSES.ORDERED}>Ordered</SelectItem>
                        <SelectItem value={ORDER_STATUSES.ARRIVED}>Arrived</SelectItem>
                        <SelectItem value={ORDER_STATUSES.COMPLETED}>Completed</SelectItem>
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
              {statusForm.watch("status") === ORDER_STATUSES.ARRIVED && (
                <FormField
                  control={statusForm.control}
                  name="notifyOnArrival"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Notify customer that order has arrived</FormLabel>
                        <p className="text-xs text-neutral-500">
                          Send an email notification to the customer when the order status is updated to "Arrived"
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatusDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={statusUpdateMutation.isPending}>
                  {statusUpdateMutation.isPending ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <OrderDetailView
              order={selectedOrder}
              items={orderItems}
              onClose={() => setDetailsDialogOpen(false)}
              onViewHistory={() => {
                setDetailsDialogOpen(false);
                setHistoryDialogOpen(true);
              }}
              onNotifyCustomer={(type) => handleNotifyCustomer(selectedOrder, type)}
              onMarkAsComplete={
                selectedOrder.status === ORDER_STATUSES.ARRIVED
                  ? () => {
                      setDetailsDialogOpen(false);
                      handleMarkAsComplete(selectedOrder);
                    }
                  : undefined
              }
              onEdit={() => {
                setDetailsDialogOpen(false);
                setEditDialogOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order {selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Update order details. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <OrderEditForm
              order={selectedOrder}
              onSuccess={() => {
                setEditDialogOpen(false);
                setDetailsDialogOpen(true);
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setDetailsDialogOpen(true);
              }}
              onUpdate={async (data) => {
                await updateOrderMutation.mutateAsync({
                  id: selectedOrder.id,
                  data,
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Status History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Order Status History</DialogTitle>
            <DialogDescription>
              Complete history of status changes for order {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {orderHistory.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">No history available</div>
            ) : (
              orderHistory.map((entry, index) => (
                <div key={entry.id} className="border-l-2 border-blue-500 pl-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {entry.previousStatus ? `${entry.previousStatus} → ${entry.newStatus}` : entry.newStatus}
                      </div>
                      {entry.changeReason && (
                        <div className="text-sm text-neutral-600 mt-1">{entry.changeReason}</div>
                      )}
                      {entry.notes && (
                        <div className="text-sm text-neutral-500 mt-1">{entry.notes}</div>
                      )}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

