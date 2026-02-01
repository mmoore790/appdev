import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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
  User,
  History,
  Bell,
  PackageCheck,
  PackageX,
  FileText,
  Edit,
  Trash2,
  Send,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  PackageOpen,
  ChevronRight,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isAfter, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
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
  items?: OrderItem[];
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

type SortField = 'orderNumber' | 'customerName' | 'orderDate' | 'expectedDeliveryDate' | 'status';
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

  // Fetch orders with pagination and optional search (searches order #, customer, supplier, item names)
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
    queryKey: ["/api/orders", currentPage, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(itemsPerPage) });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      return apiRequest("GET", `/api/orders?${params.toString()}`);
    },
  });

  const orders = ordersResponse?.data || [];
  const pagination = ordersResponse?.pagination;

  // Fallback: fetch items in batch when list response doesn't include them
  const orderIdsNeedingItems = useMemo(() => {
    if (!orders.length) return [];
    return orders.filter((o) => !o.items?.length).map((o) => o.id);
  }, [orders]);

  const { data: batchItems = {} } = useQuery<Record<number, OrderItem[]>>({
    queryKey: ["/api/orders/batch-items", orderIdsNeedingItems.join(",")],
    queryFn: () =>
      orderIdsNeedingItems.length
        ? apiRequest("GET", `/api/orders/batch-items?orderIds=${orderIdsNeedingItems.join(",")}`)
        : Promise.resolve({}),
    enabled: orderIdsNeedingItems.length > 0,
  });

  // Merge batch items into orders for display (use list items when present, otherwise batch-fetched)
  const ordersWithItems = useMemo(() => {
    return orders.map((order) => ({
      ...order,
      items: order.items?.length ? order.items : (batchItems[order.id] ?? []),
    }));
  }, [orders, batchItems]);

  // Fetch order items for selected order
  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: [`/api/orders/${selectedOrder?.id}/items`],
    enabled: !!selectedOrder?.id && (detailsDialogOpen || historyDialogOpen || editDialogOpen),
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setCurrentPage(1);
      setStatusDialogOpen(false);
      const isArrived = variables.data.status === ORDER_STATUSES.ARRIVED;
      toast({
        title: "Success",
        description: isArrived
          ? "Order marked as arrived. The customer will be sent an email to notify them their order has arrived."
          : "Order status updated successfully",
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

  // Add order item mutation
  const addOrderItemMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: any }) =>
      apiRequest("POST", `/api/orders/${orderId}/items`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${variables.orderId}/items`] });
      toast({ title: "Success", description: "Item added to order" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" });
    },
  });

  // Update order item mutation
  const updateOrderItemMutation = useMutation({
    mutationFn: ({ orderId, itemId, data }: { orderId: number; itemId: number; data: any }) =>
      apiRequest("PUT", `/api/orders/${orderId}/items/${itemId}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${variables.orderId}/items`] });
      toast({ title: "Success", description: "Item updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item", variant: "destructive" });
    },
  });

  // Delete order item mutation
  const deleteOrderItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: number; itemId: number }) =>
      apiRequest("DELETE", `/api/orders/${orderId}/items/${itemId}`, {}),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${variables.orderId}/items`] });
      toast({ title: "Success", description: "Item removed from order" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove item", variant: "destructive" });
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

  // Filter orders based on all filters (use ordersWithItems so items column displays correctly)
  const filteredOrders = useMemo(() => {
    let filtered = ordersWithItems.filter((order) => {
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
  }, [ordersWithItems, searchQuery, statusFilter, dateRangeFilter, sortField, sortDirection, activeTab]);

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
  const statusConfig: Record<string, { label: string; className: string }> = {
    not_ordered: { label: "Not ordered", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200" },
    ordered: { label: "Ordered", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200" },
    arrived: { label: "Arrived", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200" },
    completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 font-medium" },
  };

  const getStatusBadge = (order: Order) => {
    const config = statusConfig[order.status] || { label: order.status, className: "bg-muted text-muted-foreground" };
    return <Badge variant="secondary" className={cn("font-normal", config.className)}>{config.label}</Badge>;
  };

  // Handle status update (from dialog)
  const onStatusUpdate = (data: OrderStatusUpdateFormData) => {
    if (selectedOrder) {
      // Always notify customer by email when status changes to arrived
      const payload = data.status === ORDER_STATUSES.ARRIVED
        ? { ...data, notifyOnArrival: true }
        : data;
      statusUpdateMutation.mutate({ id: selectedOrder.id, data: payload });
    }
  };

  // Handle inline status change from dropdown
  const handleStatusChange = (order: Order, newStatus: string) => {
    if (newStatus === order.status) return;
    const payload: OrderStatusUpdateFormData = {
      status: newStatus as any,
      ...(newStatus === ORDER_STATUSES.ARRIVED && { notifyOnArrival: true }),
    };
    statusUpdateMutation.mutate({ id: order.id, data: payload });
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

  const openCount = orders.filter(o => o.status !== ORDER_STATUSES.COMPLETED).length;
  const completedCount = orders.filter(o => o.status === ORDER_STATUSES.COMPLETED).length;

  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-[1920px] space-y-6">
      <PageHeader
        title="Order Management"
        description="Track and manage parts and supply orders for your workshop."
        icon={<Package className="h-6 w-6" />}
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-700 hover:bg-green-800 shadow-sm">
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
        }
      />

      {/* Tabs + Filters toolbar */}
      <Card className="rounded-xl border border-border/80 shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value as "open" | "completed");
          setCurrentPage(1);
        }}>
          <div className="px-4 pt-4 pb-2 sm:px-5">
            <TabsList className="grid w-full max-w-sm grid-cols-2 h-10 bg-muted/60">
              <TabsTrigger value="open" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Open
                {openCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs font-medium">
                    {openCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Completed
                {completedCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs font-medium">
                    {completedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <CardContent className="pt-2 pb-4 sm:px-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search orders, customer, supplier, items..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 bg-muted/30 border-border/80 focus:bg-background"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[160px] h-9 border-border/80">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value={ORDER_STATUSES.NOT_ORDERED}>Not ordered</SelectItem>
                  <SelectItem value={ORDER_STATUSES.ORDERED}>Ordered</SelectItem>
                  <SelectItem value={ORDER_STATUSES.ARRIVED}>Arrived</SelectItem>
                  <SelectItem value={ORDER_STATUSES.COMPLETED}>Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-9 gap-1.5 border-border/80"
              >
                <Filter className="h-4 w-4" />
                Date range
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs">On</Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            {showAdvancedFilters && (
              <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">From</label>
                  <Input
                    type="date"
                    className="h-9"
                    value={dateRangeFilter.from ? format(dateRangeFilter.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setDateRangeFilter(prev => ({ ...prev, from: date }));
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">To</label>
                  <Input
                    type="date"
                    className="h-9"
                    value={dateRangeFilter.to ? format(dateRangeFilter.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setDateRangeFilter(prev => ({ ...prev, to: date }));
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Tabs>
      </Card>

      {/* Orders Table */}
      <Card className="rounded-xl border border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg font-semibold">
              Orders
              {pagination && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {filteredOrders.length} shown
                  {pagination.totalCount !== filteredOrders.length && ` of ${pagination.totalCount}`}
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="h-10 w-24 rounded" />
                  <Skeleton className="h-10 flex-1 max-w-[200px] rounded" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-10 w-28 rounded" />
                  <Skeleton className="h-10 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="rounded-full bg-muted/60 p-4 mb-4">
                <PackageOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">No orders found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {hasActiveFilters ? "Try clearing filters or create a new order." : "Create your first order to get started."}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearAllFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button className="mt-4 bg-green-700 hover:bg-green-800" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur supports-[backdrop-filter]:bg-muted/80 [&_tr]:border-b">
                  <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
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
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedOrder(order);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-mono font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{order.orderNumber}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </TableCell>
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
                        <div
                          className="text-sm max-w-[220px] line-clamp-2"
                          title={(order.items?.length ? order.items.map((i) => `${i.itemName}${i.quantity > 1 ? ` (×${i.quantity})` : ""}`).join(", ") : "No items") || "No items"}
                        >
                          {order.items?.length
                            ? order.items.map((i) => `${i.itemName}${i.quantity > 1 ? ` (×${i.quantity})` : ""}`).join(", ")
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusChange(order, value)}
                          disabled={statusUpdateMutation.isPending}
                        >
                          <SelectTrigger className={cn("h-8 w-[130px] font-normal border", statusConfig[order.status]?.className || "bg-muted")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ORDER_STATUSES.NOT_ORDERED}>Not ordered</SelectItem>
                            <SelectItem value={ORDER_STATUSES.ORDERED}>Ordered</SelectItem>
                            <SelectItem value={ORDER_STATUSES.ARRIVED}>Arrived</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const days = differenceInDays(new Date(), new Date(order.orderDate));
                          const daysColorClass =
                            days > 11
                              ? "text-red-600 dark:text-red-400"
                              : days >= 7
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-500";
                          const daysLabel =
                            days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
                          return (
                            <div>
                              <div>{format(new Date(order.orderDate), "MMM d, yyyy")}</div>
                              <div className={cn("text-xs mt-0.5 font-medium", daysColorClass)}>
                                {daysLabel}
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {order.expectedDeliveryDate
                          ? format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider delayDuration={300}>
                          <div className="flex gap-1 items-center justify-end">
                            {order.status === ORDER_STATUSES.ARRIVED && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    size="sm"
                                    onClick={() => handleMarkAsComplete(order)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Mark Complete
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark order as completed</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteOrder(order)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete order</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {pagination && pagination.totalPages > 1 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t bg-muted/20 px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground order-2 sm:order-1">
              Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, pagination.totalCount)} of {pagination.totalCount}
            </p>
            <Pagination className="order-1 sm:order-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className={!pagination.hasPreviousPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pagination.hasPreviousPage) handlePageChange(currentPage - 1);
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                  let pageNumber: number;
                  if (pagination!.totalPages <= 7) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 4) {
                    pageNumber = i + 1;
                  } else if (currentPage >= pagination!.totalPages - 3) {
                    pageNumber = pagination!.totalPages - 6 + i;
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
                      if (pagination.hasNextPage) handlePageChange(currentPage + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>

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
                <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertDescription>
                    An email will be sent to the customer to notify them that their order has arrived.
                  </AlertDescription>
                </Alert>
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
              onMarkAsComplete={
                selectedOrder.status === ORDER_STATUSES.ARRIVED
                  ? () => {
                      setDetailsDialogOpen(false);
                      handleMarkAsComplete(selectedOrder);
                    }
                  : undefined
              }
              onMarkAsOrdered={
                selectedOrder.status === ORDER_STATUSES.NOT_ORDERED
                  ? () => {
                      handleStatusChange(selectedOrder, ORDER_STATUSES.ORDERED);
                      setSelectedOrder((prev) => prev ? { ...prev, status: ORDER_STATUSES.ORDERED } : null);
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
              items={orderItems}
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
              onAddItem={async (itemData) => {
                await addOrderItemMutation.mutateAsync({
                  orderId: selectedOrder.id,
                  data: itemData,
                });
              }}
              onUpdateItem={async (itemId, itemData) => {
                await updateOrderItemMutation.mutateAsync({
                  orderId: selectedOrder.id,
                  itemId,
                  data: itemData,
                });
              }}
              onDeleteItem={async (itemId) => {
                await deleteOrderItemMutation.mutateAsync({
                  orderId: selectedOrder.id,
                  itemId,
                });
              }}
              isItemsLoading={addOrderItemMutation.isPending || updateOrderItemMutation.isPending || deleteOrderItemMutation.isPending}
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

